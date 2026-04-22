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

# 运行单个测试用例（按序号匹配）
npx playwright test --grep "6."

# 增加超时时间
npx playwright test tests/mindmap-integration.spec.ts --timeout=120000
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
    '--disable-setuid-sandbox',
  ],
});
```

这等同于在 Chrome 中通过 `chrome://extensions` → "加载已解压的扩展" → 选择 `dist/` 目录。

## 关键配置

### playwright.config.ts
- `testDir: './tests'` — 测试目录
- `browserName: 'chromium'` — 使用 Chromium
- `timeout: 60000` — 默认超时 60 秒
- `workers: 1` — 单 worker（扩展测试不能并行）

### 测试数据隔离
- **每个测试用例共享同一个 context**，但测试间会互相污染 storage
- **每个测试开头必须清理残留数据**：`await sw.evaluate(async () => { await chrome.storage.local.remove('pending_sidebar_init'); });`
- 测试中设置模型配置后，后续测试也会受影响，需显式清理

### Service Worker 操作
通过 `context.serviceWorkers()[0]` 获取 service worker，用 `sw.evaluate()` 操作 Chrome API：

```typescript
const sw = context.serviceWorkers()[0];
await sw.evaluate(async () => {
  await chrome.storage.sync.set({ app_config: { models: [...] } });
  await chrome.storage.local.set({ pending_sidebar_init: { ... } });
});
```

### 侧边栏打开方式
侧边栏是 Chrome 原生 Side Panel，Playwright 无法直接操作。替代方案：
1. 通过 `chrome-extension://${extensionId}/src/side-panel/index.html` 直接打开
2. 通过 `storage.onChanged` 触发侧边栏处理逻辑
3. 用 `page.evaluate()` 检查侧边栏 DOM 元素

## 扩展加载失败排查

| 现象 | 原因 | 解决 |
|------|------|------|
| Service Workers 为 0 | `--load-extension` 参数路径错误 | 检查 EXTENSION_PATH 是否指向 dist/ |
| 悬浮图标未注入 | 扩展加载但 content script 未执行 | 等待足够时间（3-5 秒） |
| API 调用无响应 | 模型配置中 `type` 应为 `provider` | 字段名是 `provider` 不是 `type` |
| 脑图一直 loading | AI 返回纯 markdown，没有 ``` 包裹 | 检测 `## headings` + `- lists` 格式 |
| storage.onChanged 未触发 | currentModel 为 null 时跳过 | 保留 pending 数据，等模型加载后重试 |

## AI 脑图渲染特殊处理

### 问题
AI 返回的脑图内容不一定是 ````markdown ... ```` 代码块格式，可能直接返回纯 markdown（`## 标题` + `- 列表`）。

### 解决方案
在 `LLM_STREAM_END` 中增加检测逻辑：
```typescript
// 尝试匹配代码块
const match = answerContent.match(/```markdown\s*([\s\S]*?)```|```\s*([\s\S]*?)```/);
let mindMapContent = match ? (match[1] || match[2]) : null;

// 如果没有代码块，检查是否是脑图格式（有标题+列表）
if (!mindMapContent) {
  const hasHeadings = /^#{2,4}\s/m.test(answerContent);
  const hasLists = /^[-*]\s/m.test(answerContent);
  if (hasHeadings && hasLists) {
    mindMapContent = answerContent.trim();
  }
}
```

## 真实 API 测试

### 本地配置
`tests/test-model-config.json` 已添加到 `.gitignore`，包含真实 API Key：
```json
{
  "id": "deepseek-chat",
  "provider": "deepseek",
  "apiKey": "sk-YOUR-KEY",
  "baseUrl": "https://api.deepseek.com/v1",
  "modelId": "deepseek-chat",
  "enabled": true,
  "enableChat": true
}
```

### 测试中注入
通过 service worker 注入模型配置：
```typescript
await sw.evaluate(async () => {
  await chrome.storage.sync.set({
    app_config: {
      models: [{
        id: 'deepseek-chat',
        name: 'DeepSeek Chat',
        provider: 'deepseek',  // 注意：是 provider 不是 type
        enabled: true,
        enableChat: true,
        apiKey: 'sk-xxx',
        baseUrl: 'https://api.deepseek.com/v1',
        modelId: 'deepseek-chat',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }],
      selectedChatModelIds: ['deepseek-chat'],
    },
  });
});
```

## 测试文件说明

| 文件 | 测试内容 |
|------|---------|
| `tests/extension-full.spec.ts` | 完整功能测试（扩展加载、文本选择、图标菜单、全屏模式等） |
| `tests/floating-icon-navigation.spec.ts` | 悬浮图标导航测试 |
| `tests/mindmap-integration.spec.ts` | 脑图完整交互测试（7 项，含真实 API 调用） |
| `tests/mindmap.spec.ts` | 脑图基础功能测试（CSS、按钮、面板等） |
| `tests/mindmap-entries.spec.ts` | 脑图三个入口测试 |

## 注意事项

- 运行测试前必须先 `npm run build`，确保 `dist/` 目录存在
- Playwright 测试本身就是浏览器级别的真实测试，不需要借助 Playwright MCP Bridge 或 Chrome DevTools MCP 等外部工具
- `headless: false` 是必须的，因为扩展的 UI 在无头模式下不会正确渲染
- **Playwright 需要安装 Chromium 浏览器**：`npx playwright install chromium`
- `tests/test-model-config.json` 包含敏感信息，已加入 `.gitignore`，不提交到仓库
- 模型配置字段是 `provider`，不是 `type`
- 测试间共享 context，每个测试开头需要清理 storage 中的残留数据
