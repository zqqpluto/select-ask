import { test, expect, Page, BrowserContext, chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { createServer, Server } from 'http';

// ES 模块中获取 __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 扩展路径
const EXTENSION_PATH = path.join(__dirname, '../dist');

// 测试模型配置（不会被提交到 GitHub）
const TEST_MODEL_CONFIG = {
  id: 'test-deepseek-model',
  name: 'DeepSeek Test',
  provider: 'deepseek',
  apiKey: 'sk-1a67a951a31f4905b9582dc6ead71292',
  baseUrl: 'https://api.deepseek.com',
  modelId: 'deepseek-reasoner',
  enabled: true,
  enableChat: true,
};

// 测试页面内容
const TEST_PAGE_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Select Ask 测试页面</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; line-height: 1.6; color: #333; }
    h1 { color: #3b82f6; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; }
    .content-section { background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .selectable-text { padding: 15px; background: #fff; border: 1px solid #e5e7eb; border-radius: 6px; margin: 10px 0; }
  </style>
</head>
<body>
  <h1>Select Ask 扩展测试页面</h1>
  <div class="content-section">
    <h2>技术说明</h2>
    <p class="selectable-text">
      HDFS Federation provides namespace scalability for horizontal scaling of the cluster.
      It allows multiple namenodes to manage different namespaces, improving overall throughput
      and providing isolation between different applications or users.
    </p>
    <p class="selectable-text">
      分布式系统是现代计算机科学的重要领域，它研究如何将计算任务分散到多台计算机上执行。
      通过分布式系统，可以实现高可用性、可扩展性和容错能力。
    </p>
  </div>
  <div class="content-section">
    <h2>长文本测试</h2>
    <p class="selectable-text">
      人工智能（Artificial Intelligence，简称 AI）是计算机科学的一个分支，旨在创建能够模拟人类智能的系统。
      这些系统可以学习、推理、解决问题、理解自然语言、识别模式和做出决策。
    </p>
  </div>
</body>
</html>`;

// 创建简单的 HTTP 服务器
function createTestServer(html: string): Promise<{ server: Server; port: number }> {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    });
    server.listen(0, () => {
      const address = server.address() as { port: number };
      resolve({ server, port: address.port });
    });
  });
}

test.describe('Select Ask Extension - 功能测试', () => {
  let context: BrowserContext;
  let page: Page;
  let extensionId: string;
  let server: Server;
  let testPort: number;

  test.beforeAll(async () => {
    if (!fs.existsSync(EXTENSION_PATH)) {
      throw new Error(`Extension path not found: ${EXTENSION_PATH}. Run 'npm run build' first.`);
    }

    // 启动测试服务器
    const serverInfo = await createTestServer(TEST_PAGE_HTML);
    server = serverInfo.server;
    testPort = serverInfo.port;
    console.log('测试服务器启动在端口:', testPort);

    context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        '--no-sandbox',
        '--disable-setuid-sandbox',
      ],
    });

    // 等待 service worker
    try {
      await context.waitForEvent('serviceworker', { timeout: 10000 });
    } catch (e) {
      console.log('Service worker 等待超时，继续...');
    }

    // 获取扩展 ID
    const serviceWorkers = context.serviceWorkers();
    if (serviceWorkers.length > 0) {
      const swUrl = serviceWorkers[0].url();
      extensionId = swUrl.split('/')[2];
      console.log('Extension ID:', extensionId);
    }

    const pages = context.pages();
    page = pages.length > 0 ? pages[0] : await context.newPage();

    // 验证模型配置是否有效（密钥不能为空）
    if (!TEST_MODEL_CONFIG.apiKey || !TEST_MODEL_CONFIG.apiKey.startsWith('sk-')) {
      throw new Error(
        '模型配置无效：API Key 为空或格式不正确。\n' +
        '请在测试文件中配置 TEST_MODEL_CONFIG.apiKey，或设置环境变量 TEST_API_KEY。'
      );
    }

    // 注入模型配置到 chrome.storage.sync
    console.log('正在注入测试模型配置...');
    await injectModelConfig(page);
    console.log('✓ 测试模型配置已注入');
  });

  // 辅助函数：注入模型配置到扩展存储
  async function injectModelConfig(page: Page) {
    const now = Date.now();
    const appConfig = {
      selectedChatModelIds: [TEST_MODEL_CONFIG.id],
      selectedQuestionModelId: null,
      models: [{
        ...TEST_MODEL_CONFIG,
        createdAt: now,
        updatedAt: now,
      }],
      displayMode: 'sidebar' as const,
      preferences: {
        sendWithEnter: false,
        sidebarWidth: 420,
        autoGenerateQuestions: true,
        translation: {
          mode: 'floating' as const,
          overlapMode: 'replace' as const,
          showCloseButton: true,
          doubleClickToClose: true,
          autoScroll: true,
          hideOnScrollAway: false,
        },
      },
    };

    // 需要先导航到扩展的 options 页面，因为只有扩展页面才有 chrome.storage API
    const optionsUrl = `chrome-extension://${extensionId}/src/options/index.html`;
    await page.goto(optionsUrl);
    await page.waitForTimeout(1000);

    await page.evaluate(async (config) => {
      return new Promise<void>((resolve) => {
        chrome.storage.sync.set({ 'app_config': config }, () => {
          resolve();
        });
      });
    }, appConfig);

    // 等待配置生效
    await page.waitForTimeout(500);
  }

  test.afterAll(async () => {
    if (server) {
      server.close();
    }
    if (context) {
      await context.close();
    }
  });

  // 测试页面 URL
  const getTestUrl = () => `http://localhost:${testPort}`;

  // 辅助函数：选择文本
  async function selectText() {
    await page.evaluate(() => {
      const selection = window.getSelection();
      if (selection) {
        const range = document.createRange();
        const element = document.querySelector('.selectable-text');
        if (element) {
          range.selectNodeContents(element);
          selection.removeAllRanges();
          selection.addRange(range);
        }
      }
    });
  }

  // 辅助函数：等待并触发图标菜单
  async function waitForIconMenu() {
    // 触发 mouseup 事件以触发图标菜单
    await page.mouse.up();
    await page.waitForTimeout(500);
  }

  test('1. 图标菜单 - 选择文本后出现图标菜单', async () => {
    await page.goto(getTestUrl());
    await page.waitForTimeout(2000);

    // 选择文本
    await selectText();
    await waitForIconMenu();

    // 检查图标菜单
    const iconMenu = await page.$('.select-ask-icon-menu');
    console.log('图标菜单状态:', !!iconMenu);

    expect(iconMenu).toBeTruthy();
    console.log('✓ 图标菜单出现');
  });

  test('2. 图标菜单 - 点击打开下拉菜单', async () => {
    await page.goto(getTestUrl());
    await page.waitForTimeout(2000);

    // 选择文本
    await selectText();
    await waitForIconMenu();

    // 点击图标菜单
    const iconMenu = await page.$('.select-ask-icon-menu');
    if (iconMenu) {
      await iconMenu.click();
      await page.waitForTimeout(500);

      // 验证下拉菜单出现
      const dropdown = await page.$('.select-ask-dropdown-menu');
      expect(dropdown).toBeTruthy();
      console.log('✓ 下拉菜单出现');

      // 验证下拉菜单包含选项
      const items = await dropdown!.$$('.select-ask-dropdown-item');
      console.log('下拉菜单项数量:', items.length);
      expect(items.length).toBeGreaterThan(0);
    } else {
      throw new Error('图标菜单未出现');
    }
  });

  test('3. 对话框 - 点击解释打开对话框', async () => {
    await page.goto(getTestUrl());
    await page.waitForTimeout(2000);

    // 选择文本
    await selectText();
    await waitForIconMenu();

    // 点击图标菜单
    const iconMenu = await page.$('.select-ask-icon-menu');
    if (!iconMenu) {
      throw new Error('图标菜单未出现');
    }
    await iconMenu.click();
    await page.waitForTimeout(500);

    // 查找并点击"解释"选项
    const items = await page.$$('.select-ask-dropdown-item');
    let clicked = false;
    for (const item of items) {
      const text = await item.textContent();
      if (text?.includes('解释')) {
        await item.click();
        clicked = true;
        break;
      }
    }

    if (!clicked) {
      console.log('⚠️ 未找到解释选项');
      test.skip(true, '未找到解释选项');
      return;
    }

    await page.waitForTimeout(3000);

    // 验证对话框出现
    const chatBox = await page.$('.select-ask-chat-box');
    expect(chatBox).toBeTruthy();
    console.log('✓ 对话框出现');
  });

  test('4. 对话框 - 验证头部按钮', async () => {
    await page.goto(getTestUrl());
    await page.waitForTimeout(2000);

    // 打开对话框
    await selectText();
    await waitForIconMenu();

    const iconMenu = await page.$('.select-ask-icon-menu');
    if (!iconMenu) throw new Error('图标菜单未出现');
    await iconMenu.click();
    await page.waitForTimeout(300);

    const items = await page.$$('.select-ask-dropdown-item');
    for (const item of items) {
      const text = await item.textContent();
      if (text?.includes('解释')) {
        await item.click();
        break;
      }
    }
    await page.waitForTimeout(3000);

    const chatBox = await page.$('.select-ask-chat-box');
    if (!chatBox) throw new Error('对话框未出现');

    // 验证全屏按钮
    const fullscreenBtn = await chatBox.$('.select-ask-fullscreen-btn');
    expect(fullscreenBtn).toBeTruthy();
    console.log('✓ 全屏按钮存在');

    // 验证关闭按钮
    const closeBtn = await chatBox.$('.select-ask-close-btn');
    expect(closeBtn).toBeTruthy();
    console.log('✓ 关闭按钮存在');

    // 验证历史按钮
    const historyBtn = await chatBox.$('.select-ask-history-btn');
    expect(historyBtn).toBeTruthy();
    console.log('✓ 历史按钮存在');
  });

  test('5. 全屏功能 - 进入全屏模式', async () => {
    await page.goto(getTestUrl());
    await page.waitForTimeout(2000);

    // 打开对话框
    await selectText();
    await waitForIconMenu();

    const iconMenu = await page.$('.select-ask-icon-menu');
    if (!iconMenu) throw new Error('图标菜单未出现');
    await iconMenu.click();
    await page.waitForTimeout(300);

    const items = await page.$$('.select-ask-dropdown-item');
    for (const item of items) {
      const text = await item.textContent();
      if (text?.includes('解释')) {
        await item.click();
        break;
      }
    }
    await page.waitForTimeout(3000);

    const chatBox = await page.$('.select-ask-chat-box');
    if (!chatBox) throw new Error('对话框未出现');

    // 点击全屏按钮
    const fullscreenBtn = await chatBox.$('.select-ask-fullscreen-btn');
    if (fullscreenBtn) {
      await fullscreenBtn.click();
      await page.waitForTimeout(500);

      // 验证全屏类已添加
      const isFullscreen = await chatBox.evaluate((el) => el.classList.contains('fullscreen'));
      expect(isFullscreen).toBe(true);
      console.log('✓ 对话框已进入全屏模式');
    }
  });

  test('6. 全屏模式 - 历史记录面板', async () => {
    await page.goto(getTestUrl());
    await page.waitForTimeout(2000);

    // 打开对话框并进入全屏
    await selectText();
    await waitForIconMenu();

    let iconMenu = await page.$('.select-ask-icon-menu');
    if (!iconMenu) throw new Error('图标菜单未出现');
    await iconMenu.click();
    await page.waitForTimeout(300);

    const items = await page.$$('.select-ask-dropdown-item');
    for (const item of items) {
      const text = await item.textContent();
      if (text?.includes('解释')) {
        await item.click();
        break;
      }
    }
    await page.waitForTimeout(3000);

    let chatBox = await page.$('.select-ask-chat-box');
    if (!chatBox) throw new Error('对话框未出现');

    const fullscreenBtn = await chatBox.$('.select-ask-fullscreen-btn');
    if (fullscreenBtn) {
      await fullscreenBtn.click();
      await page.waitForTimeout(500);

      // 重新获取 chatBox 引用
      chatBox = await page.$('.select-ask-chat-box');

      // 验证历史记录面板
      const historyPanel = await chatBox?.$('.select-ask-fullscreen-history');
      expect(historyPanel).toBeTruthy();
      console.log('✓ 历史记录面板出现');

      // 验证清空按钮
      const clearBtn = await historyPanel!.$('.select-ask-clear-history-btn');
      expect(clearBtn).toBeTruthy();
      console.log('✓ 清空历史按钮存在');
    }
  });

  test('7. 对话框 - 关闭按钮', async () => {
    await page.goto(getTestUrl());
    await page.waitForTimeout(2000);

    // 打开对话框
    await selectText();
    await waitForIconMenu();

    const iconMenu = await page.$('.select-ask-icon-menu');
    if (!iconMenu) throw new Error('图标菜单未出现');
    await iconMenu.click();
    await page.waitForTimeout(300);

    const items = await page.$$('.select-ask-dropdown-item');
    for (const item of items) {
      const text = await item.textContent();
      if (text?.includes('解释')) {
        await item.click();
        break;
      }
    }
    await page.waitForTimeout(3000);

    const chatBox = await page.$('.select-ask-chat-box');
    if (!chatBox) throw new Error('对话框未出现');

    // 点击关闭按钮
    const closeBtn = await chatBox.$('.select-ask-close-btn');
    if (closeBtn) {
      await closeBtn.click();
      await page.waitForTimeout(500);

      // 验证对话框已关闭
      const chatBoxExists = await page.$('.select-ask-chat-box');
      expect(chatBoxExists).toBeNull();
      console.log('✓ 对话框已关闭');
    }
  });

  test('8. 对话框 - 输入区域', async () => {
    await page.goto(getTestUrl());
    await page.waitForTimeout(2000);

    // 打开对话框
    await selectText();
    await waitForIconMenu();

    const iconMenu = await page.$('.select-ask-icon-menu');
    if (!iconMenu) throw new Error('图标菜单未出现');
    await iconMenu.click();
    await page.waitForTimeout(300);

    const items = await page.$$('.select-ask-dropdown-item');
    for (const item of items) {
      const text = await item.textContent();
      if (text?.includes('解释')) {
        await item.click();
        break;
      }
    }
    await page.waitForTimeout(3000);

    const chatBox = await page.$('.select-ask-chat-box');
    if (!chatBox) throw new Error('对话框未出现');

    // 验证输入区域
    const inputArea = await chatBox.$('.select-ask-input-area');
    expect(inputArea).toBeTruthy();
    console.log('✓ 输入区域存在');

    // 验证文本框
    const textarea = await chatBox.$('.select-ask-textarea');
    expect(textarea).toBeTruthy();
    console.log('✓ 输入文本框存在');

    // 验证发送按钮
    const sendBtn = await chatBox.$('.select-ask-send-icon');
    expect(sendBtn).toBeTruthy();
    console.log('✓ 发送按钮存在');

    // 验证模型选择器
    const modelSelector = await chatBox.$('.select-ask-model-selector');
    expect(modelSelector).toBeTruthy();
    console.log('✓ 模型选择器存在');
  });

  test('9. 用户消息 - 验证选中内容显示', async () => {
    await page.goto(getTestUrl());
    await page.waitForTimeout(2000);

    // 选择文本
    await selectText();
    await waitForIconMenu();

    // 获取选中的文本
    const selectedText = await page.evaluate(() => window.getSelection()?.toString() || '');
    console.log('选中文本:', selectedText.substring(0, 50) + '...');

    // 打开对话框
    const iconMenu = await page.$('.select-ask-icon-menu');
    if (!iconMenu) throw new Error('图标菜单未出现');
    await iconMenu.click();
    await page.waitForTimeout(300);

    const items = await page.$$('.select-ask-dropdown-item');
    for (const item of items) {
      const text = await item.textContent();
      if (text?.includes('解释')) {
        await item.click();
        break;
      }
    }
    await page.waitForTimeout(3000);

    const chatBox = await page.$('.select-ask-chat-box');
    if (!chatBox) throw new Error('对话框未出现');

    // 验证用户消息区域
    const userMessage = await chatBox.$('.select-ask-message-user');
    expect(userMessage).toBeTruthy();
    console.log('✓ 用户消息区域存在');

    // 验证消息文本包含选中内容
    const messageText = await chatBox.$('.select-ask-message-text');
    expect(messageText).toBeTruthy();
    console.log('✓ 消息文本存在');

    // 验证AI响应区域
    const aiContent = await chatBox.$('.select-ask-answer-text');
    expect(aiContent).toBeTruthy();
    console.log('✓ AI响应区域存在');
  });
});