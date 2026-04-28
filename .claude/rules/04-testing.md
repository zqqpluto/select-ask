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

## 自测规范（强制遵守）

### 原则
每次完整改动后，**必须自测通过**才能提交给用户。

### "自测通过"的定义
自测通过 ≠ 编译通过 ≠ 扩展加载成功。自测通过意味着：
1. `npm test tests/self-test.spec.ts` 全部绿色
2. 测试用例覆盖了**本次改动涉及的具体代码路径**，而非只测通用功能
3. 每个 test case 模拟**真实用户操作路径**（点击按钮 → 等待 → 验证结果），不是只检查 DOM 元素存在

### 测试设计规则
**必须**按以下模式设计 self-test：

```
for each 改动:
  确定改了什么 → 对应哪些用户操作 → 模拟那些操作 → 验证结果
```

示例：
| 改动 | 用户操作 | 测试验证 |
|------|---------|---------|
| Popup 换模型同步到 side-panel | Popup点模型→选新的→切到side-panel发消息 | side-panel 收到回复，检查 modelName |
| 多脑图不覆盖 | 请求脑图A→请求脑图B | 两次截图内容不同，消息数递增 |
| 全屏 ESC 关闭 | 打开脑图→全屏→按ESC | 全屏消失，内联脑图仍可见 |
| 导出菜单标签 | 打开全屏→查看工具栏 | 按钮文本包含"复制文本"而非错误的"复制SVG" |

### 禁止 Mock 数据
- **可以**：mock 页面触发操作（file:// 协议加载本地 HTML）
- **禁止**：mock API 响应数据（`page.route('**/v1/models', ...)`）
- **必须**：使用真实模型配置跑通完整流程

### 测试执行命令
```bash
npm run build           # 必须先构建
npm test tests/self-test.spec.ts  # 仅跑自测
npm test                # 跑所有测试
```

### 违反后果
- Mock 数据 = 测试无效，用户会重复遇到线上 bug
- 不充分自测 = 提交不可用代码，浪费用户时间
- 同一错误重复出现 = 流程失效
