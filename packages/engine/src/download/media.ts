/**
 * 媒体下载模块 — 图片、视频直链下载
 */
import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join, basename } from 'node:path';

export interface DownloadOptions {
  url: string;
  outputDir: string;
  filename?: string;
  headers?: Record<string, string>;
  concurrency?: number;
}

export interface DownloadResult {
  path: string;
  size: number;
  filename: string;
}

/** 确保目录存在 */
export async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

/** 从 URL 推断文件名 */
function inferFilename(url: string): string {
  try {
    const u = new URL(url);
    const name = basename(u.pathname);
    return name || `file_${Date.now()}`;
  } catch {
    return `file_${Date.now()}`;
  }
}

/**
 * 流式下载单个文件（使用 Node 内置 fetch）
 */
export async function downloadFile(opts: DownloadOptions): Promise<DownloadResult> {
  const { url, outputDir, headers } = opts;
  await ensureDir(outputDir);

  const filename = opts.filename || inferFilename(url);
  const filePath = join(outputDir, filename);

  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36',
      ...headers,
    },
    redirect: 'follow',
  });

  if (!res.ok) {
    throw new Error(`Download failed: HTTP ${res.status} for ${url}`);
  }

  const fileStream = createWriteStream(filePath);
  let size = 0;

  if (res.body) {
    const reader = res.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      fileStream.write(value);
    }
  }

  await new Promise<void>((resolve, reject) => {
    fileStream.end(() => resolve());
    fileStream.on('error', reject);
  });

  return { path: filePath, size, filename };
}

/**
 * 批量下载
 */
export async function downloadFiles(
  urls: string[],
  outputDir: string,
  headers?: Record<string, string>,
  concurrency = 3,
): Promise<DownloadResult[]> {
  const results: DownloadResult[] = [];
  let idx = 0;

  const worker = async () => {
    while (idx < urls.length) {
      const current = idx++;
      try {
        const r = await downloadFile({ url: urls[current], outputDir, headers });
        results.push(r);
      } catch (e) {
        results.push({ path: '', size: 0, filename: inferFilename(urls[current]) });
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) }, worker));
  return results;
}
