# Playwright vs Vercel Agent Browser 对比分析

## 测试工具选型：Select Ask 浏览器扩展 E2E 测试

> 生成日期：2026-04-11
> 目的：评估当前 Playwright 方案与 Vercel Agent Browser 的适用性

---

## 核心定位差异

| | **Playwright** | **Vercel Agent Browser** |
|---|---|---|
| **定位** | 专业 E2E 测试框架 | AI Agent 驱动的浏览器自动化工具 |
| **测试范式** | 确定性断言（expect/assert） | AI 语义理解 + 自然语言操作 |
| **语言** | JavaScript/TypeScript、Python 等 | Rust CLI，通过 CDP 协议控制浏览器 |
| **适用场景** | 可重复、可验证的 E2E 测试 | AI Agent 自主浏览网页、数据采集 |

**关键结论**：两者并非同类工具的替代关系，而是解决不同问题的工具。

---

## 六维度对比

### 1. Chrome Extension 支持

**Playwright（9/10）**
- 官方 Chrome Extensions 文档支持
- `chromium.launchPersistentContext()` + `--load-extension` 加载扩展
- 支持 Manifest V3 Service Worker 监听
- 可访问 `chrome-extension://` 内部页面
- 可通过 `page.evaluate()` 操作 `chrome.storage` API

**Agent Browser（3/10）**
- `--extension` 参数支持加载扩展
- `--extension` 和 `--profile` 互斥，无法同时使用持久化配置
- 已知 Bug：content scripts 未注入、扩展页面交互不完整
- 无 Service Worker 监听或通信机制

### 2. 测试稳定性

**Playwright（9/10）**
- 内置 auto-wait 机制
- `expect` 断言自带重试和超时
- 支持 test retries
- 内置 trace viewer 和截图/视频录制

**Agent Browser（2/10）**
- 无断言机制，无法做确定性验证
- AI 驱动 = 非确定性行为
- 无 test retry、trace、screenshot-on-failure

### 3. AI 流式响应验证

**Playwright（8/10）**
- `expect(locator).toContainText()` 自动轮询重试，天然适配流式输出
- `page.waitForFunction()` 等待任意 JS 条件
- 可拦截网络请求验证 API 调用

**Agent Browser（3/10）**
- 可以让 AI "看看页面文字"，但不可量化
- 无法做精确文本对比、数量统计、状态验证

### 4. 学习成本与生态

**Playwright（8/10）**
- Microsoft 官方维护，70k+ stars
- 项目已编写 5 个测试 spec 文件
- 成熟的 CI/CD 集成

**Agent Browser（4/10）**
- 2026 年初发布，项目新、生态小
- 文档仍在完善中

### 5. 性能

**Playwright（8/10）** — 支持并行执行、sharding
**Agent Browser（7/10）** — Rust 实现轻量，但缺少并行测试能力

### 6. 社区与维护

**Playwright（9/10）** — 企业级支持
**Agent Browser（4/10）** — 600+ issues，尚未达到生产级稳定性

---

## 综合评分

| 维度 | Playwright | Agent Browser |
|---|---|---|
| Chrome Extension 支持 | 9/10 | 3/10 |
| 测试稳定性 | 9/10 | 2/10 |
| AI 流式响应验证 | 8/10 | 3/10 |
| 学习成本/生态 | 8/10 | 4/10 |
| 性能 | 8/10 | 7/10 |
| 社区/维护 | 9/10 | 4/10 |
| **总分** | **51/60** | **23/60** |

---

## 推荐结论

**强烈推荐继续使用 Playwright，不建议切换到 Vercel Agent Browser。**

### 核心理由

1. **本质不匹配**：Agent Browser 是"让 AI 操作浏览器"的工具，不是"对应用进行确定性测试"的框架
2. **Chrome Extension 支持差距巨大**：Playwright 有官方扩展测试方案，Agent Browser 存在已知 Bug
3. **流式响应验证是 Playwright 的强项**：auto-wait + 断言重试天然适配 AI 流式输出
4. **已有投资**：已有 5 个测试 spec 文件，切换成本大于收益

### Agent Browser 的适用场景

- AI Agent 探索性测试（exploratory testing）
- 非确定性的网页抓取
- 需要 AI 理解页面语义的复杂自动化

### Playwright 改进建议

- 将硬编码 `waitForTimeout()` 替换为 `locator.waitFor()` 智能等待
- 使用带 poll 的 `expect` 验证流式响应
- 测试启动时验证模型配置，失败则中断整个测试流程
