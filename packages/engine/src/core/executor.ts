/**
 * DAG 执行器
 *
 * 执行模型：
 * - 从 start 节点开始，沿 edges 顺序执行
 * - if_else 节点：根据 sourceHandle="true"/"false" 选择分支边
 * - for_each 节点：config.bodyNodeIds 指定循环体子图，对数组每项独立执行子图
 * - 普通节点：执行完后走所有出边（支持并行，但此处简化为顺序）
 */
import type {
  Workflow,
  NodeBase,
  Edge,
  ExecutionContext,
  ExecutionOptions,
  ExecutionEvent,
  NodeOutput,
  ExecutionStatus,
} from '../types/workflow';
import { registry } from './registry';
import { createContext, cloneContext, deepInterpolate, setOutput } from './context';

interface ExecutionGraph {
  nodes: Map<string, NodeBase>;
  // 节点ID -> 出边列表
  outEdges: Map<string, Edge[]>;
  // 节点ID -> 入边列表
  inEdges: Map<string, Edge[]>;
}

export class WorkflowExecutor {
  private status: ExecutionStatus = 'idle';
  private ctx: ExecutionContext;
  private graph: ExecutionGraph;
  private options: ExecutionOptions;
  private paused = false;
  private cancelled = false;
  private stepMode = false;
  private breakpoints: Set<string>;

  constructor(private workflow: Workflow, options: ExecutionOptions = {}) {
    this.options = options;
    this.ctx = createContext(options.input || {});
    this.breakpoints = options.breakpoints || new Set();
    this.stepMode = !!options.step;
    this.graph = this.buildGraph(workflow);
  }

  private buildGraph(wf: Workflow): ExecutionGraph {
    const nodes = new Map<string, NodeBase>();
    const outEdges = new Map<string, Edge[]>();
    const inEdges = new Map<string, Edge[]>();

    for (const n of wf.nodes) {
      nodes.set(n.id, n);
      outEdges.set(n.id, []);
      inEdges.set(n.id, []);
    }
    for (const e of wf.edges) {
      outEdges.get(e.source)?.push(e);
      inEdges.get(e.target)?.push(e);
    }
    return { nodes, outEdges, inEdges };
  }

  private emit(event: ExecutionEvent): void {
    this.options.onEvent?.(event);
  }

  private findStartNode(): NodeBase | undefined {
    // 优先 type=start
    for (const n of this.workflow.nodes) {
      if (n.type === 'start') return n;
    }
    // 否则找无入边的节点
    for (const [id, edges] of this.graph.inEdges) {
      if (edges.length === 0) return this.graph.nodes.get(id);
    }
    return this.workflow.nodes[0];
  }

  /** 执行整个工作流 */
  async execute(): Promise<any> {
    this.status = 'running';
    this.emit({ type: 'status', status: 'running' });

    const start = this.findStartNode();
    if (!start) {
      throw new Error('Workflow has no start node');
    }

    try {
      await this.executeNode(start);
      // 主流程执行完后，从 start 沿出边继续
      const result = this.ctx.outputs;
      this.status = 'completed';
      this.emit({ type: 'status', status: 'completed' });
      this.emit({ type: 'done', output: result });
      return result;
    } catch (err: any) {
      this.status = 'failed';
      this.emit({ type: 'status', status: 'failed' });
      throw err;
    }
  }

  /** 执行单个节点及其后续（递归） */
  private async executeNode(node: NodeBase): Promise<void> {
    if (this.cancelled) return;

    // 断点检查
    if (this.breakpoints.has(node.id) || this.stepMode) {
      this.paused = true;
      this.emit({
        type: 'node:breakpoint',
        nodeId: node.id,
        context: this.ctx,
        timestamp: Date.now(),
      });
      await this.waitForResume();
      if (this.cancelled) return;
    }

    this.emit({ type: 'node:start', nodeId: node.id, timestamp: Date.now() });

    const executor = registry.get(node.type);
    if (!executor) {
      throw new Error(`No executor registered for node type: ${node.type}`);
    }

    try {
      // 合并上游节点输出作为当前节点的 input
      const upstreamInput = this.mergeUpstreamOutputs(node);
      const nodeCtx = { ...this.ctx, input: upstreamInput };

      // 插值配置中的模板变量
      const interpolatedConfig = deepInterpolate(nodeCtx, node.config);
      const nodeWithInterp = { ...node, config: interpolatedConfig };

      const result: NodeOutput = await executor({
        node: nodeWithInterp,
        context: nodeCtx,
        workflow: this.workflow,
      });

      setOutput(this.ctx, node.id, result.data);
      this.emit({
        type: 'node:end',
        nodeId: node.id,
        output: result.data,
        timestamp: Date.now(),
      });

      // 决定后继节点
      const next = this.getNextNodes(node, result);
      for (const nxt of next) {
        await this.executeNode(nxt);
      }
    } catch (err: any) {
      this.emit({
        type: 'node:error',
        nodeId: node.id,
        error: err.message || String(err),
        timestamp: Date.now(),
      });
      throw err;
    }
  }

  /** 合并上游节点输出作为当前节点的 input */
  private mergeUpstreamOutputs(node: NodeBase): Record<string, any> {
    const inEdges = this.graph.inEdges.get(node.id) || [];
    if (inEdges.length === 0) {
      // 无入边（如 start 节点）：使用工作流初始输入
      return this.ctx.input;
    }
    // 合并所有上游节点输出
    const merged: Record<string, any> = {};
    for (const e of inEdges) {
      const upstreamOut = this.ctx.outputs[e.source];
      if (upstreamOut && typeof upstreamOut === 'object') {
        Object.assign(merged, upstreamOut);
      }
    }
    return merged;
  }

  /** 获取下一个要执行的节点列表 */
  private getNextNodes(node: NodeBase, result: NodeOutput): NodeBase[] {
    const edges = this.graph.outEdges.get(node.id) || [];
    if (edges.length === 0) return [];

    // 条件分支节点：通过 sourceHandle 选择
    if (node.type === 'if_else' || node.type === 'switch') {
      const handle = result.next || 'true';
      const matched = edges.filter((e) => e.sourceHandle === handle);
      if (matched.length > 0) {
        return matched.map((e) => this.graph.nodes.get(e.target)!).filter(Boolean);
      }
      // 没有匹配的分支，尝试没有 handle 的默认边
      const def = edges.filter((e) => !e.sourceHandle);
      return def.map((e) => this.graph.nodes.get(e.target)!).filter(Boolean);
    }

    // for_each 节点：跳过指向循环体(bodyNodeIds)的边，避免重复执行
    if (node.type === 'for_each') {
      const bodyIds = new Set(node.config.bodyNodeIds || []);
      const nonBody = edges.filter((e) => !bodyIds.has(e.target));
      return nonBody.map((e) => this.graph.nodes.get(e.target)!).filter(Boolean);
    }

    // 普通节点：所有出边
    return edges.map((e) => this.graph.nodes.get(e.target)!).filter(Boolean);
  }

  /** 执行循环体子图（for_each 节点调用） */
  async executeLoopBody(bodyNodeIds: string[], itemCtx: ExecutionContext): Promise<void> {
    // 临时切换上下文
    const savedCtx = this.ctx;
    this.ctx = itemCtx;
    try {
      // 找到循环体入口：bodyNodeIds 中无入边（在子图内）的节点
      // 简化：执行 bodyNodeIds 中第一个节点，由它沿边继续
      // 但要限制只在 bodyNodeIds 内执行
      const bodySet = new Set(bodyNodeIds);
      const entry = this.findLoopEntry(bodyNodeIds);
      if (entry) {
        await this.executeSubgraph(entry, bodySet);
      }
    } finally {
      this.ctx = savedCtx;
    }
  }

  private findLoopEntry(bodyNodeIds: string[]): NodeBase | undefined {
    // 入口：在 bodyNodeIds 中，入边的 source 不在 bodyNodeIds 内，或无入边
    for (const id of bodyNodeIds) {
      const inEdges = this.graph.inEdges.get(id) || [];
      const fromOutside = inEdges.some((e) => !bodyNodeIds.includes(e.source));
      if (inEdges.length === 0 || fromOutside) {
        return this.graph.nodes.get(id);
      }
    }
    return bodyNodeIds[0] ? this.graph.nodes.get(bodyNodeIds[0]) : undefined;
  }

  /** 在限定节点集合内执行子图 */
  private async executeSubgraph(start: NodeBase, allowed: Set<string>): Promise<void> {
    const execute = async (node: NodeBase): Promise<void> => {
      if (this.cancelled) return;
      if (!allowed.has(node.id)) return;

      this.emit({ type: 'node:start', nodeId: node.id, timestamp: Date.now() });
      const executor = registry.get(node.type);
      if (!executor) throw new Error(`No executor for ${node.type}`);

      // 合并上游输出（子图内）
      const subInEdges = this.graph.inEdges.get(node.id) || [];
      let subInput: Record<string, any>;
      if (subInEdges.length === 0) {
        subInput = { ...this.ctx.input, ...this.ctx.scope };
      } else {
        subInput = { ...this.ctx.scope };
        for (const e of subInEdges) {
          const up = this.ctx.outputs[e.source];
          if (up && typeof up === 'object') Object.assign(subInput, up);
        }
      }
      const subCtx = { ...this.ctx, input: subInput };

      const interpolatedConfig = deepInterpolate(subCtx, node.config);
      const result = await executor({
        node: { ...node, config: interpolatedConfig },
        context: subCtx,
        workflow: this.workflow,
      });
      setOutput(this.ctx, node.id, result.data);
      this.emit({ type: 'node:end', nodeId: node.id, output: result.data, timestamp: Date.now() });

      const edges = this.graph.outEdges.get(node.id) || [];
      for (const e of edges) {
        if (allowed.has(e.target)) {
          const tgt = this.graph.nodes.get(e.target);
          if (tgt) await execute(tgt);
        }
      }
    };
    await execute(start);
  }

  // —— 调试控制 ——

  private resumePromise: (() => void) | null = null;

  private waitForResume(): Promise<void> {
    if (!this.paused) return Promise.resolve();
    return new Promise((resolve) => {
      this.resumePromise = resolve;
    });
  }

  resume(): void {
    this.paused = false;
    this.stepMode = false; // 恢复时关闭单步模式
    this.resumePromise?.();
    this.resumePromise = null;
  }

  step(): void {
    // 单步：恢复一次，执行到下一个节点再暂停
    this.stepMode = true;
    this.resume();
  }

  cancel(): void {
    this.cancelled = true;
    this.status = 'cancelled';
    this.resume();
  }

  getStatus(): ExecutionStatus {
    return this.status;
  }

  getContext(): ExecutionContext {
    return this.ctx;
  }
}
