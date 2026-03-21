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
  return new ProviderClass(config);
}

/**
 * 检查 Provider 类型是否有效
 */
export function isValidProviderType(type: string): type is ProviderType {
  return type in providerClasses;
}