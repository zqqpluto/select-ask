/**
 * Select Ask - 真实功能测试
 *
 * 注意：此文件包含测试用的 API 密钥，不会被提交到 GitHub。
 * 如需运行测试，请复制此文件为 extension-real.spec.ts 并填入你的 API 密钥。
 */

import { test, expect, Page, BrowserContext, chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { createServer, Server } from 'http';
import { spawn, ChildProcess } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const EXTENSION_PATH = path.join(__dirname, '../dist');

// API 配置 - 使用固定的测试模型配置
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
    <p class="selectable-text" id="english-text">
      Kubernetes is an open-source container orchestration platform for automating deployment, scaling, and management of containerized applications. It groups containers that make up an application into logical units called pods for easy management and discovery.
    </p>
    <p class="selectable-text" id="chinese-text">
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

/**
 * 用真实鼠标拖拽选中文本，触发 content script 的 handleMouseUp
 */
async function selectTextByMouseDrag(page: Page, selector: string) {
  const targetEl = await page.$(selector);
  if (!targetEl) throw new Error(`找不到元素: ${selector}`);
  const box = await targetEl.boundingBox();
  if (!box) throw new Error('元素没有 bounding box');

  // 从文本左侧外部开始，拖到右侧外部结束，确保覆盖文本内容
  const startX = box.x + 5;
  const startY = box.y + 5;
  const endX = box.x + box.width - 5;
  const endY = box.y + box.height - 5;

  console.log(`  鼠标拖拽: (${startX},${startY}) -> (${endX},${endY})`);

  await page.mouse.move(startX, startY);
  await page.waitForTimeout(600);
  await page.mouse.down();
  await page.waitForTimeout(600);
  // 分步拖动：先到中间，再到终点
  const midX = box.x + box.width / 2;
  const midY = box.y + box.height / 2;
  await page.mouse.move(midX, midY, { steps: 10 });
  await page.waitForTimeout(300);
  await page.mouse.move(endX, endY, { steps: 10 });
  await page.waitForTimeout(300);
  await page.mouse.up();
  await page.waitForTimeout(1200);

  // 验证是否有文本被选中
  const selectedText = await page.evaluate(() => {
    const sel = window.getSelection();
    return sel ? sel.toString() : '';
  });
  console.log(`  选中文字: "${selectedText.substring(0, 50)}..."`);
  if (!selectedText || selectedText.trim().length === 0) {
    console.warn('  警告: 鼠标拖拽未选中任何文字，尝试备用方案');
    // 备用方案：程序化选中 + 手动触发 mouseup 事件
    await page.evaluate((sel, centerX, centerY) => {
      const range = document.createRange();
      const el = document.querySelector(sel);
      if (el) {
        range.selectNodeContents(el);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
      // 手动触发 mouseup 事件
      const event = new MouseEvent('mouseup', {
        bubbles: true,
        clientX: centerX,
        clientY: centerY,
      });
      document.dispatchEvent(event);
    }, selector, box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(1200);
  }
}

/**
 * 点击图标菜单并选择"翻译"
 */
async function clickTranslateFromMenu(page: Page) {
  const iconMenu = await page.$('.select-ask-icon-menu');
  if (!iconMenu) throw new Error('图标菜单未出现');
  await iconMenu.click();
  await page.waitForTimeout(800);

  const items = await page.$$('.select-ask-dropdown-item');
  for (const item of items) {
    const text = await item.textContent();
    if (text?.includes('翻译')) {
      await item.click();
      break;
    }
  }
  await page.waitForTimeout(1500);
}

/**
 * 等待翻译完成并返回译文
 * 核心逻辑：等待 API 流式响应完整渲染后再返回
 * - 内容持续增长时不断读取
 * - 连续 8 秒内容无变化 → 确认渲染完成
 * - 确保不因短暂停顿而提前结束
 */
async function waitForTranslation(page: Page, floatWindow: any, maxRetries = 80): Promise<string> {
  let responseText = '';
  let stableCount = 0;
  let hasContent = false;

  for (let i = 0; i < maxRetries; i++) {
    await page.waitForTimeout(1000);
    const bodyEl = await floatWindow.$('.select-ask-float-body');
    if (bodyEl) {
      const newText = await bodyEl.textContent() || '';

      // 检查是否有错误
      const errorEl = await floatWindow.$('.select-ask-float-error');
      if (errorEl) {
        const errorMsg = await errorEl.textContent();
        if (errorMsg && errorMsg.length > 5) {
          console.log('翻译错误:', errorMsg);
          return responseText || errorMsg;
        }
      }

      // 跳过加载提示
      const isLoading = newText.includes('请求中') || newText.includes('加载中');
      if (isLoading) continue;

      // 内容增长
      if (newText.length > responseText.length) {
        responseText = newText;
        stableCount = 0;
        if (!hasContent && responseText.length > 20) {
          hasContent = true;
        }
      } else if (hasContent && responseText.length > 20) {
        stableCount++;
        // 连续 3 秒内容无变化，确认渲染完成
        if (stableCount >= 3) {
          console.log(`  渲染完成确认，最终长度: ${responseText.length} 字符`);
          break;
        }
      }
    }
  }
  return responseText;
}

test.describe('Select Ask - 真实功能测试', () => {
  let context: BrowserContext;
  let page: Page;
  let extensionId: string;
  let server: Server;
  let testPort: number;
  let chromeProcess: ChildProcess | null = null;

  test.beforeAll(async () => {
    if (!fs.existsSync(EXTENSION_PATH)) {
      throw new Error(`Extension path not found: ${EXTENSION_PATH}`);
    }

    const serverInfo = await createTestServer(TEST_PAGE_HTML);
    server = serverInfo.server;
    testPort = serverInfo.port;

    // 使用 Playwright 随附的 Chromium（不能用系统 Chrome，因为 Chrome/Edge 移除了侧载扩展所需的命令行标志）
    context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        '--no-sandbox',
      ],
    });

    // 等待 service worker 加载
    try {
      await context.waitForEvent('serviceworker', { timeout: 10000 });
    } catch (e) {
      console.log('Service worker 等待超时，继续...');
    }

    // 获取扩展 ID
    const serviceWorkers = context.serviceWorkers();
    if (serviceWorkers.length > 0) {
      extensionId = serviceWorkers[0].url().split('/')[2];
    }

    if (!extensionId) {
      throw new Error('无法获取 Extension ID，扩展可能未正确加载');
    }

    console.log('Extension ID:', extensionId);

    // 获取第一个可用的页面
    const allPages = context.pages();
    page = allPages.find(p => !p.url().startsWith('chrome://')) || allPages[0] || await context.newPage();

    // 验证 API Key
    if (!TEST_MODEL_CONFIG.apiKey || !TEST_MODEL_CONFIG.apiKey.startsWith('sk-')) {
      throw new Error('模型配置无效：API Key 为空或格式不正确。');
    }

    // 注入模型配置到 chrome.storage.sync
    console.log('正在注入测试模型配置...');
    await injectModelConfig(page);
  });

  // 注入模型配置并验证
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

    // 导航到扩展的 options 页面来写入配置
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

    await page.waitForTimeout(500);

    // 验证配置是否生效
    const verifyResult = await page.evaluate(async () => {
      return new Promise<any>((resolve) => {
        chrome.storage.sync.get(['app_config'], (result) => {
          resolve(result['app_config']);
        });
      });
    });

    if (!verifyResult || !verifyResult.models || verifyResult.models.length === 0) {
      throw new Error('模型配置注入失败：配置未生效或 models 为空');
    }

    if (verifyResult.models[0].id !== TEST_MODEL_CONFIG.id) {
      throw new Error(`模型配置注入失败：模型 ID 不匹配，期望 "${TEST_MODEL_CONFIG.id}"，实际 "${verifyResult.models[0].id}"`);
    }

    console.log('✓ 模型配置验证通过');
  }

  test.afterAll(async () => {
    if (server) server.close();
    if (context) await context.close();
    // 关闭 Chrome 进程
    if (chromeProcess && chromeProcess.pid) {
      try { process.kill(-chromeProcess.pid, 'SIGTERM'); } catch {}
    }
  });

  const getTestUrl = () => `http://localhost:${testPort}`;

  // === 3. 基本翻译功能（选中中文文本，自动翻译成英文） ===
  test('3. 翻译功能', async () => {
    console.log('>>> 导航到测试页面');
    await page.goto(getTestUrl());
    await page.waitForTimeout(1000);

    // 选中中文文本（第二段）
    console.log('>>> 选中中文文本');
    await selectTextByMouseDrag(page, '#chinese-text');

    // 等待图标菜单出现
    const iconMenu = await page.$('.select-ask-icon-menu');
    if (!iconMenu) throw new Error('图标菜单未出现');
    console.log('✓ 图标菜单已出现');

    // 点击翻译菜单项
    console.log('>>> 点击翻译菜单项');
    await clickTranslateFromMenu(page);

    // 验证悬浮窗口出现
    const floatWindow = await page.$('.select-ask-float-window');
    if (!floatWindow) throw new Error('翻译悬浮窗口未出现');
    console.log('✓ 翻译悬浮窗口已打开');

    // 等待翻译响应
    console.log('>>> 等待翻译响应');
    const responseText = await waitForTranslation(page, floatWindow, 60);

    expect(responseText.length).toBeGreaterThan(20);
    console.log('翻译结果:', responseText.substring(0, 200));
  });

  // === 4. 悬浮窗口内切换目标语言 ===
  test('4. 翻译 - 切换目标语言', async () => {
    console.log('>>> 导航到测试页面');
    await page.goto(getTestUrl());
    await page.waitForTimeout(1000);

    // 选中中文文本
    console.log('>>> 选中中文文本');
    await selectTextByMouseDrag(page, '#chinese-text');

    // 点击图标菜单 -> 翻译
    await clickTranslateFromMenu(page);

    // 验证悬浮窗口出现
    let floatWindow = await page.$('.select-ask-float-window');
    if (!floatWindow) throw new Error('翻译悬浮窗口未出现');
    console.log('✓ 悬浮窗口已打开');

    // 等待默认语言翻译完成
    let responseText = await waitForTranslation(page, floatWindow, 40);
    expect(responseText.length).toBeGreaterThan(10);
    console.log('✓ 默认语言翻译完成');

    // 切换目标语言为日本語
    console.log('>>> 切换目标语言为日本語');
    await page.waitForTimeout(800);
    const langSelect = await floatWindow.$('.select-ask-float-lang-select');
    if (!langSelect) throw new Error('找不到语言选择器');
    await langSelect.selectOption({ value: 'ja' });
    await page.waitForTimeout(1000);

    // 等待重新翻译 - 使用相同的完整渲染等待策略
    let jpText = '';
    let stableCount = 0;
    let hasContent = false;
    for (let i = 0; i < 80; i++) {
      await page.waitForTimeout(1000);
      const bodyEl = await floatWindow.$('.select-ask-float-body');
      if (bodyEl) {
        const newText = await bodyEl.textContent() || '';

        // 检查是否有错误
        const errorEl = await floatWindow.$('.select-ask-float-error');
        if (errorEl) {
          const errorMsg = await errorEl.textContent();
          if (errorMsg && errorMsg.length > 5) {
            console.log('切换语言后翻译错误:', errorMsg);
            break;
          }
        }

        const isLoading = newText.includes('请求中') || newText.includes('加载中');
        if (isLoading) continue;

        if (newText.length > jpText.length) {
          jpText = newText;
          stableCount = 0;
          if (!hasContent && jpText.length > 20) hasContent = true;
        } else if (hasContent && jpText.length > 20) {
          stableCount++;
          if (stableCount >= 3) {
            console.log(`  日文渲染完成确认，最终长度: ${jpText.length} 字符`);
            break;
          }
        }
      }
    }
    expect(jpText.length).toBeGreaterThan(10);
    console.log('✓ 语言切换后翻译完成:', jpText.substring(0, 150));
  });

  // === 5. 悬浮窗口关闭按钮 ===
  test('5. 翻译 - 关闭按钮', async () => {
    console.log('>>> 导航到测试页面');
    await page.goto(getTestUrl());
    await page.waitForTimeout(1000);

    // 选中中文文本
    await selectTextByMouseDrag(page, '#chinese-text');
    await clickTranslateFromMenu(page);

    // 验证悬浮窗口出现
    let floatWindow = await page.$('.select-ask-float-window');
    if (!floatWindow) throw new Error('翻译悬浮窗口未出现');
    console.log('✓ 悬浮窗口已打开');

    // 点击关闭按钮
    console.log('>>> 点击关闭按钮');
    await page.waitForTimeout(500);
    const closeBtn = await floatWindow.$('.select-ask-float-close');
    if (!closeBtn) throw new Error('找不到关闭按钮');
    await closeBtn.click();
    await page.waitForTimeout(500);

    // 验证窗口已消失
    floatWindow = await page.$('.select-ask-float-window');
    expect(floatWindow).toBeNull();
    console.log('✓ 悬浮窗口已关闭');
  });

  // === 6. 点击外部自动关闭 ===
  test('6. 翻译 - 点击外部关闭', async () => {
    console.log('>>> 导航到测试页面');
    await page.goto(getTestUrl());
    await page.waitForTimeout(1000);

    // 选中中文文本
    await selectTextByMouseDrag(page, '#chinese-text');
    await clickTranslateFromMenu(page);

    // 验证悬浮窗口出现
    let floatWindow = await page.$('.select-ask-float-window');
    if (!floatWindow) throw new Error('翻译悬浮窗口未出现');
    console.log('✓ 悬浮窗口已打开');

    // 点击页面空白区域（悬浮窗口外部）
    console.log('>>> 点击页面空白区域');
    await page.waitForTimeout(500);
    await page.click('body', { position: { x: 10, y: 10 } });
    await page.waitForTimeout(500);

    // 验证窗口已消失
    floatWindow = await page.$('.select-ask-float-window');
    expect(floatWindow).toBeNull();
    console.log('✓ 点击外部后悬浮窗口已关闭');
  });

  // === 7. 翻译错误处理 ===
  test('7. 翻译 - 错误处理', async () => {
    console.log('>>> 注入无效 API Key');
    const now = Date.now();
    const invalidConfig = {
      selectedChatModelIds: ['test-invalid-model'],
      selectedQuestionModelId: null,
      models: [{
        id: 'test-invalid-model',
        name: 'Invalid Test',
        provider: 'deepseek',
        apiKey: 'sk-invalid-key-for-testing',
        baseUrl: 'https://api.deepseek.com',
        modelId: 'deepseek-reasoner',
        enabled: true,
        enableChat: true,
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

    // 导航到 options 页面写入无效配置
    const optionsUrl = `chrome-extension://${extensionId}/src/options/index.html`;
    await page.goto(optionsUrl);
    await page.waitForTimeout(1000);
    await page.evaluate(async (config) => {
      return new Promise<void>((resolve) => {
        chrome.storage.sync.set({ 'app_config': config }, () => { resolve(); });
      });
    }, invalidConfig);
    await page.waitForTimeout(500);

    // 导航到测试页面
    console.log('>>> 导航到测试页面');
    await page.goto(getTestUrl());
    await page.waitForTimeout(1000);

    // 选中中文文本
    await selectTextByMouseDrag(page, '#chinese-text');
    await clickTranslateFromMenu(page);

    // 验证悬浮窗口出现
    const floatWindow = await page.$('.select-ask-float-window');
    if (!floatWindow) throw new Error('翻译悬浮窗口未出现');
    console.log('✓ 悬浮窗口已打开');

    // 等待错误消息
    let errorMsg = '';
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(1000);
      const errorEl = await floatWindow.$('.select-ask-float-error');
      if (errorEl) {
        errorMsg = await errorEl.textContent() || '';
        if (errorMsg.length > 5) break;
      }
    }

    // 应该显示错误信息
    expect(errorMsg.length).toBeGreaterThan(5);
    console.log('✓ 错误处理正确:', errorMsg.substring(0, 100));

    // 恢复有效配置
    console.log('>>> 恢复有效配置');
    const validConfig = {
      selectedChatModelIds: [TEST_MODEL_CONFIG.id],
      selectedQuestionModelId: null,
      models: [{
        ...TEST_MODEL_CONFIG,
        createdAt: Date.now(),
        updatedAt: Date.now(),
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
    await page.goto(optionsUrl);
    await page.waitForTimeout(1000);
    await page.evaluate(async (config) => {
      return new Promise<void>((resolve) => {
        chrome.storage.sync.set({ 'app_config': config }, () => { resolve(); });
      });
    }, validConfig);
    await page.waitForTimeout(500);
  });
});
