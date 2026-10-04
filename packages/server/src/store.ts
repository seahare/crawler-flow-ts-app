/**
 * 工作流存储服务 — 内存存储（可扩展到数据库）
 */
import type { Workflow } from '@crawl/engine';

export class WorkflowStore {
  private workflows = new Map<string, Workflow>();

  save(wf: Workflow): Workflow {
    this.workflows.set(wf.id, wf);
    return wf;
  }

  get(id: string): Workflow | undefined {
    return this.workflows.get(id);
  }

  list(): Workflow[] {
    return Array.from(this.workflows.values());
  }

  delete(id: string): boolean {
    return this.workflows.delete(id);
  }
}
