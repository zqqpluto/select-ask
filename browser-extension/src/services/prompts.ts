/**
 * Prompt 配置文件
 * 包含所有 LLM 功能的系统提示词和用户提示词模板
 */

import type { ContextData } from '../types';

// ============================================================================
// 系统提示词（System Prompts）
// 定义 AI 助手的角色定位和行为规范，不依赖具体输入内容
// ============================================================================

/**
 * AI 解释 - 系统提示词
 * 定位：专业的知识解释助手，侧重解读、简化、说明
 */
export const SYSTEM_PROMPT_EXPLAIN = `你是一个专业的知识解释助手，擅长用通俗易懂的方式解释复杂概念。
你的回答应该：
- 使用简单易懂的语言，避免过度专业化
- 多用类比和例子帮助理解
- 逻辑清晰，分步骤讲解
- 提供相关背景知识但不要偏离主题`;

/**
 * AI 搜索 - 系统提示词
 * 定位：专业的信息检索助手，侧重检索、匹配、整理信息
 */
export const SYSTEM_PROMPT_SEARCH = `你是一个专业的信息检索助手，擅长搜索、整理和提供准确的事实信息。
你的回答应该：
- 优先提供可验证的事实信息
- 清晰标注信息来源或依据
- 综合多个来源的信息进行整理
- 对于专业术语提供准确的定义
- 区分事实和推测`;

/**
 * 翻译 - 系统提示词
 * 定位：专业的翻译助手，侧重准确传达原文含义
 */
export const SYSTEM_PROMPT_TRANSLATE = `你是一个专业的翻译助手，擅长准确传达原文含义。
你的翻译应该：
- 保持原文的语调和风格
- 准确传达原文含义，不随意增减内容
- 专业术语使用对应的标准翻译
- 输出仅包含翻译结果，不要添加额外解释`;

// 系统提示词映射表
export const SYSTEM_PROMPTS: Record<string, string> = {
  explain: SYSTEM_PROMPT_EXPLAIN,
  search: SYSTEM_PROMPT_SEARCH,
  translate: SYSTEM_PROMPT_TRANSLATE,
};

// ============================================================================
// 用户提示词模板（User Prompt Templates）
// 根据具体输入内容动态生成
// ============================================================================

/**
 * 解释 Prompt（带上下文）- 侧重解读、翻译、简化、说明
 * 定位：帮助用户看懂复杂内容
 */
export function createExplainPrompt(selectedText: string, context?: ContextData): string {
  if (!context || !context.beforeText && !context.afterText) {
    // 无上下文时的简单解释
    return `请用通俗易懂的方式解释以下内容：

${selectedText}

请从以下几个方面进行说明（如果相关）：
1. 用大白话讲清楚是什么
2. 如有抽象概念，用简单类比说明
3. 如有逻辑关系，分步骤拆解
4. 补充相关背景或概念说明`;
  }

  // 带上下文的解释
  return `请用通俗易懂的方式解释以下内容：

${selectedText}

上下文：
...${context.beforeText}【${selectedText}】${context.afterText}...

请结合上下文从以下几个方面进行说明（如果相关）：
1. 在当前语境中的具体含义（用大白话）
2. 与上下文的关联关系
3. 如有抽象概念，用简单类比说明
4. 如有逻辑关系，分步骤拆解
5. 相关背景或补充信息`;
}

/**
 * 搜索 Prompt（AI 搜索）- 侧重检索、匹配、整理信息
 * 定位：帮助用户查事实、找资料、获取最新信息
 */
export function createSearchPrompt(selectedText: string, context?: ContextData): string {
  if (!context || !context.beforeText && !context.afterText) {
    // 无上下文时的搜索
    return `请搜索并提供关于以下内容的相关信息：

${selectedText}

请从以下几个方面进行整理（如果相关）：
1. 核心定义/概述
2. 关键要点或特征
3. 相关背景或来源
4. 扩展信息或关联概念`;
  }

  // 带上下文的搜索
  return `请搜索并提供关于以下内容的相关信息：

${selectedText}

上下文：
...${context.beforeText}【${selectedText}】${context.afterText}...

请结合上下文从以下几个方面进行整理（如果相关）：
1. 在当前语境中的具体含义
2. 关键要点或特征
3. 与上下文的关联关系
4. 相关背景或扩展信息`;
}

/**
 * 翻译 Prompt
 */
export function createTranslatePrompt(selectedText: string, targetLanguage: string = '中文'): string {
  return `请将以下内容翻译成${targetLanguage}：

${selectedText}`;
}

/**
 * 提问 Prompt（带上下文）
 */
export function createQuestionPrompt(userQuestion: string, selectedText: string, context?: ContextData): string {
  if (!context || !context.beforeText && !context.afterText) {
    // 无上下文时
    return `${userQuestion}

选中文本：${selectedText}`;
  }

  // 带上下文时
  return `${userQuestion}

选中文本：${selectedText}

上下文：
...${context.beforeText}【${selectedText}】${context.afterText}...`;
}

/**
 * 生成问题 Prompt（用于追问气泡功能）
 */
export function createGenerateQuestionsPrompt(selectedText: string, context?: ContextData, answer?: string): string {
  if (!context || !context.beforeText && !context.afterText) {
    // 无上下文时
    return `请分析以下文本，提炼出用户最可能提出的 5 个问题。

文本内容：
${selectedText}

要求：
1. 问题针对选中文本
2. 简洁、具体、有针对性
3. 直接返回 5 个问题，每行一个问题，不要序号或其他格式`;
  }

  // 带上下文时
  return `请分析以下文本和上下文，提炼出用户最可能提出的 5 个关于选中文本的问题。

选中文本：${selectedText}

上下文：
...${context.beforeText}【${selectedText}】${context.afterText}...

要求：
1. 问题针对选中文本
2. 结合上下文背景
3. 简洁、具体、有针对性
4. 直接返回 5 个问题，每行一个问题，不要序号或其他格式`;
}

// ============================================================================
// 统一导出：按 action 类型组织的用户提示词生成器
// ============================================================================

export type Action = 'explain' | 'translate' | 'question' | 'generateQuestions' | 'search';

interface UserPromptMap {
  explain: (text: string, context?: ContextData) => string;
  translate: (text: string, targetLang?: string) => string;
  question: (question: string, text: string, context?: ContextData) => string;
  generateQuestions: (text: string, context?: ContextData) => string;
  search: (text: string, context?: ContextData) => string;
}

export const USER_PROMPTS: UserPromptMap = {
  explain: createExplainPrompt,
  translate: createTranslatePrompt,
  question: createQuestionPrompt,
  generateQuestions: createGenerateQuestionsPrompt,
  search: createSearchPrompt,
};
