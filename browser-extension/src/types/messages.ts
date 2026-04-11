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
 * Content Script 与 Background 通信的消息类型
 */
export type ContentMessage =
  | 'OPEN_SIDEBAR'
  | 'CONTINUE_SESSION'
  | 'OPEN_HISTORY_SIDEBAR'
  | 'OPEN_OPTIONS_PAGE'
  | 'SHOW_FLOATING_BOX';

/**
 * LLM 流式请求参数
 */
export interface LLMStreamRequest {
  action: 'explain' | 'translate' | 'question' | 'generateQuestions' | 'search';
  text: string;
  question?: string; // 仅用于 question action
  context?: LLMContext;
  modelId: string; // 使用哪个模型
  targetLanguage?: string; // 仅用于 translate action，指定目标语言
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