# 测试

测试使用 Playwright 搭配 Chromium 浏览器：

- **测试文件**: 位于 `tests/`
- **测试页面**: 使用真实网页模拟真实场景
- **扩展加载**: 测试自动加载未打包的扩展

## 测试分类

| 文件 | 内容 |
|------|------|
| `extension.spec.ts` | 基本功能 |
| `extension-features.spec.ts` | 特定功能 |
| `extension-real.spec.ts` | 真实 API 调用（需 API 密钥） |
| `extension-local.spec.ts` | 纯本地测试 |
| `extension-full.spec.ts` | 全面端到端测试 |
| `floating-icon-navigation.spec.ts` | 悬浮图标导航 |
| `fullpage-translate.spec.ts` | 整页翻译 |
| `mindmap-e2e.spec.ts` | 脑图 E2E |
| `mindmap-entries.spec.ts` | 脑图三入口 |
| `mindmap.spec.ts` | 脑图功能 |
| `page-summary.spec.ts` | 页面摘要 |
| `test-translate.spec.ts` | 翻译功能 |
| `translation-full.spec.ts` | 翻译完整 |

## 测试要求

- **必须先构建**：`npm run build`，测试需要 `dist/` 目录存在
- 真实 API 测试需在扩展中配置 API 密钥
- E2E 测试指南详见 `docs/E2E_TESTING.md`
