import { test, expect, Page, BrowserContext, chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const EXTENSION_PATH = path.join(__dirname, '../dist');

/**
 * 生成一篇包含丰富内容的测试页面 HTML
 * 模拟文章页面用于验证"总结页面"功能
 */
function generateTestPageHTML(): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>人工智能技术发展概述 - 测试文章</title>
  <style>
    body { max-width: 800px; margin: 0 auto; padding: 20px; font-family: sans-serif; line-height: 1.6; }
    h1 { color: #333; }
    h2 { color: #555; margin-top: 24px; }
    p { margin: 12px 0; }
  </style>
</head>
<body>
  <article>
    <h1>人工智能技术发展概述</h1>
    <p>人工智能（Artificial Intelligence，简称 AI）是计算机科学的一个重要分支，旨在开发和构建能够模拟、延伸和扩展人类智能的理论、方法、技术和应用系统。自 20 世纪 50 年代图灵提出"机器能思考吗"这一问题以来，人工智能技术经历了多次起落，如今正处于前所未有的快速发展阶段。</p>

    <h2>一、深度学习革命</h2>
    <p>深度学习是机器学习的一个子领域，它使用多层神经网络来学习数据的分层表示。2012 年，AlexNet 在 ImageNet 图像识别竞赛中取得突破性成绩，标志着深度学习时代的正式到来。此后，卷积神经网络（CNN）在计算机视觉领域取得了巨大成功，循环神经网络（RNN）和 Transformer 架构则在自然语言处理领域展现出强大能力。</p>
    <p>Transformer 架构由 Vaswani 等人在 2017 年提出，其核心的自注意力机制（Self-Attention）使得模型能够同时考虑输入序列中所有位置之间的依赖关系，而不像 RNN 那样需要按顺序处理。这一创新为大规模语言模型的训练奠定了基础。</p>

    <h2>二、大语言模型的崛起</h2>
    <p>近年来，以 GPT、Claude、通义千问等为代表的大语言模型（LLM）引发了全球范围内的 AI 热潮。这些模型通过在海量文本数据上进行预训练，学习到了丰富的语言知识和世界知识，展现出了令人惊叹的理解和生成能力。</p>
    <p>大语言模型的核心思想是"规模即能力"（Scaling Law）。研究表明，随着模型参数量、训练数据量和计算量的增加，模型的性能呈现出可预测的提升趋势。这促使各大科技公司和研究机构竞相训练更大的模型。</p>

    <h2>三、多模态技术</h2>
    <p>多模态 AI 是指能够同时处理和生成多种类型数据（如文本、图像、音频、视频等）的人工智能系统。GPT-4V、Claude 3 等模型已经展示了强大的图像理解能力，能够回答关于图片内容的复杂问题。</p>
    <p>文生图模型如 DALL-E、Midjourney 和 Stable Diffusion 更是将 AI 的创造力推向了新的高度。用户只需用自然语言描述想要的图像，AI 就能生成高质量、富有创意的视觉内容。</p>

    <h2>四、应用场景</h2>
    <p>人工智能技术正在深刻改变各行各业。在医疗领域，AI 辅助诊断系统可以帮助医生更准确地识别疾病；在教育领域，个性化学习平台能够根据学生的学习情况提供定制化的教学内容；在金融领域，智能风控系统可以有效识别和防范欺诈风险。</p>
    <p>此外，AI 编程助手如 GitHub Copilot 正在改变软件开发的工作方式，AI 写作工具也在内容创作领域发挥着越来越重要的作用。</p>

    <h2>五、挑战与展望</h2>
    <p>尽管人工智能技术取得了巨大进步，但仍面临诸多挑战。包括模型的可解释性、数据隐私保护、算法偏见、能源消耗等问题都需要进一步研究和解决。同时，AI 的安全性和伦理问题也引起了广泛的社会关注。</p>
    <p>展望未来，人工智能技术将继续快速发展，并在更多领域展现出强大的能力。通用人工智能（AGI）的终极目标虽然遥远，但每一步进展都在推动我们向这一目标迈进。</p>
  </article>
</body>
</html>`;
}

test.describe('Page Summary Feature', () => {
  let context: BrowserContext;
  let page: Page;
  let extensionId: string;
  let testUrl: string;

  test.beforeAll(async () => {
    if (!fs.existsSync(EXTENSION_PATH)) {
      throw new Error(`Extension not found: ${EXTENSION_PATH}. Run "npm run build" first.`);
    }

    // 启动本地 HTTP 服务器提供测试页面
    const http = await import('http');
    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(generateTestPageHTML());
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as any).port;
    testUrl = `http://localhost:${port}`;

    // 启动带有扩展的 Chromium
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

    // 获取扩展 ID
    const sw = context.serviceWorkers()[0];
    if (sw) {
      extensionId = sw.url().split('/')[2];
    }

    // 获取初始页面
    const pages = context.pages();
    page = pages.length > 0 ? pages[0] : await context.newPage();
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test('总结页面 - 悬浮图标存在并可交互', async () => {
    await page.goto(testUrl);
    await page.waitForTimeout(2000);

    // 验证悬浮图标存在
    const floatingIcon = await page.$('.select-ask-floating-icon');
    expect(floatingIcon).toBeTruthy();
  });

  test('总结页面 - hover 弹出菜单并包含总结页面选项', async () => {
    await page.goto(testUrl);
    await page.waitForTimeout(2000);

    // 移动鼠标到悬浮图标上，触发 hover
    const floatingIcon = page.locator('.select-ask-floating-icon-btn');
    await floatingIcon.hover();

    // 等待菜单动画出现（200ms delay + transition）
    await page.waitForTimeout(600);

    // 验证菜单出现
    const menu = page.locator('.select-ask-floating-icon-menu');
    await expect(menu).toBeVisible();

    // 验证"总结页面"菜单项存在
    const summarizeItem = page.locator('[data-action="summarize-page"]');
    await expect(summarizeItem).toBeVisible();

    // 验证 tooltip
    const tooltip = await summarizeItem.getAttribute('data-tooltip');
    expect(tooltip).toBe('总结页面');
  });

  test('总结页面 - 点击总结页面菜单项打开 Side Panel', async () => {
    await page.goto(testUrl);
    await page.waitForTimeout(2000);

    // 记录当前页面数量
    const pagesBefore = context.pages().length;

    // 触发 hover 显示菜单
    const floatingIcon = page.locator('.select-ask-floating-icon-btn');
    await floatingIcon.hover();
    await page.waitForTimeout(600);

    // 点击"总结页面"菜单项
    const summarizeItem = page.locator('[data-action="summarize-page"]');
    await summarizeItem.click();

    // 等待 Side Panel 打开（chrome.sidePanel.open 会创建新页面）
    await page.waitForTimeout(2000);

    // 验证新页面被创建
    expect(context.pages().length).toBeGreaterThan(pagesBefore);

    // 找到 Side Panel 页面
    const sidePanel = context.pages().find((p) =>
      p.url().includes('side-panel') || p.url().includes('index.html')
    );
    expect(sidePanel).toBeTruthy();
  });

  test('总结页面 - Side Panel 中显示"总结页面"用户消息', async () => {
    await page.goto(testUrl);
    await page.waitForTimeout(2000);

    // 触发 hover 并点击总结页面
    const floatingIcon = page.locator('.select-ask-floating-icon-btn');
    await floatingIcon.hover();
    await page.waitForTimeout(600);

    const summarizeItem = page.locator('[data-action="summarize-page"]');
    await summarizeItem.click();

    // 等待 Side Panel 打开
    await page.waitForTimeout(3000);

    // 找到 Side Panel 页面
    const sidePanel = context.pages().find((p) =>
      p.url().includes('side-panel')
    );
    expect(sidePanel).toBeTruthy();

    // 验证用户消息"总结页面"显示在 Side Panel 中
    const userMessage = sidePanel!.locator('.side-panel-message-user');
    await expect(userMessage).toBeVisible({ timeout: 10000 });

    // 验证消息内容包含"总结页面"
    const messageText = await userMessage.textContent();
    expect(messageText).toContain('总结页面');
  });

  test('总结页面 - Side Panel 中显示 loading 状态或 AI 响应', async () => {
    await page.goto(testUrl);
    await page.waitForTimeout(2000);

    // 触发 hover 并点击总结页面
    const floatingIcon = page.locator('.select-ask-floating-icon-btn');
    await floatingIcon.hover();
    await page.waitForTimeout(600);

    const summarizeItem = page.locator('[data-action="summarize-page"]');
    await summarizeItem.click();

    // 等待 Side Panel 打开并加载
    await page.waitForTimeout(3000);

    // 找到 Side Panel 页面
    const sidePanel = context.pages().find((p) =>
      p.url().includes('side-panel')
    );
    expect(sidePanel).toBeTruthy();

    // 等待消息容器出现
    const messagesContainer = sidePanel!.locator('.side-panel-content');
    await expect(messagesContainer).toBeVisible({ timeout: 10000 });

    // 验证至少有一条消息（用户消息）
    const messageCount = await sidePanel!.locator('.side-panel-message').count();
    expect(messageCount).toBeGreaterThanOrEqual(1);
  });
});
