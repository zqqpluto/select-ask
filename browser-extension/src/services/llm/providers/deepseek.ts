/**
 * DeepSeek Provider
 * 支持 Chat 和 Reasoner 模型
 */

import { OpenAICompatProvider, type OpenAICompatOptions } from './openai-compat';
import type { ProviderConfig } from '../../../types/llm';

export class DeepSeekProvider extends OpenAICompatProvider {
  constructor(config: ProviderConfig) {
    // 检查是否是 reasoner 模型
    const isReasoner = config.modelId.includes('reasoner');
    const options: OpenAICompatOptions = {
      supportsReasoning: isReasoner,
    };

    super(config, options);
  }
}