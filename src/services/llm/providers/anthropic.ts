/**
 * Anthropic Claude Provider
 */

import { LLMProvider } from '../base';
import type { LLMMessage, LLMContext } from '../../../types/llm';

export class AnthropicProvider extends LLMProvider {
  protected getChatUrl(): string {
    return `${this.config.baseUrl}/v1/messages`;
  }

  protected getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-api-key': this.config.apiKey,
      'anthropic-version': '2023-06-01',
    };
  }

  protected buildRequestBody(messages: LLMMessage[]): object {
    // 分离 system 消息
    const systemMessage = messages.find(m => m.role === 'system');
    const chatMessages = messages.filter(m => m.role !== 'system');

    return {
      model: this.config.modelId,
      max_tokens: 4096,
      system: systemMessage?.content,
      messages: chatMessages.map(m => ({
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
    if (!data) {
      return { done: false };
    }

    try {
      const parsed = JSON.parse(data);

      // Anthropic 的 SSE 格式
      if (parsed.type === 'content_block_delta') {
        const content = parsed.delta?.text || '';
        return { content, done: false };
      }

      if (parsed.type === 'message_stop') {
        return { done: true };
      }

      if (parsed.type === 'error') {
        return { done: false, error: parsed.error?.message || 'Unknown error' };
      }

      return { done: false };
    } catch (e) {
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

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;

          const parsed = this.parseStreamLine(line);
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
        const parsed = this.parseStreamLine(buffer);
        if (parsed.content) {
          yield parsed.content;
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}