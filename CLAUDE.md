# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在处理此代码库时提供指导。

## 关键指令（最高优先级）

### UI/CSS 修改指南
- 做 CSS/UI 修改时，做**最小的针对性修改**。避免连续修改多个无关 CSS 选择器（如 #root、.side-panel-container、.side-panel-content、.side-panel-input）。修改前与用户确认范围。
- 不要为了解答"图标多大"这类问题而跨文件修改代码——直接回答即可。

### Bug 修复验证
- 修复 bug 后，**始终验证修复是否生效**再标记完成。对 CSS 修复，检查视觉结果是否与用户描述匹配（不只是改大小，还要确认图标不再显示为黑色色块等）。
- 脑图/内联渲染修复：确认 AI 回复后实际渲染出脑图，而非仅显示文字。

### 代码提交
- 每次完整的修改完成后，**及时提交代码**。不要积累多个不相关的改动。
- 提交信息遵循 Conventional Commits 格式，描述清晰反映变更内容。

### 项目结构速查
- **关键文件**：`src/side-panel/App.tsx`（侧边栏 UI）、`src/options/App.tsx`（选项页）、`src/popup/App.tsx`（弹出页）、`src/content/floating-icon.ts`（悬浮图标）、`src/content/mindmap.ts`（脑图）、`src/content/floating-window.ts`（悬浮翻译窗）
- **配置文件**：`manifest.json`（扩展权限/配置）
- **调试提示**：遇到权限/插件冲突时优先检查 `manifest.json`

## 项目概述

Select Ask 是一款浏览器扩展，允许用户选中文本文字并与 AI 进行交互，用于解释、翻译和问答。该项目是基于 React + TypeScript + Vite 构建的 Chrome 扩展（Manifest V3）。

## 开发命令

### 浏览器扩展

```bash
cd browser-extension
npm install           # 安装依赖
npm run dev          # 开发模式，HMR 运行在端口 5173
npm run build        # 生产构建（输出到 dist/）
npm test             # 运行所有 Playwright 测试
npm run test:ui      # 带 UI 运行测试
npm run test:debug   # 调试测试
```

## 架构

### Chrome 扩展架构

扩展遵循 Chrome Extension Manifest V3 架构：

**Background Script** (`src/background/index.ts`)
- 服务工作线程，通过 Chrome runtime 端口处理 LLM 流式请求
- 使用 Zustand 管理状态持久化
- 协调内容脚本与 popup/options 页面之间的消息传递
- 处理 API 密钥的加密/解密

**Content Script** (`src/content/index.ts`)
- 注入到所有网页中
- 处理文本选中检测和 UI 渲染
- 管理悬浮图标菜单（带有操作按钮和问题输入的二级下拉菜单）
- 管理悬浮翻译窗口（双面板：原文 + 译文）
- 管理侧边栏显示模式，用于页内对话
- 收集选中文字周围的上下文，以获得更好的 AI 响应
- 流式接收 LLM 响应并渲染 markdown
- 支持后续对话（多轮对话）

**Popup** (`src/popup/`)
- 模型配置中心：单一模型选择 + 多模型管理
- 按站点切换扩展开启/关闭
- 快速访问历史记录和选项页
- 通过 `chrome.storage.sync` 持久化存储

**Side Panel** (`src/side-panel/`)
- 基于 Chrome Side Panel API 的对话界面
- 完整的聊天体验，支持流式响应
- 输入控件行中包含模型选择器
- 语音输入支持（开始/停止录音）
- 历史记录会话持久化，包含 pageUrl/pageTitle
- 使用 `marked` 库渲染 markdown

**Options Page** (`src/options/`)
- 全屏配置页面，采用标签页导航
- 模型管理：添加、编辑、删除、测试 LLM 提供商
- 历史记录查看器：搜索、查看、恢复过去的对话
- 翻译设置：源语言/目标语言、整页翻译配置
- 显示模式设置（悬浮框 vs 侧边栏）

### LLM 提供商系统

项目使用提供商模式来支持多种 LLM 服务：

- **基类**: `src/services/llm/base.ts` - 定义接口的抽象基类
- **工厂**: `src/services/llm/factory.ts` - 根据类型创建提供商实例
- **提供商**: `src/services/llm/providers/` - 实现包括：
  - OpenAI (`openai.ts`)
  - Anthropic/Claude (`anthropic.ts`)
  - DeepSeek (`deepseek.ts`) - 推理能力由 openai-compat.ts 实现，DeepSeek 仅标记 supportsReasoning
  - Qwen/通义千问 (`qwen.ts`) - OpenAICompatProvider 的薄封装，无自定义逻辑
  - GLM/智谱AI (`glm.ts`)
  - OpenAI 兼容 API (`openai-compat.ts`)

每个提供商实现 `streamChat()` 用于流式响应，并可选择性覆盖 `generateQuestions()`。

### 状态管理

- **Zustand Store** (`src/store/index.ts`): 全局状态，支持选择器
- **持久化**:
  - `chrome.storage.sync`: 用户设置（选中的模型、API 密钥）
  - `chrome.storage.local`: 聊天历史和会话数据
- **状态同步**: 后台脚本监听 store 变更并自动持久化

### 消息传递

扩展组件通过 Chrome runtime 消息进行通信：

- **基于端口的流式传输**: LLM 响应使用 `chrome.runtime.Port` 进行实时流式传输
- **简单消息**: 配置和状态查询使用 `chrome.runtime.sendMessage`
- **消息类型**: 定义在 `src/types/messages.ts`

### 关键设计模式

**上下文收集** (`src/utils/context.ts`)
- 提取选中文字前后的文本
- 限制上下文长度以避免超出 token 限制
- 提升 AI 响应的相关性

**加密存储** (`src/services/llm/crypto.ts`)
- 使用 AES-256-GCM 加密 API 密钥
- 密钥存储在 `chrome.storage.local`
- 永远不会传输到外部服务器（所选的 LLM 提供商除外）

**历史管理** (`src/utils/history-manager.ts`)
- 会话存储在 `chrome.storage.local`
- 根据第一条消息自动生成标题
- 扩展启动时自动清理（保留 7 天，最多 100 个会话）
- 每个会话包含：`pageUrl`、`pageTitle`、`selectedText`、`messages`、`modelId`

**悬浮翻译窗口** (`src/content/floating-window.ts`)
- 双面板布局：左侧显示原文，右侧显示译文
- 源语言和目标语言的选择下拉框
- 可拖拽窗口，通过标题栏拖拽
- 翻译内容支持 markdown 渲染
- 使用 Clipboard API 的复制翻译按钮
- 流式翻译光标动画

**悬浮图标菜单** (`src/content/floating-icon.ts`)
- 在文本选中位置附近出现，带有操作图标
- 二级下拉菜单（悬浮在选中区域附近），包含：
  - 解释、翻译、搜索操作按钮
  - 后续问题输入框（发送按钮在 textarea 内部）
- 支持拖拽重新定位
- 关闭时淡出动画

**页面摘要** (`src/utils/content-extractor.ts`)
- 从网页智能提取内容
- 四层提取策略（article 标签、语义 HTML、main/content div、段落回退）
- 用于页面级摘要功能

**脑图功能** (`src/content/mindmap.ts`, `src/content/mindmap-style.css`)
- 依赖：markmap-lib, markmap-view, markmap-toolbar, html-to-image
- 组件：`src/components/mind-map/`（MindMap.tsx, MindMapToolbar.tsx, MindMapFullscreen.tsx, useMindMapExport.ts, mindmap-utils.ts, mind-map.css）
- 入口：选中文本悬浮菜单、二级菜单、侧边栏
- 导出：下载 PNG、复制图片、复制富文本

**翻译系统**
- 翻译模块：`src/content/translation-dom.ts`, `translation-fullpage.ts`, `translation-interaction.ts`, `translation-manager.ts`
- 整页翻译功能：`translation-fullpage.ts`
- 样式：`translation-style.css`, `chat-style.css`

**组件库**
- `src/components/ChatMessage/` — 聊天消息组件
- `src/components/IconMenu/` — 图标菜单组件
- `src/components/mind-map/` — 脑图组件族

## 测试

测试使用 Playwright 搭配 Chromium 浏览器：

- **测试文件**: 位于 `browser-extension/tests/`
- **测试页面**: 测试使用真实网页模拟真实场景
- **扩展加载**: 测试自动加载未打包的扩展
- **测试分类**:
  - `extension.spec.ts` — 基本功能测试
  - `extension-features.spec.ts` — 特定功能测试
  - `extension-real.spec.ts` — 真实 API 调用测试（需要 API 密钥）
  - `extension-local.spec.ts` — 纯本地测试
  - `extension-full.spec.ts` — 全面的端到端测试
  - `floating-icon-navigation.spec.ts` — 悬浮图标导航测试
  - `fullpage-translate.spec.ts` — 整页翻译测试
  - `mindmap-e2e.spec.ts` — 脑图 E2E 测试
  - `mindmap-entries.spec.ts` — 脑图三入口测试
  - `mindmap.spec.ts` — 脑图功能测试
  - `page-summary.spec.ts` — 页面摘要测试
  - `test-translate.spec.ts` — 翻译功能测试
  - `translation-full.spec.ts` — 翻译完整测试

**测试要求**:
- 先构建扩展：`npm run build`
- 测试需要 dist/ 目录存在
- 对于真实 API 测试，需在扩展中配置 API 密钥
- E2E 测试指南详见 `browser-extension/docs/E2E_TESTING.md`

## 重要技术细节

### Vite 构建配置

扩展使用 `@crxjs/vite-plugin` 处理 Chrome 扩展相关事务：
- 自动处理 manifest
- 内容脚本 CSS 注入
- 开发时 HMR 支持
- 类型：module（全面使用 ESM）
- 开发服务器运行在端口 5173，HMR 运行在端口 5174

### API 密钥安全

- 永远不要以明文形式记录或暴露 API 密钥
- 存储前始终使用 `src/services/llm/crypto.ts` 中的 `encryptApiKey()`
- 仅在发起 API 调用时解密
- 密钥存储在 Chrome 本地存储中，永远不会发送到任何后端（所选的 LLM 提供商除外）

### 国际化

- 扩展名称和描述在 manifest.json 中使用 `__MSG_*__` 格式
- `_locales/` 目录中支持的语言环境：
  - `en`（英语）
  - `zh_CN`（简体中文）
- 自动跟随浏览器语言设置
- 详见 `browser-extension/I18N.md`

### LLM 响应处理

- 所有提供商都通过异步生成器支持流式传输
- DeepSeek 支持推理输出（推理能力由 openai-compat.ts 实现，DeepSeek 仅标记 supportsReasoning；在模型配置中设置 `addReasoning: true` 可显示推理内容）
- 响应使用 `marked` 库以 markdown 格式渲染
- 错误处理：优雅降级，提供用户友好的错误消息
- 流式传输使用 Chrome runtime 端口进行实时更新

### Chrome 扩展权限

**所需权限**:
- `storage`: 用于存储设置、API 密钥和聊天历史
- `scripting`: 用于注入内容脚本
- `sidePanel`: 用于 Chrome Side Panel API
- `tabs`: 用于标签页管理（页面摘要、URL 跟踪）

**主机权限**:
- 特定的 LLM API 域名：
  - `https://api.openai.com/*`
  - `https://api.anthropic.com/*`
  - `https://api.deepseek.com/*`
  - `https://dashscope.aliyuncs.com/*`（Qwen/通义千问）
  - `https://open.bigmodel.cn/*`（GLM/智谱AI）
- `<all_urls>`: 用于在所有页面上注入内容脚本

**Web 可访问资源**:
- `public/icons/*`、`public/logos/*`、`src/assets/*`

## 代码规范

### TypeScript
- 启用严格模式
- 所有类型定义在 `src/types/`
- 使用 interface 定义对象结构
- 避免使用 `any` 类型

### React
- 使用 hooks 的函数式组件
- 组件名称使用 PascalCase
- Props 使用 interface
- 保持组件专注且小巧

### 样式
- 使用 TailwindCSS 进行样式设计
- 需要时在 `.css` 文件中编写自定义样式
- 响应式设计原则

### 文件命名
- React 组件：`PascalCase.tsx`
- TypeScript 文件：`camelCase.ts`
- 样式文件：`kebab-case.css`
- 测试文件：`*.spec.ts`（Playwright）

### 异步操作
- 使用 async/await，而非原始 Promise
- 使用 try-catch 优雅地处理错误
- 提供用户友好的错误消息

### 错误处理
- 永远不要向用户暴露堆栈跟踪
- 验证 API 响应
- 优雅地处理网络故障
- 显示可操作的错误消息

## 提交规范

本项目遵循 [Conventional Commits](https://www.conventionalcommits.org/)：

```
<type>(<scope>): <subject>

<body>

<footer>
```

**类型**:
- `feat`: 新功能
- `fix`: 修复 bug
- `docs`: 文档更新
- `style`: 代码格式（无功能变更）
- `refactor`: 代码重构
- `perf`: 性能优化
- `test`: 测试相关
- `chore`: 构建流程或工具变更

**示例**:
```
feat(content): add page summarization feature
fix(llm): handle DeepSeek reasoning output correctly
docs(readme): update installation instructions
```

## 开发时加载扩展

1. 在 `browser-extension/` 中运行 `npm run dev` 或 `npm run build`
2. 打开 Chrome 并导航到 `chrome://extensions/`
3. 启用"开发者模式"（右上角的开关）
4. 点击"加载已解压的扩展程序"
5. 选择 `browser-extension/` 目录
6. 扩展应该会出现在你的工具栏中

使用 HMR 开发模式时，运行 `npm run dev`，扩展会在你修改时热重载。

## 架构图

### 数据流

```
用户选中文本
  → 内容脚本检测到选中
  → 悬浮图标出现在选中区域附近
  → 用户点击图标 → 二级菜单显示操作
  → 用户选择操作（解释/翻译/提问/搜索）
  → 收集上下文（前后文本、选中区域上下文）
  → 内容脚本通过端口向后台发送 LLM_STREAM_START
  → 后台脚本创建到 LLM 提供商的流式端口
  → LLM 提供商通过 LLM_STREAM_CHUNK 流式响应数据块
  → 内容脚本实时渲染 markdown
  → 用户可继续对话（多轮后续）
  → 完成后会话保存到 chrome.storage.local
  → 可通过选项页的历史记录标签页访问会话
```

### 消息类型

详见 `src/types/messages.ts` 中的消息类型定义：
- `LLM_STREAM_START`: 开始 LLM 流式会话
- `LLM_STREAM_CHUNK`: 流式响应数据块
- `LLM_STREAM_ERROR`: LLM 调用期间发生错误
- `LLM_STREAM_END`: 流式传输完成
- 端口名称：`llm-stream`（定义为 `LLM_STREAM_PORT_NAME`）

## 项目规则

- **内容脚本无法访问 `chrome.*` API** — 所有扩展 API 调用必须通过消息传递到后台脚本
- **永远不要对未消毒的内容使用 `eval()` 或 `innerHTML`** — 内容脚本运行在用户页面上下文中，XSS 是关键安全问题
- **Service Worker 生命周期** — 后台脚本是短生命周期的 service worker；不要依赖事件之间的全局状态持久性
- **永远不要以明文形式记录或暴露 API 密钥** — 存储前始终使用 `encryptApiKey()`，仅在发起 API 调用时解密
- **测试前先构建** — 测试需要 `dist/` 目录；在 `npm test` 之前在 `browser-extension/` 中运行 `npm run build`

## 项目代码地图

> 快速定位文件，按功能分组。所有路径相对 `browser-extension/src/`。

### 入口文件
| 文件 | 用途 |
|---|---|
| `content/index.ts` | 内容脚本主入口，注入所有页面内 UI |
| `background/index.ts` | Service Worker，LLM 流式代理、状态持久化 |
| `side-panel/main.tsx` | 侧边栏 React 应用入口 |
| `options/main.tsx` | 选项页 React 应用入口 |
| `popup/main.tsx` | 弹出页 React 应用入口 |

### 页面应用
| 文件 | 改动场景 |
|---|---|
| `side-panel/App.tsx` | 侧边栏聊天 UI、模型选择器、脑图展示 |
| `options/App.tsx` | 选项页：模型管理/历史记录/翻译设置/显示模式 |
| `popup/App.tsx` | 弹出页：快速模型选择、站点开关 |

### 内容脚本 UI 组件
| 文件 | 改动场景 |
|---|---|
| `content/floating-icon.ts` | 悬浮图标入口、事件绑定 |
| `content/floating-window.ts` | 悬浮翻译窗口、双面板布局 |
| `content/mindmap.ts` | 页面内脑图面板渲染 |
| `content/components/action-buttons.ts` | 操作按钮组件 |
| `content/components/chat-box.ts` | 聊天窗口 DOM、拖拽、模式切换 |
| `content/components/fullscreen-mode.ts` | 全屏模式、历史面板 |
| `content/components/icon-menu.ts` | 图标菜单 DOM |
| `content/components/model-selector.ts` | 模型选择下拉框 |
| `content/components/sidebar.ts` | 侧边栏 DOM 组件 |
| `content/components/translation-ui.ts` | 翻译窗口 UI |

### 内容脚本 Handlers
| 文件 | 改动场景 |
|---|---|
| `content/handlers/menu-handler.ts` | 菜单点击处理 |
| `content/handlers/mindmap-handler.ts` | 脑图生成 |
| `content/handlers/summary-handler.ts` | 页面摘要 |

### 内容脚本工具
| 文件 | 改动场景 |
|---|---|
| `content/utils/dom-utils.ts` | 选择/定位/图标移除 |
| `content/utils/helpers.ts` | 通用 DOM 工具 |
| `content/utils/layout.ts` | UI 定位计算、侧边栏布局 |
| `content/utils/response-cache.ts` | 响应缓存 |
| `content/utils/selection.ts` | 文本选中检测 |
| `content/utils/session-manager.ts` | 会话管理、菜单分发、后续对话 |
| `content/utils/floating-position.ts` | 悬浮窗口位置 |
| `content/utils/svg-helpers.ts` | SVG 创建工具 |

### 翻译系统
| 文件 | 改动场景 |
|---|---|
| `content/translation/dom.ts` | 翻译 DOM 操作 |
| `content/translation/fullpage.ts` | 整页翻译 |
| `content/translation/interaction.ts` | 翻译交互 |
| `content/translation/manager.ts` | 翻译管理 |
| `content/translation/style.css` | 翻译样式 |

### 内容脚本样式
| 文件 | 作用域 |
|---|---|
| `content/styles/base.css` | 全局基础样式 |
| `content/chat/style.css` | 聊天对话样式 |
| `content/styles/mindmap.css` | 脑图样式 |

### LLM 服务
| 文件 | 改动场景 |
|---|---|
| `services/llm/base.ts` | LLM 抽象基类 |
| `services/llm/factory.ts` | 提供商工厂 |
| `services/llm/crypto.ts` | API 密钥 AES 加密 |
| `services/llm/providers/openai.ts` | OpenAI 提供商 |
| `services/llm/providers/anthropic.ts` | Claude 提供商 |
| `services/llm/providers/deepseek.ts` | DeepSeek 提供商 |
| `services/llm/providers/qwen.ts` | 通义千问提供商 |
| `services/llm/providers/glm.ts` | 智谱 AI 提供商 |
| `services/llm/providers/openai-compat.ts` | OpenAI 兼容通用提供商 |
| `services/content-llm.ts` | 内容脚本 LLM 调用封装 |
| `services/api-client.ts` | 通用 API 客户端 |
| `services/prompts.ts` | AI 提示词模板 |

### 状态与存储
| 文件 | 改动场景 |
|---|---|
| `store/index.ts` | Zustand 全局状态 |
| `utils/storage.ts` | Chrome storage 封装 |
| `utils/config-manager.ts` | 配置管理 |
| `utils/history-manager.ts` | 历史记录 CRUD |

### 共享组件
| 文件 | 改动场景 |
|---|---|
| `components/ChatMessage/ChatMessage.tsx` | 聊天消息气泡 |
| `components/IconMenu/IconMenu.tsx` | 图标菜单 React 组件 |
| `components/MindMap/MindMap.tsx` | 脑图核心渲染 |
| `components/MindMap/MindMapToolbar.tsx` | 脑图工具栏 |
| `components/MindMap/MindMapFullscreen.tsx` | 脑图全屏模式 |
| `components/MindMap/useMindMapExport.ts` | 脑图导出 Hook |
| `components/MindMap/mindmap-utils.ts` | 脑图工具函数 |

### Hooks
| 文件 | 用途 |
|---|---|
| `hooks/useClickOutside.ts` | 点击外部检测关闭 |
| `hooks/useI18n.tsx` | 国际化 Hook |

### 工具函数
| 文件 | 改动场景 |
|---|---|
| `utils/context.ts` | 选中文字上下文提取 |
| `utils/content-extractor.ts` | 页面内容智能提取 |
| `utils/markdown.ts` | Markdown 渲染工具 |
| `utils/shared.ts` | 跨模块共享工具 |
| `utils/i18n.ts` | 国际化文本管理 |

### 类型定义
| 文件 | 内容 |
|---|---|
| `types/messages.ts` | Chrome 消息传递类型 |
| `types/store.ts` | Zustand Store 类型 |
| `types/llm.ts` | LLM 相关类型 |
| `types/message.ts` | 消息/对话类型 |
| `types/history.ts` | 历史记录类型 |
| `types/config.ts` | 配置类型 |
| `types/api.ts` | API 类型 |
| `types/selection.ts` | 选中文字类型 |

### 后台服务
| 文件 | 改动场景 |
|---|---|
| `background/llm-service.ts` | LLM 流式请求处理 |

### 配置文件
| 文件 | 改动场景 |
|---|---|
| `manifest.json` | 扩展权限、入口、内容脚本配置 |
| `vite.config.ts` | Vite 构建配置 |
| `tailwind.config.js` | TailwindCSS 配置 |

## 性能考虑

- 上下文收集限制文本长度以避免超出 token 限制
- 流式响应提供即时反馈
- 历史记录清理在扩展启动时运行（保留 7 天）
- 内容提取使用多种回退策略以确保可靠性
- API 调用使用 abort controller 支持取消

<!-- code-review-graph MCP tools -->
## MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. ALWAYS use the
code-review-graph MCP tools BEFORE using Grep/Glob/Read to explore
the codebase.** The graph is faster, cheaper (fewer tokens), and gives
you structural context (callers, dependents, test coverage) that file
scanning cannot.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes` or `query_graph` instead of Grep
- **Understanding impact**: `get_impact_radius` instead of manually tracing imports
- **Code review**: `detect_changes` + `get_review_context` instead of reading entire files
- **Finding relationships**: `query_graph` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview` + `list_communities`

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need.

### Key Tools

| Tool | Use when |
|------|----------|
| `detect_changes` | Reviewing code changes — gives risk-scored analysis |
| `get_review_context` | Need source snippets for review — token-efficient |
| `get_impact_radius` | Understanding blast radius of a change |
| `get_affected_flows` | Finding which execution paths are impacted |
| `query_graph` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes` | Finding functions/classes by name or keyword |
| `get_architecture_overview` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. Use `detect_changes` for code review.
3. Use `get_affected_flows` to understand impact.
4. Use `query_graph` pattern="tests_for" to check coverage.
