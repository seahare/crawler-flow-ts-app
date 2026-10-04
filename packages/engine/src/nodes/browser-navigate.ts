/**
 * browser_navigate 节点 — 无头浏览器抓取 SPA
 */
import type { NodeExecutor } from '../types/workflow';
import { BrowserEngine } from '../fetch/browser-engine';

let browserEngine: BrowserEngine | null = null;

function getEngine() {
  if (!browserEngine) browserEngine = new BrowserEngine();
  return browserEngine;
}

export const browserNavigateExecutor: NodeExecutor = async ({ node }) => {
  const { url, waitFor, actions, headers, timeout } = node.config;

  if (!url) throw new Error('browser_navigate: url is required');

  const engine = getEngine();
  const resp = await engine.fetch({
    url,
    waitFor,
    actions,
    headers,
    timeout,
  });

  return {
    data: {
      status: resp.status,
      headers: resp.headers,
      html: resp.html || resp.body,
      body: resp.body,
      url: resp.url,
    },
  };
};
