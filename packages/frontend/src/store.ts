import { create } from 'zustand';
import type { Workflow, WorkflowNode, WorkflowEdge, ExecutionEvent, ResultColumn } from './types';

export type View = 'dashboard' | 'editor' | 'results';

interface FlowState {
  workflow: Workflow;
  selectedNodeId: string | null;
  breakpoints: Set<string>;
  executionId: string | null;
  executionStatus: string;
  events: ExecutionEvent[];
  activeNodeId: string | null;
  result: any;

  // 视图导航
  view: View;
  currentTaskId: string | null;

  setWorkflow: (wf: Workflow) => void;
  updateNode: (id: string, patch: Partial<WorkflowNode>) => void;
  updateNodeConfig: (id: string, config: Record<string, any>) => void;
  setSelectedNode: (id: string | null) => void;
  toggleBreakpoint: (id: string) => void;
  setExecution: (id: string | null) => void;
  setExecutionStatus: (status: string) => void;
  addEvent: (ev: ExecutionEvent) => void;
  clearEvents: () => void;
  setActiveNode: (id: string | null) => void;
  setResult: (r: any) => void;
  setView: (v: View) => void;
  setCurrentTaskId: (id: string | null) => void;
  setResultColumns: (cols: ResultColumn[]) => void;
}

export const useFlowStore = create<FlowState>((set) => ({
  workflow: {
    id: 'default',
    name: '新工作流',
    version: '1.0',
    nodes: [],
    edges: [],
    resultColumns: [],
  },
  selectedNodeId: null,
  breakpoints: new Set(),
  executionId: null,
  executionStatus: 'idle',
  events: [],
  activeNodeId: null,
  result: null,

  view: 'dashboard',
  currentTaskId: null,

  setWorkflow: (wf) => set({ workflow: wf }),
  updateNode: (id, patch) =>
    set((s) => ({
      workflow: {
        ...s.workflow,
        nodes: s.workflow.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)),
      },
    })),
  updateNodeConfig: (id, config) =>
    set((s) => ({
      workflow: {
        ...s.workflow,
        nodes: s.workflow.nodes.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, config } } : n,
        ),
      },
    })),
  setSelectedNode: (id) => set({ selectedNodeId: id }),
  toggleBreakpoint: (id) =>
    set((s) => {
      const bp = new Set(s.breakpoints);
      if (bp.has(id)) bp.delete(id);
      else bp.add(id);
      return { breakpoints: bp };
    }),
  setExecution: (id) => set({ executionId: id, events: [], result: null }),
  setExecutionStatus: (status) => set({ executionStatus: status }),
  addEvent: (ev) => set((s) => ({ events: [...s.events, ev] })),
  clearEvents: () => set({ events: [], result: null }),
  setActiveNode: (id) => set({ activeNodeId: id }),
  setResult: (r) => set({ result: r }),
  setView: (v) => set({ view: v }),
  setCurrentTaskId: (id) => set({ currentTaskId: id }),
  setResultColumns: (cols) =>
    set((s) => ({ workflow: { ...s.workflow, resultColumns: cols } })),
}));
