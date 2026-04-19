# 测试规范

## 模型配置（第一步）

**模型配置是测试的第一步，也是最关键的一步。如果模型配置测试不通过，禁止执行任何后续测试。**

### 配置方式

测试通过 `chrome.storage.sync` 直接注入模型配置到扩展存储，无需通过 UI 操作。

注入逻辑在 `beforeAll` 中执行：
1. 验证 API Key 不为空（`throw Error` 中断整个测试）
2. 导航到扩展 options 页面（只有扩展页面有 `chrome.storage` API）
3. 通过 `chrome.storage.sync.set` 写入配置
4. 通过 `chrome.storage.sync.get` 回读验证配置是否生效

### 测试模型配置

| 参数 | 值 |
|------|-----|
| 模型 | deepseek-reasoner |
| API Key | 见测试文件中的 `TEST_MODEL_CONFIG.apiKey` |
| Base URL | https://api.deepseek.com |
| Provider | deepseek |

### 安全要求

- **测试文件（`extension-features.spec.ts`、`extension-real.spec.ts`）包含 API 密钥，已被 `.gitignore` 排除，禁止提交到 GitHub**
- 项目提供了 `.spec.ts.template` 模板文件，不含密钥，可以安全提交
- 本地开发时直接编辑 `.spec.ts` 文件填入密钥

## 等待策略

- 对话框打开后等待 **3000ms**，确保侧边栏/AI 响应有足够时间渲染
- AI 响应验证使用轮询方式：循环检查 `.select-ask-answer-text` 内容长度
- 避免使用过短的 `waitForTimeout` 导致测试提前断言

## 文件结构

```
tests/
├── extension-features.spec.ts      # 功能测试（含密钥，不提交）
├── extension-features.spec.ts.template  # 模板（可提交）
├── extension-real.spec.ts          # 真实 API 测试（含密钥，不提交）
├── extension-real.spec.ts.template      # 模板（可提交）
├── extension-full.spec.ts          # 全面 E2E 测试
├── extension-local.spec.ts         # 本地测试
└── extension.spec.ts               # 基础测试
```

## 测试文件清单

| 文件 | 说明 |
|------|------|
| `extension.spec.ts` | 基础功能测试（文本选择、菜单、侧边栏） |
| `extension-features.spec.ts` | 功能特性测试（对话框、全屏、历史记录） |
| `extension-real.spec.ts` | 真实 API 调用测试（解释、翻译、追问） |
| `extension-full.spec.ts` | 全面测试（CSS、UI 完整性） |
| `extension-local.spec.ts` | 本地功能测试（不依赖 AI） |
