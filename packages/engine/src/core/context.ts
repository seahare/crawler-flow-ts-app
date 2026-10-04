/**
 * 执行上下文管理器 — 实现变量作用域链与模板插值
 */
import type { ExecutionContext } from '../types/workflow';

/** 创建根上下文 */
export function createContext(input: Record<string, any> = {}): ExecutionContext {
  return {
    global: {},
    outputs: {},
    scope: {},
    input,
  };
}

/** 克隆上下文（用于循环体隔离） */
export function cloneContext(ctx: ExecutionContext): ExecutionContext {
  return {
    global: ctx.global,
    outputs: { ...ctx.outputs },
    scope: { ...ctx.scope },
    input: ctx.input,
  };
}

/**
 * 解析变量引用路径。
 * 支持语法:
 *   {{input.field}}          — 工作流输入
 *   {{global.x}}             — 全局变量
 *   {{nodeId.output}}        — 某节点输出（整个输出）
 *   {{nodeId.output.field}}  — 某节点输出的某个字段
 *   {{scope.item}}           — 当前作用域（如循环项）
 */
export function resolvePath(ctx: ExecutionContext, path: string): any {
  if (!path) return undefined;
  const parts = path.split('.');
  const root = parts[0];
  let obj: any;

  switch (root) {
    case 'input':
      obj = ctx.input;
      break;
    case 'global':
      obj = ctx.global;
      break;
    case 'scope':
      obj = ctx.scope;
      break;
    case 'output':
      // 兼容: {{output.field}} 指代当前节点输出，但执行器内通常用 ctx.outputs
      obj = ctx.outputs;
      break;
    default:
      // nodeId.output.xxx
      if (parts[1] === 'output') {
        obj = ctx.outputs[root];
        const rest = parts.slice(2);
        return getByPath(obj, rest);
      }
      // 尝试作为节点ID
      obj = ctx.outputs[root];
      if (obj !== undefined) {
        const rest = parts.slice(1);
        return getByPath(obj, rest);
      }
      return undefined;
  }

  return getByPath(obj, parts.slice(1));
}

function getByPath(obj: any, parts: string[]): any {
  if (obj === undefined || obj === null) return undefined;
  let cur = obj;
  for (const p of parts) {
    if (cur === undefined || cur === null) return undefined;
    cur = cur[p];
  }
  return cur;
}

/** 模板字符串插值: "hello {{name}}, url={{input.url}}" */
export function interpolate(ctx: ExecutionContext, value: any): any {
  if (typeof value !== 'string') return value;

  // 完整匹配单个变量 — 保留原始类型
  const fullMatch = value.match(/^\{\{\s*([\w.]+)\s*\}\}$/);
  if (fullMatch) {
    return resolvePath(ctx, fullMatch[1]);
  }

  // 字符串内插值
  return value.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path) => {
    const v = resolvePath(ctx, path);
    return v === undefined || v === null ? '' : String(v);
  });
}

/** 深度递归插值对象内所有字符串值 */
export function deepInterpolate(ctx: ExecutionContext, obj: any): any {
  if (typeof obj === 'string') return interpolate(ctx, obj);
  if (Array.isArray(obj)) return obj.map((v) => deepInterpolate(ctx, v));
  if (obj && typeof obj === 'object') {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = deepInterpolate(ctx, v);
    }
    return out;
  }
  return obj;
}

/** 记录节点输出 */
export function setOutput(ctx: ExecutionContext, nodeId: string, data: any): void {
  ctx.outputs[nodeId] = data;
}
