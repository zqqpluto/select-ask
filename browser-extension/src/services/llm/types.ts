/**
 * LLM 服务内部类型定义
 */

import type { LLMMessage, LLMContext, StreamCallbacks } from '../../types/llm';

// Re-export StreamCallbacks for use in other modules
export type { StreamCallbacks } from '../../types/llm';

/**
 * Provider 请求参数
 */
export interface ProviderRequest {
  messages: LLMMessage[];
  context?: LLMContext;
  callbacks: StreamCallbacks;
}

/**
 * 流式响应解析器
 */
export type StreamParser = (line: string) => { type: 'content' | 'reasoning' | 'done' | 'error'; content?: string };

/**
 * SSE 行解析器
 */
export function parseSSELine(line: string): { data: string } | null {
  if (!line.startsWith('data: ')) return null;
  return { data: line.slice(6) };
}

/**
 * 构建带上下文的提示
 */
export function buildPromptWithContext(
  basePrompt: string,
  text: string,
  context?: LLMContext
): string {
  if (!context || (!context.before && !context.after)) {
    return `${basePrompt}\n\n${text}`;
  }
  return `${basePrompt}\n\n选中文本：${text}\n\n上下文：\n...${context.before}【${text}】${context.after}...`;
}

/**
 * 添加思考过程格式要求
 */
export function addReasoningFormat(message: LLMMessage): LLMMessage {
  if (message.role !== 'user') return message;

  return {
    ...message,
    content: message.content + `

【重要】请按以下格式回答：
<REASONING>
简要说明你的思考过程
</REASONING>
<ANSWER>
然后给出最终答案
</ANSWER>`,
  };
}

/**
 * 默认请求头
 */
export function getDefaultHeaders(apiKey: string, provider: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (provider === 'anthropic') {
    headers['x-api-key'] = apiKey;
    headers['anthropic-version'] = '2023-06-01';
  } else {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  return headers;
}