# 架构

## Chrome 扩展架构

### Background Script (`src/background/index.ts`)
- 服务工作线程，通过 Chrome runtime 端口处理 LLM 流式请求
- 使用 Zustand 管理状态持久化
- 协调内容脚本与 popup/options 页面之间的消息传递
- 处理 API 密钥的加密/解密

### Content Script (`src/content/index.ts`)
- 注入到所有网页中
- 处理文本选中检测和 UI 渲染
- 管理悬浮图标菜单、悬浮翻译窗口、侧边栏
- 收集选中文字周围的上下文
- 流式接收 LLM 响应并渲染 markdown

### Popup (`src/popup/`)
- 模型配置中心、站点开关、历史记录快速访问
- 通过 `chrome.storage.sync` 持久化

### Side Panel (`src/side-panel/`)
- Chrome Side Panel API 对话界面，流式响应
- 语音输入、历史会话持久化

### Options Page (`src/options/`)
- 全屏配置页面：模型管理/历史记录/翻译设置/显示模式

## LLM 提供商系统

- **基类**: `src/services/llm/base.ts`
- **工厂**: `src/services/llm/factory.ts`
- **提供商**: `src/services/llm/providers/` — OpenAI、Anthropic、DeepSeek、Qwen、GLM、OpenAI 兼容

## 状态管理

- **Zustand Store** (`src/store/index.ts`)
- `chrome.storage.sync`: 用户设置；`chrome.storage.local`: 聊天历史

## 消息传递

- **端口流式**: LLM 响应使用 `chrome.runtime.Port`
- **简单消息**: `chrome.runtime.sendMessage`
- 类型定义在 `src/types/messages.ts`

## 关键设计模式

| 模式 | 文件 | 说明 |
|------|------|------|
| 上下文收集 | `src/utils/context.ts` | 提取选中文字前后文本，限制长度 |
| 加密存储 | `src/services/llm/crypto.ts` | AES-256-GCM 加密 API 密钥 |
| 历史管理 | `src/utils/history-manager.ts` | 保留 7 天，最多 100 会话 |
| 悬浮翻译窗口 | `src/content/floating-window.ts` | 双面板、可拖拽、markdown 渲染 |
| 悬浮图标菜单 | `src/content/floating-icon.ts` | 二级菜单、拖拽、淡出动画 |
| 页面摘要 | `src/utils/content-extractor.ts` | 四层提取策略 |
| 脑图功能 | `src/content/mindmap.ts`, `src/components/mind-map/` | markmap 渲染，PNG/富文本导出 |
| 翻译系统 | `src/content/translation/` | 整页翻译、交互翻译 |
