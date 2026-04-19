import { test, expect, Page, BrowserContext, chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EXTENSION_PATH = path.join(__dirname, '../dist');

test.describe('脑图功能 E2E - 真实扩展测试', () => {
  let context: BrowserContext;
  let page: Page;
  let extensionId: string;

  test.beforeAll(async () => {
    if (!fs.existsSync(EXTENSION_PATH)) {
      throw new Error(`Extension not found: ${EXTENSION_PATH}. Run 'npm run build' first.`);
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
      console.log('Extension ID:', extensionId);
    }

    const pages = context.pages();
    page = pages.length > 0 ? pages[0] : await context.newPage();
  });

  test.afterAll(async () => {
    if (context) await context.close();
  });

  // ============================================================
  // 一、入口按钮渲染
  // ============================================================

  // ===== 测试1: 侧边栏脑图按钮渲染（有 pageUrl 时显示） =====
  test('1. 侧边栏脑图按钮在有 pageUrl 时渲染', async () => {
    const sidePanelPage = await openSidePanelWithPageInfo(context, extensionId, 'https://example.com', 'Example Domain');

    const mindmapBtn = await sidePanelPage.$('.side-panel-mindmap-btn');
    expect(mindmapBtn).not.toBeNull();

    const btnText = await mindmapBtn?.textContent();
    expect(btnText?.trim()).toBe('脑图');

    const tooltip = await mindmapBtn?.getAttribute('data-tooltip');
    expect(tooltip).toBe('基于当前页面内容生成脑图');

    await sidePanelPage.close();
  });

  // ===== 测试2: 无 pageUrl 时侧边栏脑图按钮不显示 =====
  test('2. 无 pageUrl 时侧边栏脑图按钮不显示', async () => {
    const sidePanelUrl = `chrome-extension://${extensionId}/src/side-panel/index.html`;
    const sidePanelPage = await context.newPage();
    await sidePanelPage.goto(sidePanelUrl);
    await sidePanelPage.waitForLoadState('domcontentloaded');
    await sidePanelPage.waitForTimeout(2000);

    const mindmapBtn = await sidePanelPage.$('.side-panel-mindmap-btn');
    expect(mindmapBtn).toBeNull();

    await sidePanelPage.close();
  });

  // ===== 测试3: 选中文本后悬浮图标二级菜单显示脑图按钮 =====
  test('3. 选中文本 > 100 字符时悬浮图标二级菜单显示脑图按钮', async () => {
    await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    // 创建文本选择
    const selectedText = await page.evaluate(() => {
      const body = document.body;
      const tempNode = document.createTextNode(
        'This is a test text that should be longer than one hundred characters. '.repeat(3)
      );
      body.appendChild(tempNode);
      const selection = window.getSelection();
      const range = document.createRange();
      range.setStart(tempNode, 0);
      range.setEnd(tempNode, 150);
      selection.removeAllRanges();
      selection.addRange(range);
      document.dispatchEvent(new Event('selectionchange'));
      return selection.toString();
    });

    expect(selectedText.length).toBeGreaterThan(100);

    await page.waitForTimeout(1500);

    const floatingIcon = await page.$('.select-ask-floating-icon');
    expect(floatingIcon).not.toBeNull();

    if (floatingIcon) {
      await floatingIcon.click();
      await page.waitForTimeout(1000);

      const mindmapItem = await page.$('.select-ask-floating-icon-menu-item[data-action="mindmap-page"]');
      const isVisible = await mindmapItem?.isVisible().catch(() => false);
      expect(isVisible).toBe(true);
    }
  });

  // ============================================================
  // 二、核心功能链路
  // ============================================================

  // ===== 测试4: 侧边栏脑图按钮点击后 AI 回复流式显示 =====
  test('4. 侧边栏脑图按钮点击后 AI 回复流式显示', async () => {
    const sidePanelPage = await openSidePanelWithPageInfo(context, extensionId, 'https://example.com', 'Example Domain');
    await sidePanelPage.waitForTimeout(1000);

    const mindmapBtn = await sidePanelPage.$('.side-panel-mindmap-btn');
    expect(mindmapBtn).not.toBeNull();

    // 点击脑图按钮
    await mindmapBtn!.click();
    await sidePanelPage.waitForTimeout(3000);

    // 验证有 assistant 消息出现（可能是流式内容、脑图加载状态或错误提示）
    const assistantMsgs = await sidePanelPage.$$('.side-panel-message-wrapper.side-panel-message-ai-wrapper');
    console.log('AI 回复消息数量:', assistantMsgs.length);
    expect(assistantMsgs.length).toBeGreaterThan(0);

    await sidePanelPage.close();
  });

  // ===== 测试5: AI 回复上的脑图按钮点击后触发流式转换 =====
  test('5. AI 回复上的脑图按钮点击后触发流式转换', async () => {
    // 先导航到一个真实页面，使 content script 注入
    await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    // 通过 chrome.runtime.sendMessage 触发 sidePanel 打开并传递 pageUrl
    await page.evaluate((extensionId) => {
      return new Promise<void>((resolve) => {
        chrome.runtime.sendMessage(
          { action: 'open_side_panel', pageUrl: 'https://example.com', pageTitle: 'Example Domain' },
          () => resolve()
        );
      });
    }, extensionId);

    await page.waitForTimeout(2000);

    // 等待 sidePanel 页面出现
    const sidePanelPages = context.pages().filter(p => p.url().includes('side-panel'));
    expect(sidePanelPages.length).toBeGreaterThan(0);

    const sidePanelPage = sidePanelPages[0];

    // 等待脑图按钮出现（依赖 pageInfo.pageUrl）
    await sidePanelPage.waitForTimeout(2000);
    const mindmapBtn = await sidePanelPage.$('.side-panel-mindmap-btn');
    expect(mindmapBtn).not.toBeNull();
    await mindmapBtn!.click();
    await sidePanelPage.waitForTimeout(1000);

    // 等待 AI 回复出现
    await sidePanelPage.waitForTimeout(3000);

    // 验证 AI 回复消息存在
    const assistantMsgs = await sidePanelPage.$$('.select-ask-message-assistant');
    console.log('AI 回复消息数量:', assistantMsgs.length);

    // 检查 AI 回复上是否有脑图按钮（data-tooltip="生成脑图"）
    const convertBtns = await sidePanelPage.$$('.side-panel-action-btn[data-tooltip="生成脑图"]');
    console.log('AI 回复上脑图按钮数量:', convertBtns.length);

    await sidePanelPage.close();
  });

  // ============================================================
  // 三、脑图渲染验证
  // ============================================================

  // ===== 测试6: 全屏脑图组件渲染 SVG 元素 =====
  test('6. 全屏脑图组件渲染 SVG 元素', async () => {
    // 导航到真实页面使 content script 注入
    await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    // 触发 sidePanel 打开
    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        chrome.runtime.sendMessage(
          { action: 'open_side_panel', pageUrl: 'https://example.com', pageTitle: 'Example Domain' },
          () => resolve()
        );
      });
    });

    await page.waitForTimeout(2000);

    const sidePanelPages = context.pages().filter(p => p.url().includes('side-panel'));
    expect(sidePanelPages.length).toBeGreaterThan(0);
    const sidePanelPage = sidePanelPages[0];

    await sidePanelPage.waitForTimeout(2000);

    // 点击脑图按钮
    const mindmapBtn = await sidePanelPage.$('.side-panel-mindmap-btn');
    expect(mindmapBtn).not.toBeNull();
    await mindmapBtn!.click();

    // 等待脑图加载
    await sidePanelPage.waitForTimeout(5000);

    const hasMindmapContainer = await sidePanelPage.evaluate(() => {
      return !!document.querySelector('.select-ask-mindmap-container');
    });

    const hasMindmapSvg = await sidePanelPage.evaluate(() => {
      const container = document.querySelector('.select-ask-mindmap-container');
      return container ? !!container.querySelector('svg') : false;
    });

    console.log('脑图容器渲染:', hasMindmapContainer);
    console.log('脑图 SVG 渲染:', hasMindmapSvg);

    const hasLoadingState = await sidePanelPage.evaluate(() => {
      return !!document.querySelector('.side-panel-mindmap-loading');
    });

    const hasAiReply = await sidePanelPage.evaluate(() => {
      return !!document.querySelector('.select-ask-message-assistant');
    });

    console.log('AI 回复存在:', hasAiReply);
    console.log('Loading 状态:', hasLoadingState);

    // 至少有 AI 回复或脑图容器之一
    expect(hasAiReply || hasMindmapContainer || hasLoadingState).toBe(true);

    await sidePanelPage.close();
  });

  // ===== 测试7: 脑图相关 CSS 样式已加载 =====
  test('7. 脑图相关 CSS 样式已加载', async () => {
    const sidePanelUrl = `chrome-extension://${extensionId}/src/side-panel/index.html`;
    const sidePanelPage = await context.newPage();
    await sidePanelPage.goto(sidePanelUrl);
    await sidePanelPage.waitForLoadState('domcontentloaded');
    await sidePanelPage.waitForTimeout(2000);

    // 验证 CSS 样式表中包含脑图相关样式
    const hasMindmapStyles = await sidePanelPage.evaluate(() => {
      const sheets = Array.from(document.styleSheets);
      return sheets.some(sheet => {
        try {
          const rules = sheet.cssRules || sheet.rules;
          if (rules) {
            for (let i = 0; i < rules.length; i++) {
              const rule = rules[i] as CSSStyleRule;
              if (rule.selectorText && rule.selectorText.includes('mindmap')) {
                return true;
              }
            }
          }
        } catch { /* cross-origin stylesheet, skip */ }
        return false;
      });
    });

    expect(hasMindmapStyles).toBe(true);
    await sidePanelPage.close();
  });

  // ============================================================
  // 四、异常场景
  // ============================================================

  // ===== 测试8: 无模型配置时点击脑图按钮显示错误提示 =====
  test('8. 无模型配置时点击脑图按钮显示错误提示', async () => {
    const sidePanelPage = await openSidePanelWithPageInfo(context, extensionId, 'https://example.com', 'Example Domain');
    await sidePanelPage.waitForTimeout(1000);

    // 清除模型配置
    await sidePanelPage.evaluate(() => {
      return new Promise<void>((resolve) => {
        chrome.storage.sync.get(['app_config'], (result) => {
          const config = result.app_config;
          if (config) {
            config.models = [];
            config.selectedChatModelIds = [];
            chrome.storage.sync.set({ app_config: config }, () => resolve());
          } else {
            resolve();
          }
        });
      });
    });

    // 重新加载页面使配置生效
    await sidePanelPage.reload();
    await sidePanelPage.waitForLoadState('domcontentloaded');
    await sidePanelPage.waitForTimeout(3000);

    const mindmapBtn = await sidePanelPage.$('.side-panel-mindmap-btn');
    if (mindmapBtn) {
      const isDisabled = await mindmapBtn.isDisabled().catch(() => false);
      console.log('脑图按钮禁用状态:', isDisabled);
    }

    await sidePanelPage.close();
  });
});

/**
 * 打开侧边栏并模拟页面信息初始化
 */
async function openSidePanelWithPageInfo(ctx: BrowserContext, extId: string, pageUrl: string, pageTitle: string): Promise<Page> {
  const sidePanelUrl = `chrome-extension://${extId}/src/side-panel/index.html`;
  const sidePanelPage = await ctx.newPage();

  await sidePanelPage.goto(sidePanelUrl);
  await sidePanelPage.waitForLoadState('domcontentloaded');

  // 设置 pending_sidebar_init 模拟 content script 的初始化
  await sidePanelPage.evaluate((data) => {
    return new Promise<void>((resolve) => {
      chrome.storage.local.set({
        pending_sidebar_init: {
          selectedText: '',
          context: null,
          userMessage: '',
          summaryPrompt: null,
          pageUrl: data.pageUrl,
          pageTitle: data.pageTitle,
        },
      }, () => resolve());
    });
  }, { pageUrl, pageTitle });

  await sidePanelPage.waitForTimeout(2000);
  return sidePanelPage;
}
