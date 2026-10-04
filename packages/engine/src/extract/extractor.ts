/**
 * 提取引擎 — CSS 选择器 + 正则清洗管道
 */
import * as cheerio from 'cheerio';

export interface FieldRule {
  selector?: string;
  attr?: string; // 提取属性，如 href、src
  regex?: string; // 正则清洗
  capture?: number; // 捕获组索引
  type?: 'string' | 'number' | 'boolean';
  default?: any;
}

export interface ExtractRule {
  selector?: string; // 列表选择器，提取数组
  fields?: Record<string, FieldRule>;
  // 直接提取单个值（非列表）
  single?: FieldRule;
}

export interface ExtractResult {
  items?: any[];
  value?: any;
}

/**
 * 从 HTML 中提取数据
 */
export function extract(html: string, rule: ExtractRule): ExtractResult {
  const $ = cheerio.load(html);
  const result: ExtractResult = {};

  if (rule.selector && rule.fields) {
    // 列表提取
    const items: any[] = [];
    const fields = rule.fields;
    $(rule.selector).each((_, el) => {
      const item: Record<string, any> = {};
      const $el = $(el);
      for (const [field, fieldRule] of Object.entries(fields)) {
        item[field] = extractField($, $el, fieldRule);
      }
      items.push(item);
    });
    result.items = items;
  } else if (rule.single) {
    // 单值提取
    result.value = extractField($, $.root(), rule.single);
  }

  return result;
}

function extractField($: cheerio.CheerioAPI, $scope: cheerio.Cheerio<any>, rule: FieldRule): any {
  let val: any;

  if (rule.selector) {
    const $node = $scope.find(rule.selector).first();
    if (rule.attr) {
      val = $node.attr(rule.attr);
    } else {
      val = $node.text().trim();
    }
  } else {
    val = $scope.text().trim();
  }

  // 正则清洗
  if (rule.regex && typeof val === 'string') {
    const match = val.match(new RegExp(rule.regex));
    if (match) {
      val = rule.capture !== undefined ? match[rule.capture] : match[0];
    } else {
      val = rule.default !== undefined ? rule.default : val;
    }
  }

  // 类型转换
  if (rule.type === 'number' && val !== undefined && val !== null) {
    val = Number(val);
  } else if (rule.type === 'boolean') {
    val = Boolean(val);
  }

  if (val === undefined || val === null || val === '') {
    val = rule.default;
  }

  return val;
}
