/**
 * 无头浏览器抓取引擎 — 基于 Playwright
 *
 * 支持 SPA 渲染、页面交互操作
 */
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import type { FetchEngine, FetchRequest, FetchResponse, BrowserAction } from './types';

export class BrowserEngine implements FetchEngine {
  name = 'browser';
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private maxPages = 5;
  private pageCount = 0;

  private async ensureBrowser(): Promise<BrowserContext> {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      });
    }
    if (!this.context) {
      this.context = await this.browser.newContext({
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        viewport: { width: 1280, height: 800 },
      });
    }
    return this.context;
  }

  async fetch(req: FetchRequest): Promise<FetchResponse> {
    const ctx = await this.ensureBrowser();
    const page: Page = await ctx.newPage();
    this.pageCount++;

    try {
      // 设置请求头
      if (req.headers) {
        await page.setExtraHTTPHeaders(req.headers);
      }

      // 导航
      const resp = await page.goto(req.url, {
        waitUntil: 'domcontentloaded',
        timeout: req.timeout || 30000,
      });

      // 执行交互操作
      if (req.actions) {
        for (const action of req.actions) {
          await this.runAction(page, action);
        }
      }

      // 等待
      if (req.waitFor) {
        if (typeof req.waitFor === 'number') {
          await page.waitForTimeout(req.waitFor);
        } else {
          try {
            await page.waitForSelector(req.waitFor, { timeout: 10000 });
          } catch {
            // 选择器未出现，忽略
          }
        }
      } else if (req.renderJs !== false) {
        // 默认等待网络空闲
        try {
          await page.waitForLoadState('networkidle', { timeout: 8000 });
        } catch {
          // 超时忽略
        }
      }

      const html = await page.content();
      const status = resp?.status() || 200;
      const headers: Record<string, string> = {};
      if (resp) {
        for (const [k, v] of Object.entries(resp.headers())) {
          headers[k] = v;
        }
      }

      return {
        url: page.url(),
        status,
        headers,
        body: html,
        html,
      };
    } finally {
      await page.close();
      this.pageCount--;
    }
  }

  private async runAction(page: Page, action: BrowserAction): Promise<void> {
    switch (action.type) {
      case 'click':
        if (action.selector) await page.click(action.selector).catch(() => {});
        break;
      case 'scroll':
        await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
        break;
      case 'input':
        if (action.selector && action.value !== undefined) {
          await page.fill(action.selector, action.value).catch(() => {});
        }
        break;
      case 'wait':
        await page.waitForTimeout(action.ms || 1000);
        break;
      case 'evaluate':
        if (action.text) {
          try {
            await page.evaluate(action.text);
          } catch {
            // ignore
          }
        }
        break;
    }
  }

  async close(): Promise<void> {
    if (this.context) {
      await this.context.close();
      this.context = null;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
