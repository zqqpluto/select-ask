# AI 搜索与解释功能实现文档

## 概述

本文档详细说明了 Select Ask 浏览器扩展中 AI 搜索和 AI 解释功能的实现细节，包括**系统提示词**、**用户提示词**设计、代码架构和数据流。

---

## 提示词结构

代码中**区分了系统提示词（system prompt）和用户提示词（user prompt）**，完整的 LLM 消息结构为：

```typescript
[
  { role: 'system', content: '系统提示词 - 定义 AI 助手的人设和行为规范' },
  { role: 'user', content: '用户提示词 - 具体的任务指令和输入内容' }
]
```

---

## 核心区别对比

| 维度 | AI 搜索 | AI 解释 |
|------|--------|--------|
| **系统提示词** | "专业的信息检索助手" | "专业的知识解释助手" |
| **用户提示词开头** | "请搜索并提供关于...的信息" | "请用通俗易懂的方式解释..." |
| **定位** | "找信息" - 偏检索 | "理解信息" - 偏解读 |
| **侧重点** | 检索、匹配、整理信息 | 解读、翻译、简化、说明 |
| **要点 1** | 核心定义/概述 | 大白话讲清楚是什么 |
| **要点 2** | 关键要点或特征 | 抽象概念用简单类比说明 |
| **要点 3** | 相关背景或来源 | 逻辑关系分步骤拆解 |
| **要点 4** | 扩展信息或关联概念 | 相关背景或概念说明 |

---

## 系统提示词（System Prompt）

### AI 解释功能
```
你是一个专业的知识解释助手，擅长用通俗易懂的方式解释复杂概念。
你的回答应该：
- 使用简单易懂的语言，避免过度专业化
- 多用类比和例子帮助理解
- 逻辑清晰，分步骤讲解
- 提供相关背景知识但不要偏离主题
```

### AI 搜索功能
```
你是一个专业的信息检索助手，擅长搜索、整理和提供准确的事实信息。
你的回答应该：
- 优先提供可验证的事实信息
- 清晰标注信息来源或依据
- 综合多个来源的信息进行整理
- 对于专业术语提供准确的定义
- 区分事实和推测
```

### 翻译功能
```
你是一个专业的翻译助手，擅长准确传达原文含义。
你的翻译应该：
- 保持原文的语调和风格
- 准确传达原文含义，不随意增减内容
- 专业术语使用对应的标准翻译
- 输出仅包含翻译结果，不要添加额外解释
```

---

## 用户提示词（User Prompt）

### AI 解释功能

#### 无上下文时
```
请用通俗易懂的方式解释以下内容：

${text}

请从以下几个方面进行说明（如果相关）：
1. 用大白话讲清楚是什么
2. 如有抽象概念，用简单类比说明
3. 如有逻辑关系，分步骤拆解
4. 补充相关背景或概念说明
```

#### 有上下文时
```
请用通俗易懂的方式解释以下内容：

${text}

上下文：
...${context.before}【${text}】${context.after}...

请结合上下文从以下几个方面进行说明（如果相关）：
1. 在当前语境中的具体含义（用大白话）
2. 与上下文的关联关系
3. 如有抽象概念，用简单类比说明
4. 如有逻辑关系，分步骤拆解
5. 相关背景或补充信息
```

---

### AI 搜索功能

#### 无上下文时
```
请搜索并提供关于以下内容的相关信息：

${text}

请从以下几个方面进行整理（如果相关）：
1. 核心定义/概述
2. 关键要点或特征
3. 相关背景或来源
4. 扩展信息或关联概念
```

#### 有上下文时
```
请搜索并提供关于以下内容的相关信息：

${text}

上下文：
...${context.before}【${text}】${context.after}...

请结合上下文从以下几个方面进行整理（如果相关）：
1. 在当前语境中的具体含义
2. 关键要点或特征
3. 与上下文的关联关系
4. 相关背景或扩展信息
```

---

### 翻译功能

```
请将以下内容翻译成${targetLang}：

${text}
```

（`targetLang` 根据浏览器语言自动确定，如：中文、英文、日语等）

---

### 自定义问题回答

#### 无上下文时
```
${question}

选中文本：${text}
```

#### 有上下文时
```
${question}

选中文本：${text}

上下文：
...${context.before}【${text}】${context.after}...
```

---

### 问题生成

#### 无上下文时
```
请分析以下文本，提炼出用户最可能提出的 5 个问题。

文本内容：
${text}

要求：
1. 问题针对选中文本
2. 简洁、具体、有针对性
3. 直接返回 5 个问题，每行一个问题，不要序号或其他格式
```

#### 有上下文时
```
请分析以下文本和上下文，提炼出用户最可能提出的 5 个关于选中文本的问题。

选中文本：${text}

上下文：
...${context.before}【${text}】${context.after}...

要求：
1. 问题针对选中文本
2. 结合上下文背景
3. 简洁、具体、有针对性
4. 直接返回 5 个问题，每行一个问题，不要序号或其他格式
```

---

## 代码架构

### 文件结构

```
src/
├── services/
│   ├── prompts.ts           # 提示词生成函数（用户提示词）
│   ├── content-llm.ts       # Content Script LLM 服务
│   └── llm/
│       ├── base.ts          # LLM Provider 基类
│       └── providers/
│           ├── anthropic.ts # Anthropic Provider
│           └── openai.ts    # OpenAI Provider
├── background/
│   └── llm-service.ts       # Background Service LLM 处理（系统提示词 + 用户提示词）
└── types/
    ├── messages.ts          # 消息类型定义
    ├── llm.ts               # LLM 相关类型定义
    └── api.ts               # API 请求类型定义
```

---

### 核心模块

#### 1. prompts.ts - 用户提示词生成

**位置**: `src/services/prompts.ts`

提供用户提示词的生成函数（**注：此文件仅生成 user prompt，不包含 system prompt**）：

```typescript
// 解释 Prompt（带上下文）- 仅用户提示词部分
export function createExplainPrompt(selectedText: string, context?: ContextData): string

// 搜索 Prompt（AI 搜索）- 仅用户提示词部分
export function createSearchPrompt(selectedText: string, context?: ContextData): string

// 翻译 Prompt - 仅用户提示词部分
export function createTranslatePrompt(selectedText: string, targetLanguage: string = '中文'): string

// 提问 Prompt（带上下文）- 仅用户提示词部分
export function createQuestionPrompt(userQuestion: string, selectedText: string, context?: ContextData): string
```

---

#### 2. llm-service.ts - 系统提示词 + 用户提示词组装

**位置**: `src/background/llm-service.ts`

在 Background Service Worker 中负责：
1. 根据 action 类型选择**系统提示词**
2. 根据 action 类型和上下文生成**用户提示词**
3. 组装完整的消息数组

```typescript
function buildMessages(
  action: 'explain' | 'translate' | 'question' | 'generateQuestions' | 'search',
  text: string,
  question?: string,
  context?: LLMContext
): LLMMessage[] {
  const messages: LLMMessage[] = [];

  // 步骤 1: 添加系统提示词
  let systemContent = '';
  switch (action) {
    case 'explain':
      systemContent = `你是一个专业的知识解释助手...`;
      break;
    case 'search':
      systemContent = `你是一个专业的信息检索助手...`;
      break;
    case 'translate':
      systemContent = `你是一个专业的翻译助手...`;
      break;
  }
  if (systemContent) {
    messages.push({ role: 'system', content: systemContent });
  }

  // 步骤 2: 构建用户消息
  let userContent = '';
  switch (action) {
    case 'explain':
      userContent = `请用通俗易懂的方式解释...`;
      break;
    case 'search':
      userContent = `请搜索并提供关于...`;
      break;
    // ...
  }
  messages.push({ role: 'user', content: userContent });

  return messages;
}
```

---

#### 3. providers/anthropic.ts - 处理不同 Provider 的消息格式

**位置**: `src/services/llm/providers/anthropic.ts`

不同 LLM Provider 对系统提示词的处理方式不同：

```typescript
protected buildRequestBody(messages: LLMMessage[]): object {
  // 分离 system 消息
  const systemMessage = messages.find(m => m.role === 'system');
  const chatMessages = messages.filter(m => m.role !== 'system');

  return {
    model: this.config.modelId,
    max_tokens: 4096,
    system: systemMessage?.content,  // Anthropic API 使用独立的 system 字段
    messages: chatMessages.map(m => ({
      role: m.role,
      content: m.content,
    })),
  };
}
```

---

## 数据流

### 完整调用链路

```
用户触发 AI 功能
       ↓
Content Script (content-llm.ts)
       ↓
streamViaBackground() - 创建 Port 连接，发送 action/text/context
       ↓
chrome.runtime.Port 消息传递
       ↓
Background Service (llm-service.ts)
       ↓
buildMessages() - 组装 system prompt + user prompt
       ↓
getLLMProvider() - 获取 Provider
       ↓
provider.streamChat(messages) - 流式调用
       ↓
Anthropic/OpenAI API
       ↓
响应数据通过 Port 回传
       ↓
Content Script 接收 CHUNK 消息
       ↓
UI 更新显示结果
```

---

## 类型定义

### LLMMessage

```typescript
export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}
```

### LLMContext

```typescript
export interface LLMContext {
  before?: string;  // 选中文本前的内容
  after?: string;   // 选中文本后的内容
}
```

### ContextData

```typescript
export interface ContextData {
  beforeText: string;  // 选中文本前的内容
  afterText: string;   // 选中文本后的内容
}
```

---

## 设计要点

### 系统提示词 vs 用户提示词

| 层次 | 作用 | 内容特点 |
|------|------|----------|
| **系统提示词** | 定义 AI 助手的人设和行为规范 | 相对稳定，描述角色定位、回答风格 |
| **用户提示词** | 描述具体任务和输入内容 | 动态变化，包含选中文本、上下文等 |

### 为什么要分离？

1. **系统提示词**设定 AI 的"人格"和回答风格
2. **用户提示词**提供具体任务的指令和输入
3. 分离后更清晰，不同 Provider 可能有不同的处理方式（如 Anthropic 将 system 独立）

---

## 扩展其他 AI 功能

如需添加新的 AI 功能（如总结、改写等），需要：

1. **在 `llm-service.ts` 的 `buildMessages()` 中添加**:
   - system prompt 的 case 分支
   - user prompt 的 case 分支
   - 在 action 类型中添加新值

2. **在 `content-llm.ts` 中添加**:
   - `streamXxx()` 导出函数
   - 在 `streamViaBackground()` 的 action 类型中添加新值

---

## 调试技巧

1. **查看 Background 日志**: Chrome DevTools → Service Workers → background.js
2. **查看完整的消息内容**: 搜索日志 `[Background] Messages to send`
3. **查看 Port 消息调试**: 在 `port.onMessage.addListener()` 中打断点

---

## 相关文件索引

| 文件 | 说明 |
|------|------|
| `src/background/llm-service.ts` | **系统提示词 + 用户提示词**组装 |
| `src/services/prompts.ts` | 用户提示词模板定义 |
| `src/services/content-llm.ts` | Content Script LLM 调用 |
| `src/services/llm/base.ts` | LLM Provider 基类 |
| `src/services/llm/providers/anthropic.ts` | Anthropic Provider（分离 system 消息） |
| `src/types/messages.ts` | 消息类型定义 |
| `src/types/llm.ts` | LLM 相关类型 |
| `src/utils/config-manager.ts` | 模型配置管理 |

---

**文档最后更新**: 2026-04-06
