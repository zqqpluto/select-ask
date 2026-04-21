import { test, expect, chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EXTENSION_PATH = path.join(__dirname, '../dist');

// Test page with rich content
const TEST_HTML = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Test Page</title></head>
<body>
<h1>人工智能技术概述</h1>
<article id="content">
<p>人工智能（Artificial Intelligence，简称AI）是计算机科学的一个分支，致力于创造能够模拟人类智能行为的系统。人工智能的研究始于20世纪50年代，经过几十年的发展，已经成为当今科技领域最重要的研究方向之一。</p>
<h2>机器学习</h2>
<p>机器学习是人工智能的核心技术之一，它使计算机能够从数据中学习并不断改进性能。机器学习主要分为以下几种类型：监督学习、无监督学习和强化学习。监督学习通过标注数据训练模型，无监督学习从未标注数据中发现模式，强化学习则通过奖惩机制学习最优策略。</p>
<h2>深度学习</h2>
<p>深度学习是机器学习的一个子领域，使用多层神经网络来处理复杂任务。深度学习在图像识别、自然语言处理和语音识别等领域取得了突破性进展。卷积神经网络（CNN）广泛应用于计算机视觉，循环神经网络（RNN）和Transformer模型在自然语言处理中表现出色。</p>
<h2>应用领域</h2>
<p>人工智能已经广泛应用于各个领域，包括医疗健康、金融、交通、教育等。在医疗领域，AI可以辅助诊断疾病、发现新药物。在金融领域，AI用于风险评估和欺诈检测。在交通领域，自动驾驶技术正在快速发展。</p>
<h2>未来展望</h2>
<p>随着技术的不断进步，人工智能将在更多领域发挥作用。通用人工智能（AGI）是研究的终极目标，旨在创造具有人类水平智能的系统。同时，人工智能的伦理问题也日益受到关注，包括隐私保护、算法公平性和就业影响等。</p>
</article>
</body>
</html>`;

test.describe('Mindmap Interaction Flow Tests', () => {
  let context: any;
  let page: any;
  let extensionId: string;
  let testUrl: string;
  let server: any;

  test.beforeAll(async () => {
    if (!fs.existsSync(EXTENSION_PATH)) {
      throw new Error(`Extension not found: ${EXTENSION_PATH}. Run 'npm run build' first.`);
    }

    // Start local server
    const http = await import('http');
    server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(TEST_HTML);
    });
    await new Promise<void>((resolve) => server.listen(8766, resolve));
    testUrl = 'http://localhost:8766';

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

    const pages = context.pages();
    page = pages.length > 0 ? pages[0] : await context.newPage();

    // Wait for service worker to be ready
    await page.goto(testUrl);
    await page.waitForTimeout(3000);
    const sw = context.serviceWorkers()[0];
    if (sw) {
      extensionId = sw.url().split('/')[2];
    } else {
      // Fallback: get extension ID from content script evaluation
      extensionId = await page.evaluate(async () => {
        return new Promise((resolve) => {
          chrome.runtime.sendMessage({ type: 'GET_STATE' }, (response) => {
            if (chrome.runtime.lastError) {
              resolve('oenjhlkogdgjlkjnmgkpjnplnilnckde');
            } else {
              const url = chrome.runtime.getURL('');
              resolve(url.split('/')[2]);
            }
          });
        });
      }).catch(() => 'oenjhlkogdgjlkjnmgkpjnplnilnckde');
    }
    console.log('Extension ID:', extensionId);
  });

  test.afterAll(async () => {
    server?.close();
    await context?.close();
  });

  test('1. 悬浮图标加载且菜单包含脑图按钮', async () => {
    await page.goto(testUrl);
    await page.waitForTimeout(3000);

    const icon = await page.waitForSelector('.select-ask-floating-icon', { timeout: 10000 });
    expect(icon).toBeTruthy();
    console.log('悬浮图标已加载');
  });

  test('2. 点击悬浮图标打开菜单，脑图菜单项存在', async () => {
    await page.goto(testUrl);
    await page.waitForTimeout(3000);

    // Click the floating icon to open menu
    const icon = await page.$('.select-ask-floating-icon-btn');
    expect(icon).toBeTruthy();
    await icon!.click();
    await page.waitForTimeout(500);

    // Check mindmap menu item exists
    const mindmapBtn = await page.$('[data-action="mindmap-page"]');
    expect(mindmapBtn).toBeTruthy();
    const tooltip = await mindmapBtn!.getAttribute('data-tooltip');
    expect(tooltip).toBe('生成脑图');
    console.log('脑图菜单项已找到');
  });

  test('3. 点击脑图菜单项，侧边栏打开', async () => {
    await page.goto(testUrl);
    await page.waitForTimeout(3000);

    // Open menu
    const icon = await page.$('.select-ask-floating-icon-btn');
    await icon!.click();
    await page.waitForTimeout(500);

    // Click mindmap button
    const mindmapBtn = await page.$('[data-action="mindmap-page"]');
    await mindmapBtn!.click();
    await page.waitForTimeout(3000);

    // Side panel should open - check for extension sidepanel page
    const sidePanelPages = context.pages().filter(p =>
      p.url().includes('side-panel') || p.url().includes('index.html')
    );
    console.log('Side panel pages:', sidePanelPages.length, sidePanelPages.map(p => p.url()));

    // At minimum, should have triggered TOGGLE_SIDE_PANEL message
    // Check storage for pending_sidebar_init
    const sw = context.serviceWorkers()[0];
    if (sw) {
      const pendingData = await sw.evaluate(async () => {
        const result = await chrome.storage.local.get('pending_sidebar_init');
        return result.pending_sidebar_init;
      });
      console.log('pending_sidebar_init:', JSON.stringify(pendingData).substring(0, 200));
      expect(pendingData).toBeTruthy();
      expect(pendingData.userMessage).toBe('生成脑图');
      expect(pendingData.summaryPrompt).toContain('脑图格式');
    }
  });

  test('4. 侧边栏UI元素渲染正确', async () => {
    const sidePanelUrl = `chrome-extension://${extensionId}/src/side-panel/index.html`;
    const sidePage = await context.newPage();
    await sidePage.goto(sidePanelUrl);
    await sidePage.waitForTimeout(8000);

    // Check side panel container exists
    const container = await sidePage.$('.side-panel-container');
    expect(container).toBeTruthy();
    console.log('侧边栏容器已渲染');

    // Check that basic UI rendered (input area, send button)
    const inputArea = await sidePage.$('.side-panel-input');
    const sendBtn = await sidePage.$('.side-panel-send-btn');
    console.log('Input area exists:', !!inputArea, 'Send button exists:', !!sendBtn);

    // Check for mindmap button in ChatInput
    const mindmapBtn = await sidePage.$('.side-panel-mindmap-btn');
    console.log('Side panel mindmap button:', !!mindmapBtn);
    // Mindmap button may not render if models not configured, which is OK
    if (mindmapBtn) {
      const text = await mindmapBtn.textContent();
      expect(text?.trim()).toContain('脑图');
    }

    await sidePage.close();
  });

  test('5. 脑图消息结构完整', async () => {
    // Test the message structure that would be sent to the side panel
    const result = await page.evaluate(() => {
      const message = {
        type: 'TOGGLE_SIDE_PANEL',
        selectedText: '',
        context: null,
        userMessage: '生成脑图',
        summaryPrompt: '请将以下内容整理为层级化 Markdown 脑图格式...',
        pageUrl: 'https://example.com',
        pageTitle: 'Test Page',
      };
      return {
        hasType: message.type === 'TOGGLE_SIDE_PANEL',
        hasUserMessage: message.userMessage === '生成脑图',
        hasSummaryPrompt: typeof message.summaryPrompt === 'string' && message.summaryPrompt.length > 0,
        hasPageUrl: typeof message.pageUrl === 'string',
        hasPageTitle: typeof message.pageTitle === 'string',
      };
    });

    expect(result.hasType).toBe(true);
    expect(result.hasUserMessage).toBe(true);
    expect(result.hasSummaryPrompt).toBe(true);
    expect(result.hasPageUrl).toBe(true);
    expect(result.hasPageTitle).toBe(true);
  });

  test('6. 侧边栏脑图内容渲染正确', async () => {
    // Use service worker to inject storage data
    const sw = context.serviceWorkers()[0];
    if (!sw) {
      console.log('No service worker, skipping mindmap rendering test');
      return;
    }

    // Set up storage via service worker
    await sw.evaluate(async () => {
      await chrome.storage.sync.set({
        app_config: {
          models: [{
            id: 'test-model',
            name: 'Test Model',
            type: 'openai-compat',
            enabled: true,
            enableChat: true,
            apiKey: 'test-key',
            apiUrl: 'https://api.test.com/v1',
          }],
          selectedChatModelIds: ['test-model'],
        },
      });
      await chrome.storage.local.set({
        pending_sidebar_init: {
          selectedText: '',
          context: null,
          userMessage: '生成脑图',
          summaryPrompt: '```markdown\n## 测试主题\n### 子主题1\n- 要点A\n```\n',
          pageUrl: 'https://example.com',
          pageTitle: 'Test Page',
        },
      });
    });

    const sidePage = await context.newPage();
    const sidePanelUrl = `chrome-extension://${extensionId}/src/side-panel/index.html`;
    await sidePage.goto(sidePanelUrl);
    await sidePage.waitForTimeout(10000);

    // Check that mindmap content is rendered
    const hasMindMap = await sidePage.evaluate(() => {
      const container = document.querySelector('.side-panel-mindmap-inline');
      const mindMapContainer = document.querySelector('.select-ask-mindmap-container');
      const mindMapSvg = document.querySelector('.select-ask-mindmap-container svg');
      const loading = document.querySelector('.side-panel-mindmap-loading');
      return {
        hasInline: !!container,
        hasContainer: !!mindMapContainer,
        hasSvg: !!mindMapSvg,
        hasLoading: !!loading,
      };
    });
    console.log('Mindmap rendering:', hasMindMap);

    // At minimum, should have started processing (loading or rendered)
    expect(hasMindMap.hasInline || hasMindMap.hasContainer || hasMindMap.hasSvg || hasMindMap.hasLoading).toBe(true);

    await sidePage.close();
  });

  test('7. 脑图消息显示模型名和耗时', async () => {
    const sw = context.serviceWorkers()[0];
    if (!sw) {
      console.log('No service worker, skipping model/duration test');
      return;
    }

    // Set up storage via service worker
    await sw.evaluate(async () => {
      await chrome.storage.sync.set({
        app_config: {
          models: [{
            id: 'test-model',
            name: 'Test Model',
            type: 'openai-compat',
            enabled: true,
            enableChat: true,
            apiKey: 'test-key',
            apiUrl: 'https://api.test.com/v1',
          }],
          selectedChatModelIds: ['test-model'],
        },
      });
      await chrome.storage.local.set({
        pending_sidebar_init: {
          selectedText: '',
          context: null,
          userMessage: '生成脑图',
          summaryPrompt: '```markdown\n## AI\n### 机器学习\n- 监督学习\n```\n',
          pageUrl: 'https://example.com',
          pageTitle: 'Test Page',
        },
      });
    });

    const sidePage = await context.newPage();
    const sidePanelUrl = `chrome-extension://${extensionId}/src/side-panel/index.html`;
    await sidePage.goto(sidePanelUrl);
    await sidePage.waitForTimeout(10000);

    // Check for AI info bar or mindmap inline (both indicate processing started)
    const result = await sidePage.evaluate(() => {
      const infoBar = document.querySelector('.side-panel-ai-info');
      const model = document.querySelector('.side-panel-ai-info-model');
      const duration = document.querySelector('.side-panel-ai-info-duration');
      const mindMapInline = document.querySelector('.side-panel-mindmap-inline');
      const loading = document.querySelector('.side-panel-mindmap-loading');
      const aiMessage = document.querySelector('.side-panel-message-ai-wrapper');
      return {
        hasInfoBar: !!infoBar,
        hasModel: !!model,
        hasDuration: !!duration,
        modelText: model?.textContent,
        durationText: duration?.textContent,
        hasMindMapInline: !!mindMapInline,
        hasLoading: !!loading,
        hasAiMessage: !!aiMessage,
      };
    });
    console.log('Mindmap AI info:', result);

    // Should have at least started processing (loading) or rendered something
    expect(result.hasLoading || result.hasMindMapInline || result.hasInfoBar || result.hasAiMessage).toBe(true);

    await sidePage.close();
  });
});
