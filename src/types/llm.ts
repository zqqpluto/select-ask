/**
 * LLM Provider 类型定义
 */

export type ProviderType = 'openai' | 'anthropic' | 'qwen' | 'deepseek' | 'glm' | 'openai-compat' | 'local-ollama' | 'local-lm-studio';

/**
 * LLM 消息
 */
export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * 上下文数据
 */
export interface LLMContext {
  selected: string;
  before: string;
  after: string;
}

/**
 * 流式回调
 */
export interface StreamCallbacks {
  onReasoning: (text: string) => void;
  onReasoningDone: () => void;
  onContent: (text: string) => void;
  onError: (error: Error) => void;
  onComplete: () => void;
}

/**
 * LLM 聊天请求参数
 */
export interface LLMChatParams {
  messages: LLMMessage[];
  context?: LLMContext;
}

/**
 * LLM 问题生成请求参数
 */
export interface LLMQuestionsParams {
  text: string;
  context?: LLMContext;
}

/**
 * Provider 配置（运行时，解密后）
 */
export interface ProviderConfig {
  apiKey: string;
  baseUrl: string;
  modelId: string;
}

/**
 * 聊天选项
 */
export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}