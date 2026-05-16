import { test, expect, chromium, Page, BrowserContext } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EXTENSION_PATH = path.join(__dirname, '../dist');

const MODEL_A = {
  id: 'deepseek-chat',
  name: 'DeepSeek Chat',
  provider: 'deepseek',
  apiKey: 'sk-1a67a951a31f4905b9582dc6ead71292',
  baseUrl: 'https://api.deepseek.com',
  modelId: 'deepseek-chat',
  enabled: true,
  enableChat: true,
  enableQuestion: true,
};

async function getExtensionId(ctx: BrowserContext): Promise<string> {
  const workers = ctx.serviceWorkers();
  if (workers.length > 0) return workers[0].url().split('/')[2];
  const sw = await ctx.waitForEvent('serviceworker', { timeout: 10000 }).catch(() => null);
  if (sw) return sw.url().split('/')[2];
  throw new Error('No service worker');
}

async function setConfig(bg: Page, cfg: any) {
  await bg.evaluate((c) => new Promise<void>((r) => { chrome.storage.sync.set({ app_config: c }, () => r()); }), cfg);
}

test.describe('脑图完整流程复现测试', () => {
  let context: BrowserContext;
  let extensionId: string;
  let background: Page;

  test.beforeAll(async () => {
    if (!fs.existsSync(EXTENSION_PATH)) throw new Error('Run npm run build first');

    context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`, '--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      await context.waitForEvent('serviceworker', { timeout: 15000 });
    } catch {
      await new Promise(r => setTimeout(r, 2000));
    }

    extensionId = await getExtensionId(context);
    background = context.serviceWorkers()[0];
  });

  test.afterAll(async () => { if (context) await context.close(); });

  test('复现：AI回复后点击生成脑图，观察div是否消失', async () => {
    test.setTimeout(180000);

    await setConfig(background, {
      models: [MODEL_A],
      selectedChatModelIds: [MODEL_A.id],
      showFloatingIcon: true,
      preferences: { autoGenerateQuestions: true },
    });

    const sidePanel = await context.newPage();
    await sidePanel.goto(`chrome-extension://${extensionId}/src/side-panel/index.html`);
    await sidePanel.waitForLoadState('domcontentloaded');

    // 注入 pageInfo 使脑图按钮出现
    await sidePanel.evaluate(() => {
      return new Promise<void>((resolve) => {
        chrome.storage.local.set({
          pending_sidebar_init: {
            selectedText: '',
            context: null,
            userMessage: '',
            summaryPrompt: null,
            pageUrl: 'https://example.com',
            pageTitle: 'Test Page',
          }
        }, () => resolve());
      });
    });

    await sidePanel.waitForTimeout(2000);

    // Step 1: 输入简单问题获得 AI 回复
    console.log('=== Step 1: 获取 AI 回复 ===');
    const textarea = sidePanel.locator('.side-panel-input-box textarea');
    await textarea.waitFor({ state: 'visible', timeout: 10000 });
    await textarea.fill('什么是 JavaScript？请用简短的要点回答');
    await sidePanel.locator('.side-panel-send').click();

    // 等待 AI 回复
    let aiDone = false;
    for (let i = 0; i < 30; i++) {
      await sidePanel.waitForTimeout(2000);
      const aiMsgs = await sidePanel.$$('.side-panel-message-wrapper.side-panel-message-ai-wrapper');
      if (aiMsgs.length > 0) {
        const convertBtn = await sidePanel.$('[data-tooltip="生成脑图"]');
        if (convertBtn) { aiDone = true; break; }
      }
    }

    expect(aiDone).toBe(true);
    await sidePanel.screenshot({ path: '/tmp/mindmap-step1-ai-reply.png' });
    console.log('截图: AI 回复完成');

    // Step 2: 点击"生成脑图"按钮
    console.log('=== Step 2: 点击生成脑图 ===');
    const convertBtn = sidePanel.locator('[data-tooltip="生成脑图"]').first();
    await convertBtn.click();

    // Step 3: 观察脑图 div 的变化，持续 30 秒
    console.log('=== Step 3: 观察脑图 div 变化 ===');
    let snapshots: { time: number; hasDiv: boolean; hasSvg: boolean; hasMindmapInline: boolean; nodeCount: number }[] = [];

    for (let i = 0; i < 30; i++) {
      await sidePanel.waitForTimeout(1000);
      const t = (i + 1) * 1000;

      const result = await sidePanel.evaluate(() => {
        const div = document.querySelector('.side-panel-mindmap-inline');
        const svg = div ? div.querySelector('svg.markmap') : null;
        const nodes = div ? div.querySelectorAll('.markmap-node') : [];
        return {
          hasDiv: !!div,
          hasSvg: !!svg,
          nodeCount: nodes.length,
          divText: div ? div.textContent?.slice(0, 100) : null,
        };
      });

      snapshots.push({
        time: t,
        hasDiv: result.hasDiv,
        hasSvg: result.hasSvg,
        hasMindmapInline: result.hasDiv,
        nodeCount: result.nodeCount,
      });

      console.log(`  t=${t}ms: div=${result.hasDiv} svg=${result.hasSvg} nodes=${result.nodeCount}`);

      // 如果 div 消失了，截图记录
      if (!result.hasDiv && i > 0) {
        await sidePanel.screenshot({ path: `/tmp/mindmap-step3-disappeared-${t}ms.png` });
        console.log(`截图: div 在 ${t}ms 时消失`);
        break;
      }

      // 如果连续 3 次都有节点，说明稳定了
      if (i >= 5 && snapshots.slice(-3).every(s => s.hasDiv && s.nodeCount > 0)) {
        console.log('=== 脑图已稳定渲染 ===');
        await sidePanel.screenshot({ path: '/tmp/mindmap-step3-stable.png' });

        // 继续观察 10 秒
        console.log('=== 继续观察 10 秒 ===');
        for (let j = 0; j < 10; j++) {
          await sidePanel.waitForTimeout(1000);
          const t2 = t + (j + 1) * 1000;
          const stillThere = await sidePanel.evaluate(() => !!document.querySelector('.side-panel-mindmap-inline'));
          console.log(`  t=${t2}ms: div=${stillThere}`);
          if (!stillThere) {
            await sidePanel.screenshot({ path: `/tmp/mindmap-step3-late-disappeared-${t2}ms.png` });
            console.log(`截图: div 在 ${t2}ms 时消失（延迟消失）`);
            break;
          }
        }
        break;
      }
    }

    // 打印完整时间线
    console.log('=== 完整时间线 ===');
    for (const s of snapshots) {
      console.log(`  t=${s.time}ms | div=${s.hasDiv} | svg=${s.hasSvg} | nodes=${s.nodeCount}`);
    }

    // 最终断言
    const hasDivAtEnd = snapshots[snapshots.length - 1]?.hasDiv;
    console.log(`最终状态: div=${hasDivAtEnd}`);

    // 如果 div 存在，测试通过
    if (hasDivAtEnd) {
      console.log('测试通过: 脑图 div 保持存在');
    } else {
      console.log('测试失败: 脑图 div 消失了');
    }

    await sidePanel.screenshot({ path: '/tmp/mindmap-final-state.png' });

    expect(hasDivAtEnd).toBe(true);
    expect(snapshots.some(s => s.hasSvg && s.nodeCount > 0)).toBe(true);

    await sidePanel.close();
  });
});
