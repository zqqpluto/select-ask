/**
 * OpenAI 兼容 Provider
 * 支持 DeepSeek、通义千问、智谱 GLM 等
 */

import { LLMProvider } from '../base';
import type { LLMMessage, LLMContext } from '../../../types/llm';

export interface OpenAICompatOptions {
  /** 是否支持 reasoning（如 DeepSeek Reasoner） */
  supportsReasoning?: boolean;
}

export class OpenAICompatProvider extends LLMProvider {
  constructor(config: { apiKey: string; baseUrl: string; modelId: string }, _options?: OpenAICompatOptions) {
    super(config);
  }

  protected getChatUrl(): string {
    return `${this.config.baseUrl}/chat/completions`;
  }

  protected getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.apiKey}`,
    };
  }

  protected buildRequestBody(messages: LLMMessage[]): object {
    return {
      model: this.config.modelId,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      stream: true,
    };
  }

  protected parseStreamLine(line: string): { content?: string; reasoning?: string; done: boolean; error?: string } {
    if (!line.startsWith('data: ')) {
      return { done: false };
    }

    const data = line.slice(6).trim();
    if (data === '[DONE]') {
      return { done: true };
    }

    // 检查 JSON 是否完整（以 { 开头且以 } 结尾）
    if (!data.startsWith('{') || !data.endsWith('}')) {
      console.warn('Incomplete JSON in SSE line, skipping:', data.substring(0, 100));
      return { done: false };
    }

    try {
      const parsed = JSON.parse(data);
      const delta = parsed.choices?.[0]?.delta;

      // 支持 DeepSeek 的 reasoning_content
      if (delta?.reasoning_content) {
        return { reasoning: delta.reasoning_content, done: false };
      }

      const content = delta?.content || '';
      return { content, done: false };
    } catch (e) {
      console.error('Failed to parse SSE line:', line.substring(0, 200), e);
      return { done: false };
    }
  }

  async *streamChat(
    messages: LLMMessage[],
    _context?: LLMContext,
    addReasoning: boolean = false
  ): AsyncGenerator<string, void, unknown> {
    const response = await this.fetchStream(messages, addReasoning);

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Response body is not readable');
    }

    const decoder = new TextDecoder('utf-8', { fatal: false });
    let buffer = '';
    let inReasoning = false;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // 解码当前 chunk，保留不完整的多字节字符
        buffer += decoder.decode(value, { stream: true });

        // 按行分割，保留最后一行（可能不完整）
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine) continue;

          const parsed = this.parseStreamLine(trimmedLine);
          if (parsed.done) {
            // 如果在 reasoning 中，发送结束标记
            if (inReasoning) {
              yield '[REASONING_DONE]';
            }
            return;
          }
          if (parsed.error) {
            throw new Error(parsed.error);
          }

          // 处理原生 reasoning（如 DeepSeek Reasoner）
          if (parsed.reasoning) {
            if (!inReasoning) {
              yield '[REASONING]';
              inReasoning = true;
            }
            yield `[REASONING]${parsed.reasoning}`;
          }

          if (parsed.content) {
            // 如果之前在 reasoning，现在有内容了，结束 reasoning
            if (inReasoning && !parsed.reasoning) {
              yield '[REASONING_DONE]';
              inReasoning = false;
            }
            yield parsed.content;
          }
        }
      }

      // 处理剩余缓冲区
      if (buffer.trim()) {
        const parsed = this.parseStreamLine(buffer.trim());
        if (parsed.content) {
          yield parsed.content;
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}