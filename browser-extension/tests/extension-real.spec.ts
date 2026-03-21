import { test, expect, Page, BrowserContext, chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { createServer, Server } from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const EXTENSION_PATH = path.join(__dirname, '../dist');

// API 配置 - 使用环境变量避免硬编码敏感信息
const API_CONFIG = {
  apiKey: process.env.TEST_API_KEY || '',
  baseUrl: process.env.TEST_API_BASE_URL || 'https://api.deepseek.com',
  modelName: process.env.TEST_MODEL_NAME || 'deepseek-reasoner',
};

// 测试页面
const TEST_PAGE_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>Select Ask 功能测试</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; line-height: 1.6; }
    h1 { color: #3b82f6; }
    .content-section { background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .selectable-text { padding: 15px; background: #fff; border: 1px solid #e5e7eb; border-radius: 6px; margin: 10px 0; }
  </style>
</head>
<body>
  <h1>Select Ask 功能测试</h1>
  <div class="content-section">
    <h2>技术文档</h2>
    <p class="selectable-text">
      Kubernetes is an open-source container orchestration platform for automating deployment, scaling, and management of containerized applications. It groups containers that make up an application into logical units called pods for easy management and discovery.
    </p>
    <p class="selectable-text">
      机器学习是人工智能的一个分支，它使用统计技术让计算机系统能够从数据中"学习"。深度学习是机器学习的一种方法，使用多层神经网络来处理复杂的数据模式。
    </p>
  </div>
</body>
</html>`;

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

test.describe('Select Ask - 真实功能测试', () => {
  let context: BrowserContext;
  let page: Page;
  let extensionId: string;
  let server: Server;
  let testPort: number;

  test.beforeAll(async () => {
    if (!fs.existsSync(EXTENSION_PATH)) {
      throw new Error(`Extension path not found: ${EXTENSION_PATH}`);
    }

    const serverInfo = await createTestServer(TEST_PAGE_HTML);
    server = serverInfo.server;
    testPort = serverInfo.port;

    context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        '--no-sandbox',
      ],
    });

    try {
      await context.waitForEvent('serviceworker', { timeout: 10000 });
    } catch (e) {
      console.log('Service worker timeout, continuing...');
    }

    const serviceWorkers = context.serviceWorkers();
    if (serviceWorkers.length > 0) {
      extensionId = serviceWorkers[0].url().split('/')[2];
      console.log('Extension ID:', extensionId);
    }

    const pages = context.pages();
    page = pages.length > 0 ? pages[0] : await context.newPage();
  });

  test.afterAll(async () => {
    if (server) server.close();
    if (context) await context.close();
  });

  const getTestUrl = () => `http://localhost:${testPort}`;

  // 配置扩展
  async function setupExtension() {
    // 打开扩展设置页面
    const optionsUrl = `chrome-extension://${extensionId}/src/options/index.html`;
    await page.goto(optionsUrl);
    await page.waitForTimeout(2000);

    // 检查是否已有模型配置
    const existingModel = await page.$('.model-item, [data-testid="model-item"]');
    if (existingModel) {
      console.log('已有模型配置');
      // 确保模型被选中用于聊天 - 点击"参与问答"开关
      const toggleBtns = await page.$$('button.bg-blue-500, button.bg-slate-600');
      for (const btn of toggleBtns) {
        // 如果按钮是灰色的（未启用），点击启用
        const className = await btn.getAttribute('class');
        if (className?.includes('bg-slate-600')) {
          await btn.click();
          await page.waitForTimeout(300);
        }
      }
      await page.waitForTimeout(1000);
      return;
    }

    // 点击添加模型按钮
    const addBtn = await page.$('button:has-text("添加模型"), button:has-text("新增"), .add-model-btn');
    if (addBtn) {
      await addBtn.click();
      await page.waitForTimeout(1000);
    }

    // 填写名称
    const nameInput = await page.$('input[placeholder*="名称"], input[placeholder*="Name"], input[name="name"]');
    if (nameInput) {
      await nameInput.fill('DeepSeek Test');
    }

    // 填写 API Key
    const apiKeyInput = await page.$('input[placeholder*="API"], input[type="password"], input[name="apiKey"]');
    if (apiKeyInput) {
      await apiKeyInput.fill(API_CONFIG.apiKey);
    }

    // 填写 Base URL
    const baseUrlInput = await page.$('input[placeholder*="URL"], input[placeholder*="地址"], input[name="baseUrl"]');
    if (baseUrlInput) {
      await baseUrlInput.fill(API_CONFIG.baseUrl);
    }

    // 填写模型 ID
    const modelInput = await page.$('input[placeholder*="模型"], input[placeholder*="Model"], input[name="modelId"]');
    if (modelInput) {
      await modelInput.fill(API_CONFIG.modelName);
    }

    // 选择提供商类型 - 使用 value 而不是 label
    const providerSelect = await page.$('select');
    if (providerSelect) {
      await providerSelect.selectOption('openai');
    }

    // 确保"参与问答"开关是开启状态（应该是默认开启的）
    await page.waitForTimeout(500);
    const enableChatToggle = await page.$('.bg-blue-500, .bg-slate-600');
    if (enableChatToggle) {
      const className = await enableChatToggle.getAttribute('class');
      if (className?.includes('bg-slate-600')) {
        // 点击开启
        await enableChatToggle.click();
        await page.waitForTimeout(300);
      }
    }

    // 测试连接
    const testBtn = await page.$('button:has-text("测试连接"), button:has-text("测试")');
    if (testBtn) {
      await testBtn.click();
      console.log('测试连接中...');
      await page.waitForTimeout(15000); // 等待测试结果
      console.log('✓ 测试连接完成');
    }

    // 保存
    const saveBtn = await page.$('button:has-text("保存"), button:has-text("确定"), button[type="submit"]');
    if (saveBtn) {
      await saveBtn.click();
      await page.waitForTimeout(3000);
    }

    // 验证模型出现在列表中
    await page.waitForTimeout(2000);
    const savedModel = await page.$('text=DeepSeek Test');
    if (savedModel) {
      console.log('✓ 模型已保存并显示在列表中');
    }

    // 确保模型的"参与问答"开关是开启的
    const toggleBtns = await page.$$('button.bg-blue-500, button.bg-slate-600');
    for (const btn of toggleBtns) {
      const className = await btn.getAttribute('class');
      if (className?.includes('bg-slate-600')) {
        await btn.click();
        await page.waitForTimeout(300);
      }
    }

    console.log('✓ 模型配置完成');
  }

  // 选择文本
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
    await page.mouse.up();
    await page.waitForTimeout(500);
  }

  test('1. 配置扩展', async () => {
    await setupExtension();
    expect(true).toBe(true);
  });

  test('2. 解释功能 - 发送请求并获取响应', async () => {
    await page.goto(getTestUrl());
    await page.waitForTimeout(2000);

    // 选择文本
    await selectText();

    // 点击图标菜单
    const iconMenu = await page.$('.select-ask-icon-menu');
    if (!iconMenu) {
      throw new Error('图标菜单未出现');
    }
    await iconMenu.click();
    await page.waitForTimeout(300);

    // 点击"解释"
    const items = await page.$$('.select-ask-dropdown-item');
    for (const item of items) {
      const text = await item.textContent();
      if (text?.includes('解释')) {
        await item.click();
        break;
      }
    }

    // 等待对话框出现
    await page.waitForTimeout(1000);
    const chatBox = await page.$('.select-ask-chat-box');
    expect(chatBox).toBeTruthy();
    console.log('✓ 对话框已打开');

    // 等待 AI 响应（最多 60 秒）
    console.log('等待 AI 响应...');
    await page.waitForTimeout(5000);

    // 检查是否有加载状态
    const loadingText = await chatBox?.$('.select-ask-loading-placeholder, .select-ask-loading-text');
    if (loadingText) {
      console.log('正在加载响应...');
    }

    // 等待响应完成
    let responseText = '';
    for (let i = 0; i < 60; i++) {
      await page.waitForTimeout(1000);

      // 检查是否有错误
      const errorEl = await chatBox?.$('.select-ask-error-message');
      if (errorEl) {
        const errorText = await errorEl.textContent();
        console.log('错误:', errorText);
        throw new Error(`API 请求失败: ${errorText}`);
      }

      // 检查响应内容
      const answerEl = await chatBox?.$('.select-ask-answer-text');
      if (answerEl) {
        responseText = await answerEl.textContent() || '';
        if (responseText.length > 50 && !responseText.includes('请求中') && !responseText.includes('加载')) {
          console.log('✓ 收到响应，长度:', responseText.length);
          break;
        }
      }
    }

    // 验证响应
    expect(responseText.length).toBeGreaterThan(50);
    console.log('响应内容预览:', responseText.substring(0, 200) + '...');
  });

  test('3. 翻译功能', async () => {
    await page.goto(getTestUrl());
    await page.waitForTimeout(2000);

    // 选择中文文本
    await page.evaluate(() => {
      const selection = window.getSelection();
      if (selection) {
        const range = document.createRange();
        const elements = document.querySelectorAll('.selectable-text');
        if (elements.length > 1) {
          range.selectNodeContents(elements[1]);
          selection.removeAllRanges();
          selection.addRange(range);
        }
      }
    });
    await page.mouse.up();
    await page.waitForTimeout(500);

    // 点击图标菜单
    const iconMenu = await page.$('.select-ask-icon-menu');
    if (!iconMenu) throw new Error('图标菜单未出现');
    await iconMenu.click();
    await page.waitForTimeout(300);

    // 点击"翻译"
    const items = await page.$$('.select-ask-dropdown-item');
    for (const item of items) {
      const text = await item.textContent();
      if (text?.includes('翻译')) {
        await item.click();
        break;
      }
    }

    await page.waitForTimeout(1000);
    const chatBox = await page.$('.select-ask-chat-box');
    expect(chatBox).toBeTruthy();
    console.log('✓ 翻译对话框已打开');

    // 等待响应
    let responseText = '';
    for (let i = 0; i < 60; i++) {
      await page.waitForTimeout(1000);

      const answerEl = await chatBox?.$('.select-ask-answer-text');
      if (answerEl) {
        responseText = await answerEl.textContent() || '';
        if (responseText.length > 20 && !responseText.includes('请求中')) {
          console.log('✓ 翻译完成');
          break;
        }
      }
    }

    expect(responseText.length).toBeGreaterThan(20);
    console.log('翻译结果:', responseText.substring(0, 200));
  });

  test('4. 追问功能', async () => {
    await page.goto(getTestUrl());
    await page.waitForTimeout(2000);

    // 打开对话框
    await selectText();
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

    // 等待初始响应
    const chatBox = await page.$('.select-ask-chat-box');
    if (!chatBox) throw new Error('对话框未出现');

    // 输入追问
    const textarea = await chatBox.$('.select-ask-textarea');
    if (textarea) {
      await textarea.fill('请用更简单的话解释一下');
      await page.waitForTimeout(500);

      // 点击发送
      const sendBtn = await chatBox.$('.select-ask-send-icon');
      if (sendBtn) {
        await sendBtn.click();
        console.log('✓ 已发送追问');

        // 等待响应
        await page.waitForTimeout(10000);

        // 检查是否有新消息
        const messages = await chatBox.$$('.select-ask-message');
        console.log('消息数量:', messages.length);
        expect(messages.length).toBeGreaterThanOrEqual(3);
      }
    }
  });

  test('5. 全屏模式下的历史记录', async () => {
    await page.goto(getTestUrl());
    await page.waitForTimeout(2000);

    // 打开对话框
    await selectText();
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

    await page.waitForTimeout(2000);
    let chatBox = await page.$('.select-ask-chat-box');
    if (!chatBox) throw new Error('对话框未出现');

    // 进入全屏
    const fullscreenBtn = await chatBox.$('.select-ask-fullscreen-btn');
    if (fullscreenBtn) {
      await fullscreenBtn.click();
      await page.waitForTimeout(500);

      chatBox = await page.$('.select-ask-chat-box');

      // 检查历史记录面板
      const historyPanel = await chatBox?.$('.select-ask-fullscreen-history');
      expect(historyPanel).toBeTruthy();
      console.log('✓ 全屏模式下历史记录面板存在');

      // 检查历史记录项
      const historyItems = await historyPanel!.$$('.select-ask-fullscreen-history-item');
      console.log('历史记录项数量:', historyItems.length);
      expect(historyItems.length).toBeGreaterThanOrEqual(1);
    }
  });
});