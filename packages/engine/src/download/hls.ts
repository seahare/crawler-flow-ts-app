/**
 * HLS (m3u8) 视频流下载模块
 *
 * 流程：
 * 1. 下载并解析 m3u8 主清单，选择最高码率变体
 * 2. 下载分片清单，解析所有 .ts 分片 URL
 * 3. 处理 AES-128 加密（提取 key，解密分片）
 * 4. 并发下载所有分片
 * 5. 调用 ffmpeg 合并为 mp4
 */
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { createDecipheriv } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ensureDir } from './media';

const execFileAsync = promisify(execFile);

interface M3u8Segment {
  url: string;
  duration: number;
  key?: { method: string; uri: string; iv?: string };
}

interface M3u8Playlist {
  version: number;
  targetDuration: number;
  segments: M3u8Segment[];
  isMaster: boolean;
  variants?: { uri: string; bandwidth: number; resolution?: string }[];
}

export interface HlsDownloadOptions {
  url: string;
  outputPath: string; // 输出 mp4 路径
  headers?: Record<string, string>;
  concurrency?: number;
  onProgress?: (downloaded: number, total: number) => void;
}

/** 下载文本内容 */
async function fetchText(url: string, headers?: Record<string, string>): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36',
      ...headers,
    },
    redirect: 'follow',
  });
  return res.text();
}

/** 解析 m3u8 清单 */
function parseM3u8(content: string, baseUrl: string): M3u8Playlist {
  const lines = content.split(/\r?\n/);
  const playlist: M3u8Playlist = {
    version: 3,
    targetDuration: 0,
    segments: [],
    isMaster: false,
    variants: [],
  };

  let currentKey: M3u8Segment['key'];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#EXTM3U')) continue;

    if (line.startsWith('#EXT-X-VERSION')) {
      playlist.version = parseInt(line.split(':')[1], 10);
    } else if (line.startsWith('#EXT-X-TARGETDURATION')) {
      playlist.targetDuration = parseFloat(line.split(':')[1]);
    } else if (line.startsWith('#EXT-X-STREAM-INF')) {
      // 主清单：变体
      playlist.isMaster = true;
      const attrs = parseAttributes(line);
      const uri = lines[++i]?.trim();
      if (uri) {
        playlist.variants!.push({
          uri: resolveUrl(baseUrl, uri),
          bandwidth: parseInt(attrs['BANDWIDTH'] || '0', 10),
          resolution: attrs['RESOLUTION'],
        });
      }
    } else if (line.startsWith('#EXT-X-KEY')) {
      const attrs = parseAttributes(line);
      currentKey = {
        method: attrs['METHOD'] || 'NONE',
        uri: attrs['URI'] ? resolveUrl(baseUrl, attrs['URI']) : '',
        iv: attrs['IV'],
      };
    } else if (line.startsWith('#EXTINF')) {
      const duration = parseFloat(line.split(':')[1].split(',')[0]);
      const uri = lines[++i]?.trim();
      if (uri) {
        playlist.segments.push({
          url: resolveUrl(baseUrl, uri),
          duration,
          key: currentKey,
        });
      }
    }
  }

  return playlist;
}

function parseAttributes(line: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const colonIdx = line.indexOf(':');
  if (colonIdx === -1) return attrs;
  const attrStr = line.slice(colonIdx + 1);
  // 简单解析 KEY=VALUE,KEY="VALUE"
  const regex = /([A-Z0-9-]+)=("([^"]*)"|([^,]+))/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(attrStr)) !== null) {
    attrs[m[1]] = m[3] !== undefined ? m[3] : m[4];
  }
  return attrs;
}

/** 解析相对 URL */
function resolveUrl(base: string, relative: string): string {
  try {
    return new URL(relative, base).href;
  } catch {
    return relative;
  }
}

/** 下载分片（带解密） */
async function downloadSegment(
  url: string,
  headers: Record<string, string> | undefined,
  key?: M3u8Segment['key'],
): Promise<Buffer> {
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36',
      ...headers,
    },
    redirect: 'follow',
  });

  const arrayBuffer = await res.arrayBuffer();
  let data = Buffer.from(arrayBuffer);

  // AES-128 解密
  if (key && key.method === 'AES-128' && key.uri) {
    const keyRes = await fetch(key.uri, { headers, redirect: 'follow' });
    const keyBuf = Buffer.from(await keyRes.arrayBuffer());

    const iv = key.iv
      ? Buffer.from(key.iv.replace(/^0x/, ''), 'hex')
      : Buffer.alloc(16, 0);
    const decipher = createDecipheriv('aes-128-cbc', keyBuf.subarray(0, 16), iv);
    decipher.setAutoPadding(true);
    data = Buffer.concat([decipher.update(data), decipher.final()]);
  }

  return data;
}

/**
 * 下载 HLS 视频并合并为 mp4
 */
export async function downloadHls(opts: HlsDownloadOptions): Promise<string> {
  const { url, outputPath, headers, concurrency = 8, onProgress } = opts;
  const tempDir = join(dirname(outputPath), `.hls_${Date.now()}`);
  await ensureDir(tempDir);

  try {
    // 1. 获取主清单
    let playlistContent = await fetchText(url, headers);
    let playlist = parseM3u8(playlistContent, url);

    // 2. 如果是主清单，选最高码率
    if (playlist.isMaster && playlist.variants && playlist.variants.length > 0) {
      const best = playlist.variants.sort((a, b) => b.bandwidth - a.bandwidth)[0];
      playlistContent = await fetchText(best.uri, headers);
      playlist = parseM3u8(playlistContent, best.uri);
    }

    const segments = playlist.segments;
    if (segments.length === 0) {
      throw new Error('No segments found in m3u8 playlist');
    }

    // 3. 并发下载分片
    const segmentFiles: string[] = [];
    let downloaded = 0;

    const worker = async () => {
      while (downloaded < segments.length) {
        const idx = downloaded++;
        const seg = segments[idx];
        try {
          const data = await downloadSegment(seg.url, headers, seg.key);
          const segPath = join(tempDir, `seg_${String(idx).padStart(5, '0')}.ts`);
          await writeFile(segPath, data);
          segmentFiles[idx] = segPath;
        } catch (e) {
          throw new Error(`Failed to download segment ${idx}: ${(e as Error).message}`);
        }
        onProgress?.(downloaded, segments.length);
      }
    };

    await Promise.all(Array.from({ length: Math.min(concurrency, segments.length) }, worker));

    // 4. 用 ffmpeg 合并
    await concatSegments(segmentFiles.filter(Boolean), outputPath);

    return outputPath;
  } finally {
    // 清理临时分片
    try {
      const { rm } = await import('node:fs/promises');
      await rm(tempDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  }
}

/** 用 ffmpeg 合并 ts 分片为 mp4 */
async function concatSegments(segFiles: string[], output: string): Promise<void> {
  // 构建 concat 列表文件（使用绝对路径）
  const inputList = segFiles.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join('\n');
  const listPath = join(dirname(output), `concat_${Date.now()}.txt`);
  await writeFile(listPath, inputList);

  try {
    await execFileAsync('ffmpeg', [
      '-f', 'concat',
      '-safe', '0',
      '-i', listPath,
      '-c', 'copy',
      '-bsf:a', 'aac_adtstoasc',
      '-y',
      output,
    ], { maxBuffer: 10 * 1024 * 1024 });
  } finally {
    try { await unlink(listPath); } catch {}
  }
}
