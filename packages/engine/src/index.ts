/**
 * @crawl/engine — 爬虫编排核心引擎
 */

// 类型
export type {
  Workflow,
  NodeBase,
  Edge,
  NodeInput,
  NodeOutput,
  NodeExecutor,
  ExecutionContext,
  ExecutionOptions,
  ExecutionEvent,
  ExecutionStatus,
  LogEntry,
} from './types/workflow';

// 核心
export { WorkflowExecutor } from './core/executor';
export { registry, registerNode } from './core/registry';
export {
  createContext,
  cloneContext,
  resolvePath,
  interpolate,
  deepInterpolate,
  setOutput,
} from './core/context';

// 抓取引擎
export { HttpEngine } from './fetch/http-engine';
export { BrowserEngine } from './fetch/browser-engine';
export type { FetchEngine, FetchRequest, FetchResponse, BrowserAction } from './fetch/types';

// 提取引擎
export { extract } from './extract/extractor';
export type { ExtractRule, FieldRule, ExtractResult } from './extract/extractor';

// 下载
export { downloadFile, downloadFiles } from './download/media';
export { downloadHls } from './download/hls';

// 节点注册
export { registerAllNodes } from './nodes';
