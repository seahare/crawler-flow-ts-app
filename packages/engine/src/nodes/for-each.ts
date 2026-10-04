/**
 * for_each 节点 — 数组循环迭代
 *
 * 配置：
 *   array: 要迭代的数组（可来自变量引用）
 *   bodyNodeIds: 循环体子图的节点ID列表
 *   itemVar: 当前项变量名（默认 'item'）
 *   indexVar: 当前索引变量名（默认 'index'）
 */
import type { NodeExecutor, NodeInput, Workflow, ExecutionContext } from '../types/workflow';
import { cloneContext, deepInterpolate, setOutput } from '../core/context';
import { registry } from '../core/registry';

export const forEachExecutor: NodeExecutor = async (input: NodeInput) => {
  const { node, context, workflow } = input;
  const { array, bodyNodeIds, itemVar = 'item', indexVar = 'index' } = node.config;

  if (!Array.isArray(array)) {
    throw new Error(`for_each: expected array, got ${typeof array}`);
  }
  if (!bodyNodeIds || !Array.isArray(bodyNodeIds) || bodyNodeIds.length === 0) {
    throw new Error('for_each: bodyNodeIds is required and must be non-empty');
  }

  const results: any[] = [];

  for (let i = 0; i < array.length; i++) {
    const itemCtx = cloneContext(context);
    itemCtx.scope[itemVar] = array[i];
    itemCtx.scope[indexVar] = i;

    const itemResult = await executeBody(bodyNodeIds, itemCtx, workflow);
    results.push(itemResult);
  }

  return {
    data: {
      results,
      count: array.length,
    },
  };
};

async function executeBody(
  bodyNodeIds: string[],
  ctx: ExecutionContext,
  workflow: Workflow,
): Promise<any> {
  const nodeMap = new Map(workflow.nodes.map((n) => [n.id, n]));
  const edgeMap = new Map<string, typeof workflow.edges>();
  for (const e of workflow.edges) {
    if (!edgeMap.has(e.source)) edgeMap.set(e.source, []);
    edgeMap.get(e.source)!.push(e);
  }

  const bodySet = new Set(bodyNodeIds);
  let entryId: string | undefined;
  for (const id of bodyNodeIds) {
    const inEdges = workflow.edges.filter((e) => e.target === id);
    const fromOutside = inEdges.some((e) => !bodySet.has(e.source));
    if (fromOutside || inEdges.length === 0) {
      entryId = id;
      break;
    }
  }
  if (!entryId) entryId = bodyNodeIds[0];

  let lastResult: any;

  const run = async (nodeId: string): Promise<void> => {
    if (!bodySet.has(nodeId)) return;
    const node = nodeMap.get(nodeId);
    if (!node) return;

    const executor = registry.get(node.type);
    if (!executor) throw new Error(`No executor for ${node.type}`);

    // 合并 scope 到 input，方便循环体节点用 input.item 访问
    const bodyCtx = { ...ctx, input: { ...ctx.input, ...ctx.scope } };
    const interpolatedConfig = deepInterpolate(bodyCtx, node.config);
    const result = await executor({
      node: { ...node, config: interpolatedConfig },
      context: bodyCtx,
      workflow,
    });
    setOutput(ctx, nodeId, result.data);
    lastResult = result.data;

    const out = edgeMap.get(nodeId) || [];
    for (const e of out) {
      if (bodySet.has(e.target)) {
        await run(e.target);
      }
    }
  };

  await run(entryId);
  return lastResult;
}
