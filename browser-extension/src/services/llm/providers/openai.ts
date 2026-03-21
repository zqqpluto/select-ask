/**
 * OpenAI Provider
 */

import { LLMProvider } from '../base';
import type { LLMMessage, LLMContext } from '../../../types/llm';

export class OpenAIProvider extends LLMProvider {
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

  protected parseStreamLine(line: string): { content?: string; done: boolean; error?: string } {
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
      const content = parsed.choices?.[0]?.delta?.content;
      return { content: content || '', done: false };
    } catch (e) {
      console.error('Failed to parse SSE line:', line.substring(0, 200), e);
      return { done: false };
    }
  }

  async *streamChat(
    messages: LLMMessage[],
    context?: LLMContext,
    addReasoning: boolean = false
  ): AsyncGenerator<string, void, unknown> {
    const response = await this.fetchStream(messages, addReasoning);

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Response body is not readable');
    }

    const decoder = new TextDecoder('utf-8', { fatal: false });
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // 解码当前 chunk，保留不完整的多字节字符
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine) continue;

          const parsed = this.parseStreamLine(trimmedLine);
          if (parsed.done) {
            return;
          }
          if (parsed.error) {
            throw new Error(parsed.error);
          }
          if (parsed.content) {
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