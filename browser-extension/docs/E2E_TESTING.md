# 浏览器扩展 E2E 测试指南

## 测试方式

本项目使用 Playwright 进行端到端（E2E）浏览器级别的测试。Playwright 通过 `chromium.launchPersistentContext` 启动一个加载了本地扩展的真实 Chromium 浏览器，能够在真实浏览器中测试扩展的所有 UI 交互功能。

## 运行测试

```bash
# 先构建扩展
npm run build

# 运行所有测试
npm test

# 运行指定测试文件
npx playwright test tests/mindmap.spec.ts

# 运行指定测试文件（带详细输出）
npx playwright test tests/mindmap-entries.spec.ts --reporter=list

# 运行 Playwright 测试 UI
npm run test:ui
```

## 测试原理

Playwright 测试使用 `chromium.launchPersistentContext` 加载构建后的扩展：

```typescript
import { chromium } from '@playwright/test';

context = await chromium.launchPersistentContext('', {
  headless: false,
  args: [
    `--disable-extensions-except=${EXTENSION_PATH}`,
    `--load-extension=${EXTENSION_PATH}`,
    '--no-sandbox',
  ],
});
```

这等同于在 Chrome 中通过 `chrome://extensions` → "加载已解压的扩展" → 选择 `dist/` 目录。

## 新增测试的步骤

1. 使用 `chromium.launchPersistentContext` 加载扩展
2. 导航到测试页面（`page.goto('https://example.com')` 或自建本地 HTTP 服务器）
3. 通过 DOM 操作和元素选择验证 UI 渲染和交互
4. 需要时通过 `context.pages()` 验证新页面 / Side Panel 的打开

## 测试文件说明

| 文件 | 测试内容 |
|------|---------|
| `tests/extension-full.spec.ts` | 完整功能测试（扩展加载、文本选择、图标菜单、全屏模式等） |
| `tests/extension-local.spec.ts` | 本地功能测试 |
| `tests/extension.spec.ts` | 基础功能测试 |
| `tests/extension-features.spec.ts` | 特性测试 |
| `tests/extension-real.spec.ts` | 真实 API 调用测试（需要 API Key） |
| `tests/page-summary.spec.ts` | 页面总结功能测试 |
| `tests/mindmap.spec.ts` | 脑图功能测试（CSS、按钮、面板、工具栏、全屏、Markdown 检测） |
| `tests/mindmap-entries.spec.ts` | 脑图三个入口测试（选中文本菜单、悬浮菜单、侧边栏、消息格式） |
| `tests/floating-icon-navigation.spec.ts` | 悬浮图标导航测试 |
| `tests/translation-full.spec.ts` | 翻译功能完整测试 |
| `tests/test-translate.spec.ts` | 翻译功能测试 |
| `tests/fullpage-translate.spec.ts` | 全文翻译测试 |

## 注意事项

- 运行测试前必须先 `npm run build`，确保 `dist/` 目录存在
- Playwright 测试本身就是浏览器级别的真实测试，不需要借助 Playwright MCP Bridge 或 Chrome DevTools MCP 等外部工具
- `headless: false` 是必须的，因为扩展的 UI 在无头模式下可能不会正确渲染
