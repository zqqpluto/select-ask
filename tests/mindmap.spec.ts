import { test, expect, Page, BrowserContext, chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const EXTENSION_PATH = path.join(__dirname, '../dist');

test.describe('脑图功能 E2E', () => {
  let context: BrowserContext;
  let page: Page;
  let extensionId: string;

  test.beforeAll(async () => {
    if (!fs.existsSync(EXTENSION_PATH)) {
      throw new Error(`Extension not found: ${EXTENSION_PATH}. Run "npm run build" first.`);
    }

    context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        '--no-sandbox',
        '--disable-setuid-sandbox',
      ],
    });

    await context.waitForEvent('serviceworker');
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
    await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const floatingIcon = await page.$('.select-ask-floating-icon');
    expect(floatingIcon).toBeTruthy();
  });

  test('hover 弹出菜单并包含脑图选项', async () => {
    await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const floatingIcon = page.locator('.select-ask-floating-icon-btn');
    await floatingIcon.hover();
    await page.waitForTimeout(600);

    const menu = page.locator('.select-ask-floating-icon-menu');
    await expect(menu).toBeVisible();

    const mindmapItem = page.locator('[data-action="mindmap-page"]');
    await expect(mindmapItem).toBeVisible();

    const tooltip = await mindmapItem.getAttribute('data-tooltip');
    expect(tooltip).toBe('生成脑图');
  });

  test('侧边栏脑图按钮在有 pageUrl 时渲染', async () => {
    const sidePanelUrl = `chrome-extension://${extensionId}/src/side-panel/index.html`;
    const sidePanelPage = await context.newPage();
    await sidePanelPage.goto(sidePanelUrl);
    await sidePanelPage.waitForLoadState('domcontentloaded');

    // 设置 pending_sidebar_init
    await sidePanelPage.evaluate(() => {
      return new Promise<void>((resolve) => {
        chrome.storage.local.set({
          pending_sidebar_init: {
            selectedText: '',
            context: null,
            userMessage: '',
            summaryPrompt: null,
            pageUrl: 'https://example.com',
            pageTitle: 'Example',
          },
        }, () => resolve());
      });
    });

    await sidePanelPage.waitForTimeout(2000);

    const mindmapBtn = await sidePanelPage.$('.side-panel-mindmap-btn');
    expect(mindmapBtn).not.toBeNull();

    const btnText = await mindmapBtn?.textContent();
    expect(btnText?.trim()).toBe('脑图');

    await sidePanelPage.close();
  });

  test('markmap SVG 节点和连线渲染', async () => {
    const testHtml = `file://${path.join(__dirname, 'fixtures', 'mindmap-render-test.html')}`;
    const testPage = await context.newPage();
    await testPage.goto(testHtml, { waitUntil: 'domcontentloaded' });
    await testPage.waitForTimeout(10000);

    const result = await testPage.evaluate(() => (window as any).__mindmapTestResult__);
    expect(result.status).toBe('PASS');
    expect(result.nodeCount).toBeGreaterThan(0);
    expect(result.linkCount).toBeGreaterThan(0);
    expect(result.hasNaN).toBe(false);

    await testPage.close();
  });
});
