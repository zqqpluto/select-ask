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

const MODEL_B = {
  id: 'qwen-plus',
  name: 'Qwen Plus',
  provider: 'openai-compatible',
  apiKey: 'sk-1a67a951a31f4905b9582dc6ead71292',
  baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  modelId: 'qwen-plus',
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

async function getConfig(bg: Page): Promise<any> {
  return await bg.evaluate(() => new Promise<any>((r) => { chrome.storage.sync.get(['app_config'], (res) => r(res.app_config)); }));
}

async function switchModelInPopup(popup: Page, targetModelName: string): Promise<string> {
  const modelBtn = popup.locator('.popup-model-row:has-text("当前模型") .popup-model-btn');
  await modelBtn.waitFor({ state: 'visible', timeout: 5000 });
  await modelBtn.click({ force: true });
  await popup.waitForTimeout(500);

  const option = popup.locator('.popup-model-option').filter({ hasText: targetModelName });
  const optionVisible = await option.isVisible({ timeout: 3000 }).catch(() => false);
  if (!optionVisible) {
    const allOptions = await popup.locator('.popup-model-option').allTextContents();
    throw new Error(`Option "${targetModelName}" not found. Available: ${allOptions.join(', ')}`);
  }
  await option.click({ force: true });
  await popup.waitForTimeout(500);
  return await modelBtn.locator('span').textContent();
}

test.describe('Popup 模型切换 + 重开回显', () => {
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

  test('Popup 切换模型后，重新打开显示新模型', async () => {
    // 初始设置为 MODEL_A
    await setConfig(background, {
      models: [MODEL_A, MODEL_B],
      selectedChatModelIds: [MODEL_A.id, MODEL_B.id],
      showFloatingIcon: true,
      preferences: { autoGenerateQuestions: true },
    });

    // 打开 Popup，验证初始模型
    const popup1 = await context.newPage();
    await popup1.goto(`chrome-extension://${extensionId}/src/popup/index.html`);
    await popup1.waitForLoadState('domcontentloaded');

    const modelBtn1 = popup1.locator('.popup-model-row:has-text("当前模型") .popup-model-btn');
    await modelBtn1.waitFor({ state: 'visible', timeout: 5000 });
    const initialText = await modelBtn1.locator('span').textContent();
    expect(initialText).toBe(MODEL_A.name);

    // 切换为 MODEL_B
    await switchModelInPopup(popup1, MODEL_B.name);

    // 等待 handler 完成
    await popup1.waitForTimeout(1000);

    // 关闭 Popup
    await popup1.close();
    await new Promise(r => setTimeout(r, 500));

    // 重新打开 Popup
    const popup2 = await context.newPage();
    await popup2.goto(`chrome-extension://${extensionId}/src/popup/index.html`);
    await popup2.waitForLoadState('domcontentloaded');

    const modelBtn2 = popup2.locator('.popup-model-row:has-text("当前模型") .popup-model-btn');
    await modelBtn2.waitFor({ state: 'visible', timeout: 5000 });
    const textAfterReopen = await modelBtn2.locator('span').textContent();
    console.log('重新打开后显示:', textAfterReopen);
    expect(textAfterReopen).toBe(MODEL_B.name);

    // 同时验证 storage
    const cfg = await getConfig(background);
    expect(cfg.selectedChatModelIds[0]).toBe(MODEL_B.id);

    await popup2.close();
  });
});
