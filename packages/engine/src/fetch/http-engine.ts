/**
 * HTTP 抓取引擎 — 基于 undici
 */
import { request, Agent } from 'undici';
import type { FetchEngine, FetchRequest, FetchResponse } from './types';

export class HttpEngine implements FetchEngine {
  name = 'http';
  private agent?: Agent;

  constructor() {
    // 全局 agent，支持连接复用
  }

  async fetch(req: FetchRequest): Promise<FetchResponse> {
    const dispatcher = req.proxy ? new Agent({ proxy: req.proxy } as any) : undefined;

    const res = await request(req.url, {
      method: (req.method || 'GET') as any,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        ...req.headers,
      },
      body: req.body,
      bodyTimeout: req.timeout || 30000,
      headersTimeout: req.timeout || 30000,
      dispatcher,
    });

    const body = await res.body.text();
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(res.headers)) {
      headers[k] = String(v);
    }

    return {
      url: req.url,
      status: res.statusCode,
      headers,
      body,
    };
  }
}
