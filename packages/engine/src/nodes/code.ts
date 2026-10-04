/**
 * code 节点 — 执行自定义 JavaScript
 *
 * 配置：
 *   code: JS 代码字符串
 *   可用变量: input, global, scope, outputs (各节点输出), $helpers (工具函数)
 *   通过 return 返回结果
 */
import type { NodeExecutor } from '../types/workflow';

export const codeExecutor: NodeExecutor = async ({ node, context }) => {
  const { code } = node.config;

  if (!code) throw new Error('code: code is required');

  const helpers = {
    sleep: (ms: number) => new Promise((r) => setTimeout(r, ms)),
    fetch: async (url: string, opts?: any) => {
      const { request } = await import('undici');
      const res = await request(url, opts);
      return { status: res.statusCode, body: await res.body.text(), headers: res.headers };
    },
  };

  const fn = new Function(
    'input',
    'global',
    'scope',
    'outputs',
    '$helpers',
    `"use strict"; return (async () => { ${code} })();`,
  );

  const result = await fn(context.input, context.global, context.scope, context.outputs, helpers);

  return { data: result };
};
