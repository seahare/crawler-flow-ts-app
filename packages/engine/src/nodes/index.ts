/**
 * 注册所有内置节点
 */
import { registerNode } from '../core/registry';
import { startExecutor } from './start';
import { httpRequestExecutor } from './http-request';
import { browserNavigateExecutor } from './browser-navigate';
import { cssExtractExecutor } from './css-extract';
import { outputExecutor } from './output';
import { forEachExecutor } from './for-each';
import { ifElseExecutor } from './if-else';
import { codeExecutor } from './code';
import { delayExecutor } from './delay';
import { downloadMediaExecutor } from './download-media';

export function registerAllNodes(): void {
  registerNode('start', startExecutor);
  registerNode('http_request', httpRequestExecutor);
  registerNode('browser_navigate', browserNavigateExecutor);
  registerNode('css_extract', cssExtractExecutor);
  registerNode('output', outputExecutor);
  registerNode('for_each', forEachExecutor);
  registerNode('if_else', ifElseExecutor);
  registerNode('code', codeExecutor);
  registerNode('delay', delayExecutor);
  registerNode('download_media', downloadMediaExecutor);
}
