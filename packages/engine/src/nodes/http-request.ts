/**
 * http_request 节点 — HTTP 抓取
 */
import type { NodeExecutor } from '../types/workflow';
import { HttpEngine } from '../fetch/http-engine';

const httpEngine = new HttpEngine();

export const httpRequestExecutor: NodeExecutor = async ({ node }) => {
  const { url, method, headers, body, timeout, proxy } = node.config;

  if (!url) throw new Error('http_request: url is required');

  const resp = await httpEngine.fetch({
    url,
    method: method || 'GET',
    headers,
    body,
    timeout,
    proxy,
  });

  // 尝试解析 JSON
  let jsonData: any = undefined;
  if (resp.headers['content-type']?.includes('application/json')) {
    try {
      jsonData = JSON.parse(resp.body);
    } catch {}
  }

  return {
    data: {
      status: resp.status,
      headers: resp.headers,
      body: resp.body,
      json: jsonData,
      url: resp.url,
    },
  };
};
