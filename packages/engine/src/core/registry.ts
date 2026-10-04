/**
 * 节点执行器注册表
 */
import type { NodeExecutor } from '../types/workflow';

class NodeRegistry {
  private executors = new Map<string, NodeExecutor>();
  private schemas = new Map<string, any>();

  register(type: string, executor: NodeExecutor, schema?: any): void {
    this.executors.set(type, executor);
    if (schema) this.schemas.set(type, schema);
  }

  get(type: string): NodeExecutor | undefined {
    return this.executors.get(type);
  }

  has(type: string): boolean {
    return this.executors.has(type);
  }

  getSchema(type: string): any {
    return this.schemas.get(type);
  }

  listTypes(): string[] {
    return Array.from(this.executors.keys());
  }
}

export const registry = new NodeRegistry();

export function registerNode(type: string, executor: NodeExecutor, schema?: any): void {
  registry.register(type, executor, schema);
}
