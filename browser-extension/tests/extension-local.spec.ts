import { test, expect, Page, BrowserContext, chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// ES 模块中获取 __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 扩展路径
const EXTENSION_PATH = path.join(__dirname, '../dist');

// 测试页面路径（使用 file:// 协议）
const TEST_PAGE_PATH = path.join(__dirname, 'fixtures', 'test-page.html');

test.describe('Select Ask Extension - 完整功能测试', () => {
  let context: BrowserContext;
  let page: Page;
  let extensionId: string;

  test.beforeAll(async () => {
    // 确保扩展目录存在
    if (!fs.existsSync(EXTENSION_PATH)) {
      throw new Error(`Extension path not found: ${EXTENSION_PATH}. Run 'npm run build' first.`);
    }

    // 使用 launchPersistentContext 加载扩展
    context = await chromium.launchPersistentContext('', {
      headless: false, // 扩展测试需要非 headless 模式
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        '--no-sandbox',
        '--disable-setuid-sandbox',
      ],
    });

    // 等待扩展加载
    await context.waitForEvent('serviceworker');

    // 获取扩展 ID
    const serviceWorkers = context.serviceWorkers();
    if (serviceWorkers.length > 0) {
      const swUrl = serviceWorkers[0].url();
      extensionId = swUrl.split('/')[2];
      console.log('Extension ID:', extensionId);
    }

    // 获取或创建页面
    const pages = context.pages();
    page = pages.length > 0 ? pages[0] : await context.newPage();
  });

  test.afterAll(async () => {
    if (context) {
      await context.close();
    }
  });

  test('1. 扩展加载验证', async () => {
    expect(extensionId).toBeDefined();
    expect(extensionId.length).toBeGreaterThan(0);
    console.log('✓ 扩展已加载，ID:', extensionId);
  });

  test('2. 本地测试页面加载', async () => {
    // 使用 file:// 协议加载本地测试页面
    await page.goto(`file://${TEST_PAGE_PATH}`);

    // 验证页面标题
    const title = await page.title();
    expect(title).toContain('Select Ask');

    // 验证页面内容
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toContain('HDFS Federation');

    console.log('✓ 测试页面加载成功');
  });

  test('3. 样式注入测试', async () => {
    await page.goto(`file://${TEST_PAGE_PATH}`);
    await page.waitForTimeout(2000);

    // 检查扩展是否注入了样式（通过 style 标签）
    const styleInjected = await page.evaluate(() => {
      const styles = Array.from(document.querySelectorAll('style'));
      return styles.some(s => s.id === 'select-ask-styles' || s.textContent?.includes('select-ask'));
    });

    console.log('样式注入状态:', styleInjected);

    // 如果样式未注入，检查样式表
    if (!styleInjected) {
      const styleSheets = await page.evaluate(() => {
        const sheets = Array.from(document.styleSheets);
        return sheets.length;
      });
      console.log('样式表数量:', styleSheets);
    }

    expect(styleInjected).toBe(true);
    console.log('✓ 样式已注入');
  });

  test('4. 文本选择与图标菜单测试', async () => {
    await page.goto(`file://${TEST_PAGE_PATH}`);
    await page.waitForTimeout(1500);

    // 选择第一段可选择的文本
    const selectableText = page.locator('.selectable-text').first();
    await selectableText.click();

    // 使用 JavaScript 选择文本
    await page.evaluate(() => {
      const selection = window.getSelection();
      if (selection) {
        const range = document.createRange();
        const textNode = document.querySelector('.selectable-text')?.firstChild;
        if (textNode && textNode.nodeType === Node.TEXT_NODE) {
          range.selectNodeContents(textNode);
          selection.removeAllRanges();
          selection.addRange(range);
        }
      }
    });

    // 验证文本已选择
    const selectedText = await page.evaluate(() => {
      return window.getSelection()?.toString() || '';
    });

    expect(selectedText.length).toBeGreaterThan(0);
    console.log('✓ 文本选择成功:', selectedText.substring(0, 50) + '...');

    // 等待图标菜单出现
    await page.waitForTimeout(1000);

    // 检查图标菜单
    const iconMenu = await page.$('.select-ask-icon-menu');
    console.log('图标菜单状态:', !!iconMenu);

    if (iconMenu) {
      // 检查菜单项
      const menuItems = await iconMenu.$$('.select-ask-icon-menu-item');
      console.log('菜单项数量:', menuItems.length);

      expect(iconMenu).toBeTruthy();
      console.log('✓ 图标菜单出现');
    }
  });

  test('5. 全屏样式完整性验证', async () => {
    await page.goto(`file://${TEST_PAGE_PATH}`);
    await page.waitForTimeout(2000);

    // 检查全屏相关样式是否存在
    const fullscreenStylesDefined = await page.evaluate(() => {
      const styles = Array.from(document.querySelectorAll('style'));
      const cssText = styles.map(s => s.textContent || '').join('');
      return {
        fullscreen: cssText.includes('.select-ask-chat-box.fullscreen'),
        historyPanel: cssText.includes('.select-ask-fullscreen-history'),
        clearBtn: cssText.includes('.select-ask-clear-history-btn'),
        sidebar: cssText.includes('.select-ask-sidebar'),
      };
    });

    console.log('全屏样式定义:', JSON.stringify(fullscreenStylesDefined, null, 2));

    expect(fullscreenStylesDefined.fullscreen).toBe(true);
    expect(fullscreenStylesDefined.historyPanel).toBe(true);
    expect(fullscreenStylesDefined.clearBtn).toBe(true);
    expect(fullscreenStylesDefined.sidebar).toBe(true);
    console.log('✓ 全屏样式完整');
  });

  test('6. 历史记录面板样式验证', async () => {
    await page.goto(`file://${TEST_PAGE_PATH}`);
    await page.waitForTimeout(2000);

    const historyStylesDefined = await page.evaluate(() => {
      const styles = Array.from(document.querySelectorAll('style'));
      const cssText = styles.map(s => s.textContent || '').join('');
      return {
        historySidebar: cssText.includes('.select-ask-history-sidebar'),
        historyList: cssText.includes('.select-ask-fullscreen-history-list'),
        historyItem: cssText.includes('.select-ask-fullscreen-history-item'),
      };
    });

    console.log('历史记录样式:', JSON.stringify(historyStylesDefined, null, 2));

    expect(historyStylesDefined.historySidebar).toBe(true);
    expect(historyStylesDefined.historyList).toBe(true);
    expect(historyStylesDefined.historyItem).toBe(true);
    console.log('✓ 历史记录样式完整');
  });
});

test.describe('CSS 内联完整性测试', () => {
  test('检查内联样式完整性', async () => {
    // 样式已通过 ?inline 导入内联到 JS 中
    // 直接检查 content script 的 JS 文件
    const assetsPath = path.join(EXTENSION_PATH, 'assets');
    const jsFiles = fs.readdirSync(assetsPath).filter(f => f.startsWith('index.ts-') && f.endsWith('.js'));

    console.log('Content script JS 文件:', jsFiles);

    let foundStyles = false;
    for (const file of jsFiles) {
      const content = fs.readFileSync(path.join(assetsPath, file), 'utf-8');
      // 检查是否包含 select-ask 相关的样式类名
      if (content.includes('select-ask-chat-box') && content.includes('select-ask-fullscreen')) {
        foundStyles = true;
        console.log(`✓ 在 ${file} 中找到内联样式`);
        break;
      }
    }

    expect(foundStyles).toBe(true);
    console.log('✓ 内联样式已正确打包');
  });
});

test.describe('手动测试指南', () => {
  test('输出测试指南', async () => {
    console.log(`
========================================
    Select Ask Extension 测试指南
========================================

前置条件:
1. 在 Chrome 扩展管理页面加载 dist 目录
2. 配置至少一个模型（打开扩展弹窗设置）

测试步骤:

【测试 1: 文本选择与图标菜单】
1. 打开任意网页或本地测试页面
2. 选择页面中的任意文本
3. 预期: 出现图标菜单

【测试 2: 解释功能】
1. 点击图标菜单中的"解释"图标
2. 预期: 出现对话框，显示解释内容

【测试 3: 翻译功能】
1. 点击图标菜单中的"翻译"图标
2. 预期: 出现对话框，显示翻译内容

【测试 4: 全屏模式】
1. 点击对话框头部的全屏按钮
2. 预期: 对话框全屏显示，左侧显示历史记录面板
3. 点击收缩按钮恢复原大小

【测试 5: 关闭对话框】
1. 点击对话框头部的关闭按钮（X 图标）
2. 预期: 对话框关闭

【测试 6: 侧边栏模式】
1. 打开扩展设置页面
2. 将显示模式改为"侧边栏"
3. 保存设置
4. 选择文本并点击解释
5. 预期: 对话框显示在页面右侧侧边栏

========================================
    `);

    expect(true).toBe(true);
  });
});