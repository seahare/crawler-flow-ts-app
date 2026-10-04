/**
 * 节点配置 Schema — 驱动属性面板表单生成
 */
export interface NodeField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'select' | 'json' | 'checkbox';
  options?: { label: string; value: any }[];
  default?: any;
  placeholder?: string;
  help?: string;
}

export interface NodeConfig {
  type: string;
  label: string;
  category: 'input' | 'fetch' | 'extract' | 'control' | 'output' | 'download' | 'util';
  color: string;
  icon: string;
  fields: NodeField[];
}

export const NODE_CONFIGS: NodeConfig[] = [
  {
    type: 'start',
    label: '开始',
    category: 'input',
    color: '#10b981',
    icon: '▶',
    fields: [
      { key: 'initialData', label: '初始数据', type: 'json', default: {}, help: '工作流初始参数，JSON 格式' },
    ],
  },
  {
    type: 'http_request',
    label: 'HTTP 请求',
    category: 'fetch',
    color: '#3b82f6',
    icon: '🌐',
    fields: [
      { key: 'url', label: 'URL', type: 'text', placeholder: 'https://example.com' },
      { key: 'method', label: '方法', type: 'select', default: 'GET', options: [
        { label: 'GET', value: 'GET' }, { label: 'POST', value: 'POST' },
        { label: 'PUT', value: 'PUT' }, { label: 'DELETE', value: 'DELETE' },
      ]},
      { key: 'headers', label: '请求头', type: 'json', default: {} },
      { key: 'body', label: '请求体', type: 'textarea' },
      { key: 'timeout', label: '超时(ms)', type: 'number', default: 30000 },
    ],
  },
  {
    type: 'browser_navigate',
    label: '浏览器导航',
    category: 'fetch',
    color: '#6366f1',
    icon: '🖥',
    fields: [
      { key: 'url', label: 'URL', type: 'text', placeholder: 'https://spa.example.com' },
      { key: 'waitFor', label: '等待', type: 'text', placeholder: '选择器 或 毫秒数', help: '如 ".content" 或 3000' },
      { key: 'headers', label: '请求头', type: 'json', default: {} },
      { key: 'timeout', label: '超时(ms)', type: 'number', default: 30000 },
    ],
  },
  {
    type: 'css_extract',
    label: 'CSS 提取',
    category: 'extract',
    color: '#f59e0b',
    icon: '🔍',
    fields: [
      { key: 'html', label: 'HTML 来源', type: 'text', placeholder: '{{nodeId.output.html}}' },
      { key: 'rule', label: '提取规则', type: 'json', default: {
        selector: '.item',
        fields: { title: { selector: '.title' } },
      }, help: 'JSON: { selector, fields: { field: { selector, regex, capture, type } } }' },
    ],
  },
  {
    type: 'for_each',
    label: '循环',
    category: 'control',
    color: '#8b5cf6',
    icon: '🔄',
    fields: [
      { key: 'array', label: '数组来源', type: 'text', placeholder: '{{nodeId.output.items}}' },
      { key: 'bodyNodeIds', label: '循环体节点ID', type: 'json', default: [], help: '循环体内的节点ID列表' },
      { key: 'itemVar', label: '项变量名', type: 'text', default: 'item' },
      { key: 'indexVar', label: '索引变量名', type: 'text', default: 'index' },
    ],
  },
  {
    type: 'if_else',
    label: '条件分支',
    category: 'control',
    color: '#ec4899',
    icon: '❓',
    fields: [
      { key: 'expression', label: '条件表达式', type: 'text', placeholder: '{{nodeId.output.value}} > 10' },
    ],
  },
  {
    type: 'code',
    label: '自定义代码',
    category: 'util',
    color: '#64748b',
    icon: '⚡',
    fields: [
      { key: 'code', label: 'JavaScript 代码', type: 'textarea', default: 'return { result: "hello" };', help: '可用变量: input, global, scope, outputs, $helpers' },
    ],
  },
  {
    type: 'delay',
    label: '延时',
    category: 'util',
    color: '#94a3b8',
    icon: '⏱',
    fields: [
      { key: 'ms', label: '毫秒', type: 'number', default: 1000 },
    ],
  },
  {
    type: 'download_media',
    label: '媒体下载',
    category: 'download',
    color: '#06b6d4',
    icon: '⬇',
    fields: [
      { key: 'urls', label: 'URL(s)', type: 'text', placeholder: '{{nodeId.output.url}}' },
      { key: 'outputDir', label: '输出目录', type: 'text', default: '/tmp/crawler' },
      { key: 'type', label: '类型', type: 'select', default: 'image', options: [
        { label: '图片', value: 'image' }, { label: '视频', value: 'video' }, { label: 'HLS', value: 'hls' },
      ]},
      { key: 'headers', label: '请求头', type: 'json', default: {} },
    ],
  },
  {
    type: 'output',
    label: '输出',
    category: 'output',
    color: '#ef4444',
    icon: '📤',
    fields: [
      { key: 'from', label: '来源节点ID', type: 'text', placeholder: 'nodeId' },
      { key: 'data', label: '固定数据', type: 'json', default: {} },
    ],
  },
];

export function getNodeConfig(type: string): NodeConfig | undefined {
  return NODE_CONFIGS.find((c) => c.type === type);
}
