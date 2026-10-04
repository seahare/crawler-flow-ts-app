/**
 * 抓取引擎类型定义
 */
export interface FetchRequest {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string | Buffer;
  timeout?: number;
  proxy?: string;
  // 浏览器引擎专属
  waitFor?: string | number; // 选择器 或 毫秒
  actions?: BrowserAction[];
  renderJs?: boolean;
}

export interface BrowserAction {
  type: 'click' | 'scroll' | 'input' | 'wait' | 'evaluate';
  selector?: string;
  value?: string;
  text?: string;
  ms?: number;
}

export interface FetchResponse {
  url: string;
  status: number;
  headers: Record<string, string>;
  body: string;
  // 浏览器引擎返回渲染后的 HTML
  html?: string;
  // 浏览器可返回截图等
  screenshot?: Buffer;
}

export interface FetchEngine {
  name: string;
  fetch(req: FetchRequest): Promise<FetchResponse>;
  close?(): Promise<void>;
}
