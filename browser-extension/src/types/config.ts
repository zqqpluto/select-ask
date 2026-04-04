/**
 * 模型配置类型定义
 */

import type { ProviderType } from './llm';

/**
 * 模型配置（存储）
 */
export interface ModelConfig {
  id: string;
  name: string;
  provider: ProviderType;
  apiKey: string;           // 加密存储
  baseUrl: string;
  modelId: string;
  enabled: boolean;
  enableChat: boolean;      // 是否参与问答，默认 true
  createdAt: number;
  updatedAt: number;
}

/**
 * 显示模式
 */
export type DisplayMode = 'floating' | 'sidebar';

/**
 * 翻译显示模式
 */
export type TranslationMode = 'inline' | 'floating' | 'sidebar';

/**
 * 翻译重叠模式
 */
export type TranslationOverlapMode = 'replace' | 'stack';

/**
 * 翻译配置
 */
export interface TranslationConfig {
  mode: TranslationMode;               // 翻译显示模式
  overlapMode: TranslationOverlapMode; // 同一段落多次翻译的处理方式
  showCloseButton: boolean;            // 显示关闭按钮
  doubleClickToClose: boolean;         // 双击原文关闭
  autoScroll: boolean;                 // 自动滚动到译文
  hideOnScrollAway: boolean;           // 滚动离开时淡出
}

/**
 * 用户偏好设置
 */
export interface UserPreferences {
  sendWithEnter: boolean;
  sidebarWidth: number;
  autoGenerateQuestions: boolean;
  translation: TranslationConfig;
}

/**
 * 应用配置
 */
export interface AppConfig {
  selectedChatModelIds: string[];            // 问答模型（支持多个）
  selectedQuestionModelId: string | null;    // 问题生成模型（仅一个）
  models: ModelConfig[];
  displayMode: DisplayMode;                  // 显示模式：悬浮或侧边栏
  preferences: UserPreferences;              // 用户偏好设置
}

/**
 * 预设模型
 */
export const MODEL_PRESETS: Array<{
  id: string;
  name: string;
  provider: ProviderType;
  baseUrl: string;
  modelId: string;
  supportsReasoning?: boolean;
}> = [
  {
    id: 'openai-gpt4o',
    name: 'OpenAI GPT-4o',
    provider: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    modelId: 'gpt-4o',
  },
  {
    id: 'openai-gpt4',
    name: 'OpenAI GPT-4',
    provider: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    modelId: 'gpt-4-turbo',
  },
  {
    id: 'anthropic-claude',
    name: 'Claude Sonnet',
    provider: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    modelId: 'claude-sonnet-4-20250514',
    supportsReasoning: true,
  },
  {
    id: 'deepseek-chat',
    name: 'DeepSeek Chat',
    provider: 'deepseek',
    baseUrl: 'https://api.deepseek.com/v1',
    modelId: 'deepseek-chat',
  },
  {
    id: 'deepseek-reasoner',
    name: 'DeepSeek Reasoner',
    provider: 'deepseek',
    baseUrl: 'https://api.deepseek.com/v1',
    modelId: 'deepseek-reasoner',
    supportsReasoning: true,
  },
  {
    id: 'qwen-turbo',
    name: '通义千问 Turbo',
    provider: 'qwen',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    modelId: 'qwen-turbo',
  },
  {
    id: 'qwen-plus',
    name: '通义千问 Plus',
    provider: 'qwen',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    modelId: 'qwen-plus',
  },
  {
    id: 'glm-4',
    name: '智谱 GLM-4',
    provider: 'glm',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    modelId: 'glm-4',
  },
];

/**
 * Provider 显示名称
 */
export const PROVIDER_NAMES: Record<ProviderType, string> = {
  'openai': 'OpenAI',
  'anthropic': 'Anthropic',
  'qwen': '通义千问',
  'deepseek': 'DeepSeek',
  'glm': '智谱 AI',
  'openai-compat': 'OpenAI 兼容',
};

/**
 * Provider 默认配置
 */
export const PROVIDER_DEFAULTS: Record<ProviderType, { baseUrl: string; modelId: string }> = {
  'openai': {
    baseUrl: 'https://api.openai.com/v1',
    modelId: 'gpt-4o',
  },
  'anthropic': {
    baseUrl: 'https://api.anthropic.com',
    modelId: 'claude-sonnet-4-20250514',
  },
  'qwen': {
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    modelId: 'qwen-turbo',
  },
  'deepseek': {
    baseUrl: 'https://api.deepseek.com/v1',
    modelId: 'deepseek-chat',
  },
  'glm': {
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    modelId: 'glm-4',
  },
  'openai-compat': {
    baseUrl: '',
    modelId: '',
  },
};

/**
 * 获取预设模型
 */
export function getPresetById(id: string) {
  return MODEL_PRESETS.find(p => p.id === id);
}

/**
 * 创建新的模型配置
 */
export function createModelConfig(
  id: string,
  name: string,
  provider: ProviderType,
  apiKey: string,
  baseUrl: string,
  modelId: string
): ModelConfig {
  const now = Date.now();
  return {
    id,
    name,
    provider,
    apiKey,
    baseUrl,
    modelId,
    enabled: true,
    enableChat: true,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * 翻译配置默认值
 */
export const DEFAULT_TRANSLATION_CONFIG: TranslationConfig = {
  mode: 'inline',
  overlapMode: 'replace',
  showCloseButton: true,
  doubleClickToClose: true,
  autoScroll: true,
  hideOnScrollAway: false,
};
