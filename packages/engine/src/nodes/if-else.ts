/**
 * if_else 节点 — 条件分支
 *
 * 配置：
 *   expression: JS 表达式字符串，可引用 input/global/scope/nodeId.output.xxx
 *   例如: "{{input.age}} > 18" 或 "{{scope.item.status}} === 'active'"
 *
 * 执行后返回 next: 'true' 或 'false'，执行器根据 sourceHandle 选择分支边。
 */
import type { NodeExecutor } from '../types/workflow';
import { interpolate } from '../core/context';

export const ifElseExecutor: NodeExecutor = async ({ node, context }) => {
  const { expression } = node.config;

  if (!expression) throw new Error('if_else: expression is required');

  // 先做变量插值，再用 Function 求值
  const interpolated = interpolate(context, expression);

  let condition: boolean;
  try {
    // 安全求值（仅用于布尔判断）
    // eslint-disable-next-line no-new-func
    condition = Boolean(new Function(`return (${interpolated});`)());
  } catch (e) {
    throw new Error(`if_else: failed to evaluate expression "${interpolated}": ${(e as Error).message}`);
  }

  return {
    data: { condition, expression: interpolated },
    next: condition ? 'true' : 'false',
  };
};
