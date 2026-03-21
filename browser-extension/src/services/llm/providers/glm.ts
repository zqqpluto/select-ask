/**
 * 智谱 GLM Provider
 * 使用 OpenAI 兼容 API
 */

import { OpenAICompatProvider } from './openai-compat';
import type { ProviderConfig } from '../../../types/llm';

export class GLMProvider extends OpenAICompatProvider {
  constructor(config: ProviderConfig) {
    super(config);
  }

  // GLM 的 SSE 格式可能略有不同，需要特殊处理
  protected parseStreamLine(line: string): { content?: string; reasoning?: string; done: boolean; error?: string } {
    // GLM 的 SSE 格式可能没有空格
    let data = line;
    if (line.startsWith('data:')) {
      data = line.slice(5).trim();
    }

    if (data === '[DONE]' || !data) {
      return { done: true };
    }

    // 检查 JSON 是否完整（以 { 开头且以 } 结尾）
    if (!data.startsWith('{') || !data.endsWith('}')) {
      console.warn('Incomplete JSON in GLM SSE line, skipping:', data.substring(0, 100));
      return { done: false };
    }

    try {
      const parsed = JSON.parse(data);
      const delta = parsed.choices?.[0]?.delta;
      const content = delta?.content || '';
      return { content, done: false };
    } catch (e) {
      console.error('Failed to parse GLM SSE line:', line.substring(0, 200), e);
      return { done: false };
    }
  }
}