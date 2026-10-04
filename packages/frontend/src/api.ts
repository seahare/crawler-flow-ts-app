/** API 调用封装 */
import type { Workflow, ExecutionStatus } from './types';

const BASE = '';

export async function listWorkflows(): Promise<Workflow[]> {
  const res = await fetch(`${BASE}/api/workflows`);
  return res.json();
}

export async function getWorkflow(id: string): Promise<Workflow> {
  const res = await fetch(`${BASE}/api/workflows/${id}`);
  return res.json();
}

export async function saveWorkflow(wf: Workflow): Promise<Workflow> {
  const res = await fetch(`${BASE}/api/workflows`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(wf),
  });
  return res.json();
}

export async function executeWorkflow(
  id: string,
  opts: { breakpoints?: string[]; step?: boolean; input?: any } = {},
): Promise<{ executionId: string }> {
  const res = await fetch(`${BASE}/api/workflows/${id}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts),
  });
  return res.json();
}

export async function getExecution(id: string): Promise<ExecutionStatus> {
  const res = await fetch(`${BASE}/api/executions/${id}`);
  return res.json();
}

export async function stepExecution(id: string): Promise<void> {
  await fetch(`${BASE}/api/executions/${id}/step`, { method: 'POST' });
}

export async function resumeExecution(id: string): Promise<void> {
  await fetch(`${BASE}/api/executions/${id}/resume`, { method: 'POST' });
}

export async function cancelExecution(id: string): Promise<void> {
  await fetch(`${BASE}/api/executions/${id}/cancel`, { method: 'POST' });
}

export async function getExecutionContext(id: string): Promise<any> {
  const res = await fetch(`${BASE}/api/executions/${id}/context`);
  return res.json();
}
