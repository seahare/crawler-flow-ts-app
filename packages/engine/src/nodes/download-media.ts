/**
 * download_media 节点 — 媒体资源下载
 *
 * 配置：
 *   urls: string | string[] — 要下载的 URL（图片/视频直链）
 *   outputDir: 输出目录
 *   type: 'image' | 'video' | 'hls' — 媒体类型
 *   headers: 请求头
 *   hlsOutput: HLS 输出 mp4 路径（type=hls 时）
 */
import type { NodeExecutor } from '../types/workflow';
import { downloadFile, downloadFiles } from '../download/media';
import { downloadHls } from '../download/hls';

export const downloadMediaExecutor: NodeExecutor = async ({ node }) => {
  const { urls, outputDir, type = 'image', headers, hlsOutput } = node.config;

  if (!urls) throw new Error('download_media: urls is required');
  if (!outputDir) throw new Error('download_media: outputDir is required');

  if (type === 'hls') {
    const url = Array.isArray(urls) ? urls[0] : urls;
    if (!url) throw new Error('download_media: hls url is required');
    const output = hlsOutput || `${outputDir}/video_${Date.now()}.mp4`;
    const path = await downloadHls({ url, outputPath: output, headers });
    return { data: { path, type: 'hls' } };
  }

  if (Array.isArray(urls)) {
    const results = await downloadFiles(urls, outputDir, headers);
    return { data: { files: results, count: results.length } };
  }

  const result = await downloadFile({ url: urls, outputDir, headers });
  return { data: { file: result } };
};
