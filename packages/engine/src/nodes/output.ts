/**
 * output 节点 — 工作流输出
 */
import type { NodeExecutor } from '../types/workflow';

export const outputExecutor: NodeExecutor = async ({ node, context }) => {
  const { data, from } = node.config;

  // 如果指定 from，从某节点输出取数据
  if (from) {
    return { data: context.outputs[from] };
  }
  // 如果指定了 data，直接返回
  if (data !== undefined) {
    return { data };
  }
  // 默认：返回所有节点输出（浅拷贝避免循环引用）
  return { data: { ...context.outputs } };
};
