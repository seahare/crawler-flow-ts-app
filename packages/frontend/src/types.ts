/** 工作流类型定义 */

/** 结果列配置 — 动态定义结果表格的列 */
export interface ResultColumn {
  key: string;      // 数据字段路径，如 "title" 或 "nested.url"
  label: string;    // 列标题
  width?: number;   // 列宽
  type?: 'text' | 'link' | 'image' | 'number'; // 列渲染类型
}

export interface WorkflowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: {
    label: string;
    config: Record<string, any>;
  };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
}

export interface Workflow {
  id: string;
  name: string;
  version: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  /** 结果列配置 — 决定结果表格显示哪些字段 */
  resultColumns?: ResultColumn[];
  /** 最近一次执行结果 */
  lastResult?: any;
  /** 最近执行状态 */
  lastStatus?: string;
  /** 最近执行时间 */
  lastRunAt?: number;
}

export interface ExecutionEvent {
  type: string;
  nodeId?: string;
  output?: any;
  error?: string;
  context?: any;
  status?: string;
  timestamp: number;
  [key: string]: any;
}

export interface ExecutionStatus {
  id: string;
  status: string;
  events: ExecutionEvent[];
  result?: any;
  error?: string;
}
