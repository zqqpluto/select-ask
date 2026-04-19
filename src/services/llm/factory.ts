/**
 * LLM Provider 工厂
 */

import type { ProviderType, ProviderConfig } from '../../types/llm';
import { LLMProvider } from './base';
import { OpenAIProvider } from './providers/openai';
import { AnthropicProvider } from './providers/anthropic';
import { OpenAICompatProvider } from './providers/openai-compat';
import { QwenProvider } from './providers/qwen';
import { DeepSeekProvider } from './providers/deepseek';
import { GLMProvider } from './providers/glm';

/**
 * Provider 类映射
 */
const providerClasses: Record<ProviderType, new (config: ProviderConfig) => LLMProvider> = {
  'openai': OpenAIProvider,
  'anthropic': AnthropicProvider,
  'qwen': QwenProvider,
  'deepseek': DeepSeekProvider,
  'glm': GLMProvider,
  'openai-compat': OpenAICompatProvider,
  'local-ollama': OpenAICompatProvider,
  'local-lm-studio': OpenAICompatProvider,
};

/** 本地模型默认地址 */
const localBaseUrls: Record<string, string> = {
  'local-ollama': 'http://localhost:11434/v1',
  'local-lm-studio': 'http://localhost:1234/v1',
};

/**
 * 创建 LLM Provider 实例
 */
export function getLLMProvider(
  providerType: ProviderType,
  config: ProviderConfig
): LLMProvider {
  const ProviderClass = providerClasses[providerType];
  if (!ProviderClass) {
    throw new Error(`Unknown provider type: ${providerType}`);
  }
  // 本地模型：如果未配置 baseUrl，使用默认地址
  const finalConfig: ProviderConfig = { ...config };
  if ((providerType === 'local-ollama' || providerType === 'local-lm-studio') && !finalConfig.baseUrl) {
    finalConfig.baseUrl = localBaseUrls[providerType];
  }
  return new ProviderClass(finalConfig);
}

/**
 * 检查 Provider 类型是否有效
 */
export function isValidProviderType(type: string): type is ProviderType {
  return type in providerClasses;
}
