/**
 * 通义千问 Provider (Qwen)
 * 使用 OpenAI 兼容 API
 */

import { OpenAICompatProvider } from './openai-compat';
import type { ProviderConfig } from '../../../types/llm';

export class QwenProvider extends OpenAICompatProvider {
  constructor(config: ProviderConfig) {
    super(config);
  }
}