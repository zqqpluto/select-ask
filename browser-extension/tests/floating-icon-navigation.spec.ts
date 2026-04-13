import { test, expect, Page, BrowserContext, chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const EXTENSION_PATH = path.join(__dirname, '../dist');

const TEST_HTML = `<!DOCTYPE html><html><body><h1>Test</h1><p class="text">Hello World 这是一段测试文本</p></body></html>`;

test.describe('Floating Icon Navigation', () => {
  let context: BrowserContext;
  let page: Page;
  let extensionId: string;
  let testUrl: string;

  test.beforeAll(async () => {
    if (!fs.existsSync(EXTENSION_PATH)) {
      throw new Error(`Extension not found: ${EXTENSION_PATH}. Run npm run build first.`);
    }

    const http = await import('http');
    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(TEST_HTML);
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as any).port;
    testUrl = `http://localhost:${port}`;

    context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        '--no-sandbox',
        '--disable-setuid-sandbox',
      ],
    });

    context.on('page', (newPage) => {
      console.log('>>> 新页面打开:', newPage.url());
    });

    const sw = context.serviceWorkers()[0];
    if (sw) {
      extensionId = sw.url().split('/')[2];
    }

    const pages = context.pages();
    page = pages.length > 0 ? pages[0] : await context.newPage();
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test('悬浮图标存在', async () => {
    await page.goto(testUrl);
    await page.waitForTimeout(2000);
    expect(await page.$('.select-ask-floating-icon')).toBeTruthy();
  });

  test('通过 Service Worker 验证 tabs.create 可用', async () => {
    await page.goto(testUrl);
    await page.waitForTimeout(1000);

    const before = context.pages().length;
    const sw = context.serviceWorkers()[0];
    await sw!.evaluate(() => {
      chrome.tabs.create({ url: chrome.runtime.getURL('src/options/index.html') + '?tab=history' });
    });
    await page.waitForTimeout(2000);

    expect(context.pages().length).toBeGreaterThan(before);
  });

  test('通过 Service Worker 验证带 history 参数跳转', async () => {
    await page.goto(testUrl);
    await page.waitForTimeout(1000);

    const before = context.pages().length;
    const sw = context.serviceWorkers()[0];
    await sw!.evaluate(() => {
      chrome.tabs.create({ url: chrome.runtime.getURL('src/options/index.html') + '?tab=history' });
    });
    await page.waitForTimeout(2000);

    expect(context.pages().length).toBeGreaterThan(before);
    const newPage = context.pages().find(p => p.url().includes('history'));
    expect(newPage).toBeTruthy();
    expect(newPage!.url()).toContain('?tab=history');
  });
});
