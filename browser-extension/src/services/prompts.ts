import type { ContextData } from '../types';

/**
 * 解释Prompt（带上下文）
 */
export function createExplainPrompt(selectedText: string, context?: ContextData): string {
  if (!context || !context.beforeText && !context.afterText) {
    // 无上下文时的简单解释
    return `"${selectedText}"是什么？

请从以下几个方面进行解释（如果相关）：
1. 内容概述
2. 关键概念说明
3. 背景或上下文
4. 相关信息补充`;
  }

  // 带上下文的解释
  return `"${selectedText}"是什么？

上下文：
...${context.beforeText}【${selectedText}】${context.afterText}...

请结合上下文从以下几个方面进行解释（如果相关）：
1. 在当前语境中的具体含义
2. 与上下文的关联关系
3. 背景或补充信息
4. 相关概念说明`;
}

/**
 * 翻译Prompt
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
 * 提问Prompt（带上下文）
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

/**
 * 常见问题生成Prompt（带上下文）
 */
export function createQuestionsPrompt(selectedText: string, context?: ContextData): string {
  if (!context || !context.beforeText && !context.afterText) {
    // 无上下文时
    return `请分析以下文本，提炼出用户最可能提出的5个问题。

文本内容：
${selectedText}

要求：
1. 问题针对选中文本
2. 简洁、具体、有针对性
3. 直接返回5个问题，每行一个问题，不要序号`;
  }

  // 带上下文时
  return `请分析以下文本和上下文，提炼出用户最可能提出的5个关于选中文本的问题。

选中文本：${selectedText}

上下文：
...${context.beforeText}【${selectedText}】${context.afterText}...

要求：
1. 问题针对选中文本
2. 结合上下文背景
3. 简洁、具体、有针对性
4. 直接返回5个问题，每行一个问题，不要序号`;
}