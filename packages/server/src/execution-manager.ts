/**
 * 执行管理器 — 管理工作流执行实例
 */
import { WorkflowExecutor, registerAllNodes, type Workflow, type NodeBase, type Edge, type ExecutionEvent } from '@crawl/engine';

registerAllNodes();

/** 前端工作流格式 -> 引擎工作流格式 */
function normalizeWorkflow(wf: any): Workflow {
  const nodes: NodeBase[] = wf.nodes.map((n: any) => ({
    id: n.id,
    type: n.type,
    config: n.config || n.data?.config || {},
    position: n.position,
    data: n.data,
  }));
  const edges: Edge[] = wf.edges.map((e: any) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle,
  }));
  return {
    id: wf.id,
    name: wf.name,
    version: wf.version || '1.0',
    nodes,
    edges,
    metadata: wf.metadata,
    resultColumns: wf.resultColumns,
    lastResult: wf.lastResult,
    lastStatus: wf.lastStatus,
    lastRunAt: wf.lastRunAt,
  };
}

export interface ExecutionInstance {
  id: string;
  workflowId: string;
  executor: WorkflowExecutor;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  events: ExecutionEvent[];
  result?: any;
  error?: string;
}

export class ExecutionManager {
  private instances = new Map<string, ExecutionInstance>();

  create(workflow: Workflow, options: { breakpoints?: string[]; step?: boolean; input?: any } = {}): ExecutionInstance {
    const id = `exec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const breakpoints = options.breakpoints ? new Set(options.breakpoints) : undefined;

    // 规范化工作流格式（兼容前端 data.config 格式）
    const normalizedWf = normalizeWorkflow(workflow);

    const instance: ExecutionInstance = {
      id,
      workflowId: workflow.id,
      executor: null as any,
      status: 'idle',
      events: [],
    };

    const executor = new WorkflowExecutor(normalizedWf, {
      breakpoints,
      step: options.step,
      input: options.input,
      onEvent: (event) => {
        instance.events.push(event);
        if (event.type === 'status') {
          instance.status = event.status;
        }
        if (event.type === 'done') {
          instance.result = event.output;
        }
      },
    });

    instance.executor = executor;
    this.instances.set(id, instance);
    return instance;
  }

  async start(id: string): Promise<any> {
    const inst = this.instances.get(id);
    if (!inst) throw new Error(`Execution ${id} not found`);
    return inst.executor.execute();
  }

  resume(id: string): void {
    const inst = this.instances.get(id);
    if (!inst) throw new Error(`Execution ${id} not found`);
    inst.executor.resume();
  }

  step(id: string): void {
    const inst = this.instances.get(id);
    if (!inst) throw new Error(`Execution ${id} not found`);
    inst.executor.step();
  }

  cancel(id: string): void {
    const inst = this.instances.get(id);
    if (!inst) throw new Error(`Execution ${id} not found`);
    inst.executor.cancel();
  }

  get(id: string): ExecutionInstance | undefined {
    return this.instances.get(id);
  }

  getContext(id: string) {
    const inst = this.instances.get(id);
    if (!inst) throw new Error(`Execution ${id} not found`);
    return inst.executor.getContext();
  }
}
