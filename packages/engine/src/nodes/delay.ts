/**
 * delay 节点 — 延时等待
 */
import type { NodeExecutor } from '../types/workflow';

export const delayExecutor: NodeExecutor = async ({ node }) => {
  const { ms = 1000 } = node.config;
  await new Promise((r) => setTimeout(r, ms));
  return { data: { delayed: ms } };
};
