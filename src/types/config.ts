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
  selectedTranslationModelId: string | null; // 翻译模型（仅一个，null 表示使用问答模型）
  models: ModelConfig[];
  displayMode: DisplayMode;                  // 显示模式：悬浮或侧边栏
  showFloatingIcon: boolean;                 // 是否显示悬浮图标
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
  {
    id: 'ollama-local',
    name: 'Ollama 本地',
    provider: 'local-ollama',
    baseUrl: 'http://localhost:11434/v1',
    modelId: 'llama3',
  },
  {
    id: 'lm-studio-local',
    name: 'LM Studio',
    provider: 'local-lm-studio',
    baseUrl: 'http://localhost:1234/v1',
    modelId: '',
  },
  // 国内供应商
  {
    id: 'moonshot',
    name: 'Moonshot Kimi',
    provider: 'openai-compat',
    baseUrl: 'https://api.moonshot.cn/v1',
    modelId: 'moonshot-v1-8k',
  },
  {
    id: 'doubao',
    name: '字节豆包',
    provider: 'openai-compat',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    modelId: '',
  },
  {
    id: 'ernie',
    name: '百度文心',
    provider: 'openai-compat',
    baseUrl: 'https://qianfan.baidubce.com/v2',
    modelId: '',
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    provider: 'openai-compat',
    baseUrl: 'https://api.minimax.chat/v1',
    modelId: '',
  },
  {
    id: 'siliconflow',
    name: '硅基流动',
    provider: 'openai-compat',
    baseUrl: 'https://api.siliconflow.cn/v1',
    modelId: '',
  },
  {
    id: 'stepfun',
    name: '阶跃星辰',
    provider: 'openai-compat',
    baseUrl: 'https://api.stepfun.com/v1',
    modelId: '',
  },
  // 国际供应商
  {
    id: 'cohere',
    name: 'Cohere',
    provider: 'openai-compat',
    baseUrl: 'https://api.cohere.ai/compatibility/v1',
    modelId: 'command-r-plus',
  },
  {
    id: 'groq',
    name: 'Groq',
    provider: 'openai-compat',
    baseUrl: 'https://api.groq.com/openai/v1',
    modelId: 'llama-3.1-70b-versatile',
  },
  {
    id: 'together',
    name: 'Together AI',
    provider: 'openai-compat',
    baseUrl: 'https://api.together.xyz/v1',
    modelId: '',
  },
  {
    id: 'mistral',
    name: 'Mistral AI',
    provider: 'openai-compat',
    baseUrl: 'https://api.mistral.ai/v1',
    modelId: 'mistral-large-latest',
  },
  {
    id: 'xai',
    name: 'xAI Grok',
    provider: 'openai-compat',
    baseUrl: 'https://api.x.ai/v1',
    modelId: 'grok-2-latest',
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    provider: 'openai-compat',
    baseUrl: 'https://api.perplexity.ai',
    modelId: 'sonar-pro',
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    provider: 'openai-compat',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    modelId: 'gemini-2.0-flash',
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
  'local-ollama': 'Ollama 本地',
  'local-lm-studio': 'LM Studio',
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
  'local-ollama': {
    baseUrl: 'http://localhost:11434/v1',
    modelId: '',
  },
  'local-lm-studio': {
    baseUrl: 'http://localhost:1234/v1',
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
 * 目标语言
 */
export interface TargetLanguage {
  code: string;       // 'en', 'ja', 'zh-CN' 等
  label: string;      // 'English', '日本語', '中文' 等
}

/**
 * 可用目标语言列表
 */
export const TARGET_LANGUAGES: TargetLanguage[] = [
  { code: 'zh-CN', label: '中文' },
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'es', label: 'Español' },
  { code: 'ru', label: 'Русский' },
];

/**
 * 全文翻译配置
 */
export interface FullPageTranslationConfig {
  targetLanguage: string;    // 目标语言代码，默认跟随浏览器语言
  showBilingual: boolean;    // 双语模式：原文+译文同时显示
}

/**
 * 翻译配置默认值
 */
export const DEFAULT_TRANSLATION_CONFIG: TranslationConfig = {
  mode: 'floating',
  overlapMode: 'replace',
  showCloseButton: true,
  doubleClickToClose: true,
  autoScroll: true,
  hideOnScrollAway: false,
};

/**
 * 全文翻译配置默认值
 */
export const DEFAULT_FULLPAGE_TRANSLATION_CONFIG: FullPageTranslationConfig = {
  targetLanguage: 'auto',    // auto = 跟随浏览器语言
  showBilingual: true,
};
