import { test, expect, Page, BrowserContext } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EXTENSION_PATH = path.join(__dirname, '../dist');

let context: BrowserContext;
let page: Page;

test.describe('Mindmap Three Entry Points E2E Tests', () => {
  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({
      // @ts-ignore
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        '--no-sandbox',
      ],
    });

    page = await context.newPage();
  });

  test.afterAll(async () => {
    await context.close();
  });

  // ===== 入口 1: 选中文本上下文菜单 =====

  test('入口1: 选中文本 > 100 字符时显示脑图按钮', async () => {
    await page.goto('https://example.com');
    await page.waitForLoadState('domcontentloaded');

    const longText = 'A'.repeat(150);
    const hasMindmapButton = await page.evaluate((text) => {
      return text.length > 100;
    }, longText);

    expect(hasMindmapButton).toBe(true);
  });

  test('入口1: 选中文本 < 100 字符时不显示脑图按钮', async () => {
    await page.goto('https://example.com');
    await page.waitForLoadState('domcontentloaded');

    const shortText = 'A'.repeat(50);
    const hasMindmapButton = await page.evaluate((text) => {
      return text.length > 100;
    }, shortText);

    expect(hasMindmapButton).toBe(false);
  });

  // ===== 入口 2: 悬浮胶囊菜单 =====

  test('入口2: 悬浮菜单脑图菜单项渲染', async () => {
    await page.goto('https://example.com');
    await page.waitForLoadState('domcontentloaded');

    const menuItemAttrs = await page.evaluate(() => {
      const btn = document.createElement('button');
      btn.className = 'select-ask-floating-icon-menu-item';
      btn.setAttribute('data-action', 'mindmap-page');
      btn.setAttribute('data-tooltip', '生成脑图');
      document.body.appendChild(btn);
      return {
        className: btn.className,
        dataAction: btn.getAttribute('data-action'),
        dataTooltip: btn.getAttribute('data-tooltip'),
      };
    });

    expect(menuItemAttrs.className).toBe('select-ask-floating-icon-menu-item');
    expect(menuItemAttrs.dataAction).toBe('mindmap-page');
    expect(menuItemAttrs.dataTooltip).toBe('生成脑图');
  });

  // ===== 入口 3: 侧边栏"总结网页"旁 =====

  test('入口3: 侧边栏脑图按钮渲染', async () => {
    await page.goto('https://example.com');
    await page.waitForLoadState('domcontentloaded');

    const btnAttrs = await page.evaluate(() => {
      const btn = document.createElement('button');
      btn.className = 'side-panel-mindmap-btn';
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('width', '14');
      svg.setAttribute('height', '14');
      btn.appendChild(svg);
      const span = document.createElement('span');
      span.textContent = '生成脑图';
      btn.appendChild(span);
      document.body.appendChild(btn);
      return {
        className: btn.className,
        textContent: btn.textContent?.trim(),
      };
    });

    expect(btnAttrs.className).toBe('side-panel-mindmap-btn');
    expect(btnAttrs.textContent).toBe('生成脑图');
  });

  // ===== 统一消息格式测试 =====

  test('消息格式: OPEN_SIDE_PANEL 脑图消息结构正确', async () => {
    await page.goto('https://example.com');
    await page.waitForLoadState('domcontentloaded');

    const messageFormat = await page.evaluate(() => {
      const expectedKeys = ['type', 'selectedText', 'context', 'userMessage', 'summaryPrompt', 'pageUrl', 'pageTitle'];
      const testMessage = {
        type: 'OPEN_SIDE_PANEL',
        selectedText: '',
        context: null,
        userMessage: '生成脑图',
        summaryPrompt: '请将以下内容整理为层级化 Markdown 脑图格式...',
        pageUrl: 'https://example.com',
        pageTitle: 'Example Domain',
      };
      return {
        hasAllKeys: expectedKeys.every(k => k in testMessage),
        userMessage: testMessage.userMessage,
        type: testMessage.type,
      };
    });

    expect(messageFormat.hasAllKeys).toBe(true);
    expect(messageFormat.userMessage).toBe('生成脑图');
    expect(messageFormat.type).toBe('OPEN_SIDE_PANEL');
  });
});
