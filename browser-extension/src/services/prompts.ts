import type { ContextData } from '../types';

/**
 * 解释 Prompt（带上下文）- 侧重解读、翻译、简化、说明
 */
export function createExplainPrompt(selectedText: string, context?: ContextData): string {
  if (!context || !context.beforeText && !context.afterText) {
    // 无上下文时的简单解释
    return `请用通俗易懂的方式解释"${selectedText}"。

请从以下几个方面进行说明（如果相关）：
1. 用大白话讲清楚是什么
2. 如有抽象概念，用简单类比说明
3. 如有逻辑关系，分步骤拆解
4. 补充相关背景或概念说明`;
  }

  // 带上下文的解释
  return `请用通俗易懂的方式解释"${selectedText}"。

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
 * 搜索 Prompt（AI 搜索 - 侧重检索、匹配、整理信息）
 */
export function createSearchPrompt(selectedText: string, context?: ContextData): string {
  if (!context || !context.beforeText && !context.afterText) {
    // 无上下文时的搜索
    return `请搜索并提供关于"${selectedText}"的信息。

请从以下几个方面进行整理（如果相关）：
1. 核心定义/概述
2. 关键要点或特征
3. 相关背景或来源
4. 扩展信息或关联概念`;
  }

  // 带上下文的搜索
  return `请搜索并提供关于"${selectedText}"的信息。

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
  return `将"${selectedText}"翻译成${targetLanguage}

要求：
1. 保持原文的语调和风格
2. 准确传达原文含义
3. 专业术语使用对应的标准翻译
4. 输出仅包含翻译结果，不要添加额外解释`;
}

/**
 * 提问 Prompt（带上下文）
 */
export function createQuestionPrompt(userQuestion: string, selectedText: string, context?: ContextData): string {
  if (!context || !context.beforeText && !context.afterText) {
    // 无上下文时
    return `${userQuestion}

文本内容：
${selectedText}`;
  }

  // 带上下文时
  return `${userQuestion}

选中文本：${selectedText}

上下文：
...${context.beforeText}【${selectedText}】${context.afterText}...`;
}
