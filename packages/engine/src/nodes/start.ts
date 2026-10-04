/**
 * start 节点 — 工作流入口
 */
import type { NodeExecutor } from '../types/workflow';

export const startExecutor: NodeExecutor = async ({ node, context }) => {
  // config.input 是画布上配置的初始数据
  const configInput = node.config.input || {};
  // context.input 是执行时传入的参数（覆盖配置）
  const input = { ...configInput, ...(context.input || {}) };
  return {
    data: input,
  };
};
