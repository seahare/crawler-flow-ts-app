/**
 * 工作流模型类型定义
 */

/** 节点基础配置 */
export interface NodeBase {
  id: string;
  type: string;
  config: Record<string, any>;
  position?: { x: number; y: number };
  data?: Record<string, any>;
}

/** 边 */
export interface Edge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string; // 用于条件分支: "true" | "false"
}

/** 工作流定义 */
export interface Workflow {
  id: string;
  name: string;
  version: string;
  nodes: NodeBase[];
  edges: Edge[];
  metadata?: Record<string, any>;
  /** 结果列配置 */
  resultColumns?: { key: string; label: string; width?: number; type?: string }[];
  /** 最近执行结果 */
  lastResult?: any;
  /** 最近执行状态 */
  lastStatus?: string;
  /** 最近执行时间 */
  lastRunAt?: number;
}

/** 节点执行输入 */
export interface NodeInput {
  node: NodeBase;
  context: ExecutionContext;
  workflow: Workflow;
}

/** 节点执行输出 */
export interface NodeOutput {
  data: any;
  logs?: LogEntry[];
  next?: string; // 下一个要执行的节点ID（用于条件分支覆盖默认行为）
}

/** 日志条目 */
export interface LogEntry {
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  timestamp: number;
  nodeId?: string;
}

/** 执行上下文 — 变量作用域链 */
export interface ExecutionContext {
  /** 全局变量 */
  global: Record<string, any>;
  /** 各节点的输出: nodeId -> output data */
  outputs: Record<string, any>;
  /** 当前作用域变量（循环体内部等） */
  scope: Record<string, any>;
  /** 输入参数 */
  input: Record<string, any>;
}

/** 节点执行器 */
export type NodeExecutor = (input: NodeInput) => Promise<NodeOutput>;

/** 执行状态 */
export type ExecutionStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

/** 执行事件 */
export type ExecutionEvent =
  | { type: 'node:start'; nodeId: string; timestamp: number }
  | { type: 'node:end'; nodeId: string; output: any; timestamp: number }
  | { type: 'node:error'; nodeId: string; error: string; timestamp: number }
  | { type: 'node:breakpoint'; nodeId: string; context: ExecutionContext; timestamp: number }
  | { type: 'log'; entry: LogEntry }
  | { type: 'status'; status: ExecutionStatus }
  | { type: 'done'; output: any };

/** 执行选项 */
export interface ExecutionOptions {
  breakpoints?: Set<string>;
  step?: boolean; // 单步模式
  input?: Record<string, any>;
  onEvent?: (event: ExecutionEvent) => void;
}
