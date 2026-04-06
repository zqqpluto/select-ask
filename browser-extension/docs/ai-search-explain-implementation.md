# AI 搜索与解释功能实现文档

## 概述

本文档详细说明了 Select Ask 浏览器扩展中 AI 搜索和 AI 解释功能的实现细节，包括提示词设计、代码架构和数据流。

---

## 核心区别

| 维度 | AI 搜索 | AI 解释 |
|------|--------|--------|
| **定位** | "找信息" - 偏检索 | "理解信息" - 偏解读 |
| **开头指令** | "请搜索并提供关于...的信息" | "请用通俗易懂的方式解释..." |
| **侧重点** | 检索、匹配、整理信息 | 解读、翻译、简化、说明 |
| **要点 1** | 核心定义/概述 | 大白话讲清楚是什么 |
| **要点 2** | 关键要点或特征 | 抽象概念用简单类比说明 |
| **要点 3** | 相关背景或来源 | 逻辑关系分步骤拆解 |
| **要点 4** | 扩展信息或关联概念 | 相关背景或概念说明 |

---

## 提示词设计

### AI 解释功能（Explain）

#### 无上下文时
```
请用通俗易懂的方式解释"${selectedText}"。

请从以下几个方面进行说明（如果相关）：
1. 用大白话讲清楚是什么
2. 如有抽象概念，用简单类比说明
3. 如有逻辑关系，分步骤拆解
4. 补充相关背景或概念说明
```

#### 有上下文时
```
请用通俗易懂的方式解释"${selectedText}"。

上下文：
...${context.beforeText}【${selectedText}】${context.afterText}...

请结合上下文从以下几个方面进行说明（如果相关）：
1. 在当前语境中的具体含义（用大白话）
2. 与上下文的关联关系
3. 如有抽象概念，用简单类比说明
4. 如有逻辑关系，分步骤拆解
5. 相关背景或补充信息
```

---

### AI 搜索功能（Search）

#### 无上下文时
```
请搜索并提供关于"${selectedText}"的信息。

请从以下几个方面进行整理（如果相关）：
1. 核心定义/概述
2. 关键要点或特征
3. 相关背景或来源
4. 扩展信息或关联概念
```

#### 有上下文时
```
请搜索并提供关于"${selectedText}"的信息。

上下文：
...${context.beforeText}【${selectedText}】${context.afterText}...

请结合上下文从以下几个方面进行整理（如果相关）：
1. 在当前语境中的具体含义
2. 关键要点或特征
3. 与上下文的关联关系
4. 相关背景或扩展信息
```

---

## 代码架构

### 文件结构

```
src/
├── services/
│   ├── prompts.ts        # 提示词生成函数
│   └── content-llm.ts    # Content Script LLM 服务
├── background/
│   └── llm-service.ts    # Background Service LLM 处理
└── types/
    ├── messages.ts       # 消息类型定义
    └── llm.ts            # LLM 相关类型定义
```

---

### 核心模块

#### 1. prompts.ts - 提示词生成

**位置**: `src/services/prompts.ts`

提供四个主要的 prompt 生成函数：

```typescript
// 解释 Prompt（带上下文）
export function createExplainPrompt(selectedText: string, context?: ContextData): string

// 搜索 Prompt（AI 搜索）
export function createSearchPrompt(selectedText: string, context?: ContextData): string

// 翻译 Prompt
export function createTranslatePrompt(selectedText: string, targetLanguage: string = '中文'): string

// 提问 Prompt（带上下文）
export function createQuestionPrompt(userQuestion: string, selectedText: string, context?: ContextData): string
```

**设计特点**:
- 根据是否有上下文动态调整 prompt 内容
- 使用模板字符串插入选中文本和上下文
- 用 `【】` 标记选中文本位置

---

#### 2. content-llm.ts - Content Script LLM 服务

**位置**: `src/services/content-llm.ts`

负责在 Content Script 中处理 LLM 调用，通过 Background Service Worker 代理 API 请求以避免 CORS 问题。

**核心函数**:

```typescript
// 流式请求生成器
async function* streamViaBackground(
  action: 'explain' | 'translate' | 'question' | 'search',
  text: string,
  question?: string,
  context?: LLMContext
): AsyncGenerator<string, void, unknown>

// 构建解释 Prompt
function buildExplainPrompt(text: string, context?: LLMContext): LLMMessage[]

// 构建搜索 Prompt
function buildSearchPrompt(text: string, context?: LLMContext): LLMMessage[]

// 公开 API
export async function* streamExplain(text: string, context?: LLMContext)
export async function* streamSearch(text: string, context?: LLMContext)
export async function* streamTranslate(text: string)
export async function* streamQuestion(question: string, text: string, context?: LLMContext)
```

**流式请求流程**:

```
1. 获取当前选择的模型配置
2. 创建 chrome.runtime.Port 连接到 Background
3. 发送 LLM_STREAM_START 消息
4. 监听端口消息（CHUNK/ERROR/END）
5. 通过 AsyncGenerator 产出文本块
6. 端口断开时清理资源
```

---

#### 3. llm-service.ts - Background Service 处理

**位置**: `src/background/llm-service.ts`

在 Background Service Worker 中处理来自 Content Script 的 LLM 请求，代理实际的 API 调用。

**核心函数**:

```typescript
// 构建 LLM 消息
function buildMessages(
  action: 'explain' | 'translate' | 'question' | 'generateQuestions' | 'search',
  text: string,
  question?: string,
  context?: LLMContext
): LLMMessage[]

// 处理流式请求
export async function handleLLMStream(
  port: chrome.runtime.Port,
  request: {
    action?: 'explain' | 'translate' | 'question' | 'generateQuestions' | 'search';
    text?: string;
    question?: string;
    context?: LLMContext;
    modelId: string;
    messages?: { role: string; content: string }[];
  }
): Promise<void>
```

**支持两种请求格式**:
1. **Content Script 格式**: action + text + context
2. **Side Panel 格式**: messages 数组

---

## 数据流

### 完整调用链路

```
用户触发 AI 功能
       ↓
Content Script (content-llm.ts)
       ↓
streamViaBackground() - 创建 Port 连接
       ↓
chrome.runtime.Port 消息传递
       ↓
Background Service (llm-service.ts)
       ↓
handleLLMStream() - 处理请求
       ↓
buildMessages() - 构建消息
       ↓
getLLMProvider() - 获取 Provider
       ↓
provider.streamChat(messages) - 流式调用
       ↓
LLM API (OpenAI/Anthropic 等)
       ↓
响应数据通过 Port 回传
       ↓
Content Script 接收 CHUNK 消息
       ↓
UI 更新显示结果
```

---

## 类型定义

### LLMContext

```typescript
interface LLMContext {
  before?: string;  // 选中文本前的内容
  after?: string;   // 选中文本后的内容
}
```

### LLMMessage

```typescript
interface LLMMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}
```

### ContextData

```typescript
interface ContextData {
  beforeText: string;  // 选中文本前的内容
  afterText: string;   // 选中文本后的内容
}
```

---

## 扩展其他 AI 功能

如需添加新的 AI 功能（如总结、改写等），需要：

1. **在 prompts.ts 中添加 prompt 生成函数**
2. **在 content-llm.ts 中添加**:
   - `buildXxxPrompt()` 函数
   - `streamXxx()` 导出函数
   - 在 `streamViaBackground()` 的 action 类型中添加新值
3. **在 llm-service.ts 中添加**:
   - `buildMessages()` 的 case 分支
   - action 类型定义

---

## 调试技巧

1. **查看 Background 日志**: Chrome DevTools → Service Workers → background.js
2. **查看 Content 日志**: Chrome DevTools → 目标页面 → Console
3. **Port 消息调试**: 在 `port.onMessage.addListener()` 中打断点

---

## 相关文件索引

| 文件 | 说明 |
|------|------|
| `src/services/prompts.ts` | 提示词模板定义 |
| `src/services/content-llm.ts` | Content Script LLM 调用 |
| `src/background/llm-service.ts` | Background LLM 代理 |
| `src/types/messages.ts` | 消息类型定义 |
| `src/types/llm.ts` | LLM 相关类型 |
| `src/utils/config-manager.ts` | 模型配置管理 |

---

**文档最后更新**: 2026-04-06
