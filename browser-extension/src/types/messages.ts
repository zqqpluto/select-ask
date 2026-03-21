/**
 * Background Script 消息类型定义
 */

import type { LLMMessage, LLMContext } from './llm';

/**
 * 消息类型
 */
export type MessageType =
  | 'LLM_STREAM_START'
  | 'LLM_STREAM_CHUNK'
  | 'LLM_STREAM_ERROR'
  | 'LLM_STREAM_END';

/**
 * LLM 流式请求参数
 */
export interface LLMStreamRequest {
  action: 'explain' | 'translate' | 'question' | 'generateQuestions';
  text: string;
  question?: string; // 仅用于 question action
  context?: LLMContext;
  modelId: string; // 使用哪个模型
}

/**
 * LLM 流式响应消息
 */
export interface LLMStreamMessage {
  type: MessageType;
  chunk?: string;
  error?: string;
}

/**
 * Port 名称
 */
export const LLM_STREAM_PORT_NAME = 'llm-stream';