/**
 * css_extract 节点 — CSS 选择器 + 正则提取
 */
import type { NodeExecutor } from '../types/workflow';
import { extract, type ExtractRule } from '../extract/extractor';

export const cssExtractExecutor: NodeExecutor = async ({ node }) => {
  const { html, rule } = node.config as { html: string; rule: ExtractRule };

  if (!html) throw new Error('css_extract: html is required');
  if (!rule) throw new Error('css_extract: rule is required');

  const result = extract(html, rule);

  return {
    data: result.items !== undefined ? { items: result.items } : { value: result.value },
  };
};
