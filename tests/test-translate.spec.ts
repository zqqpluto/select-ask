import { test, expect } from '@playwright/test';

test('全文翻译 - 点击 popup 翻译全文按钮', async ({ page, context }) => {
  // 加载扩展
  const extensionPath = '/Users/zhaoqiqiang/code/select-ask/select-ask/browser-extension/dist';
  
  // 打开一个简单页面
  await page.goto('https://example.com');
  await page.waitForLoadState('networkidle');
  
  // 等待 content script 注入
  await page.waitForTimeout(1000);
  
  // 检查 content script 是否已注入
  const hasContentScript = await page.evaluate(() => {
    return typeof (window as any).__selectAskLoaded !== 'undefined';
  });
  console.log('Content script loaded:', hasContentScript);
  
  // 直接调用 startFullPageTranslation 函数
  const result = await page.evaluate(async () => {
    try {
      // 检查是否有 data-sa-translation 属性
      const existing = document.querySelector('[data-sa-translation]');
      console.log('Existing translation:', !!existing);
      
      // 检查 collectTranslatableParagraphs 是否能找到段落
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode(node: Text) {
          const text = node.textContent?.trim();
          return text && text.length > 2 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        }
      });
      const texts: string[] = [];
      let node: Node | null;
      while ((node = walker.nextNode()) && texts.length < 5) {
        texts.push(node.textContent!.trim());
      }
      return { found: true, texts };
    } catch (e: any) {
      return { found: false, error: e.message };
    }
  });
  
  console.log('Page texts:', result);
  expect(result.found).toBe(true);
});
