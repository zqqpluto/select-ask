/**
 * LLM Provider 抽象基类
 */

import type { LLMMessage, LLMContext, ProviderConfig } from '../../types/llm';
import { addReasoningFormat } from './types';

/**
 * 流式响应状态
 */
interface StreamState {
  currentSection: 'answer' | 'reasoning';
  buffer: string;
}

/**
 * LLM Provider 抽象基类
 */
export abstract class LLMProvider {
  protected config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  /**
   * 流式聊天
   */
  abstract streamChat(
    messages: LLMMessage[],
    context?: LLMContext,
    addReasoning?: boolean
  ): AsyncGenerator<string, void, unknown>;

  /**
   * 生成问题列表
   */
  async generateQuestions(
    text: string,
    context?: LLMContext
  ): Promise<string[]> {
    const prompt = this.buildQuestionsPrompt(text, context);
    const messages: LLMMessage[] = [
      { role: 'system', content: '你是一个专业的问题生成助手。' },
      { role: 'user', content: prompt },
    ];

    let responseText = '';
    for await (const chunk of this.streamChat(messages)) {
      responseText += chunk;
    }

    return this.parseQuestions(responseText);
  }

  /**
   * 获取 API URL
   */
  protected abstract getChatUrl(): string;

  /**
   * 获取请求头
   */
  protected abstract getHeaders(): Record<string, string>;

  /**
   * 构建请求体
   */
  protected abstract buildRequestBody(messages: LLMMessage[]): object;

  /**
   * 解析流式响应行
   */
  protected abstract parseStreamLine(line: string): { content?: string; done: boolean; error?: string };

  /**
   * 处理带思考过程格式的流式响应
   */
  protected async *processStreamWithReasoning(
    response: Response
  ): AsyncGenerator<string, void, unknown> {
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Response body is not readable');
    }

    const decoder = new TextDecoder();
    const state: StreamState = {
      currentSection: 'answer',
      buffer: '',
    };

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.trim()) continue;

          const parsed = this.parseStreamLine(line);
          if (parsed.done) {
            // 处理剩余缓冲区
            if (state.buffer.trim()) {
              yield this.formatOutput(state.buffer, state.currentSection);
            }
            return;
          }
          if (parsed.error) {
            throw new Error(parsed.error);
          }
          if (parsed.content) {
            state.buffer += parsed.content;
            yield* this.processBuffer(state);
          }
        }
      }

      // 处理剩余缓冲区
      if (state.buffer.trim()) {
        yield this.formatOutput(state.buffer, state.currentSection);
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * 处理缓冲区中的标签
   */
  protected *processBuffer(state: StreamState): Generator<string, void, unknown> {
    const tags = [
      { start: '<REASONING>', end: '</REASONING>', section: 'reasoning' as const },
      { start: '<ANSWER>', end: '</ANSWER>', section: 'answer' as const },
    ];

    while (true) {
      let processed = false;

      for (const tag of tags) {
        const startIdx = state.buffer.indexOf(tag.start);
        if (startIdx !== -1) {
          // 发送标签前的内容
          if (startIdx > 0) {
            yield this.formatOutput(state.buffer.slice(0, startIdx), state.currentSection);
          }
          state.buffer = state.buffer.slice(startIdx + tag.start.length);
          state.currentSection = tag.section;
          processed = true;

          // 如果是 reasoning 开始，发送标记
          if (tag.section === 'reasoning' && tag.start === '<REASONING>') {
            yield '[REASONING]';
          }
          break;
        }

        const endIdx = state.buffer.indexOf(tag.end);
        if (endIdx !== -1) {
          // 发送标签内的内容
          if (endIdx > 0) {
            yield this.formatOutput(state.buffer.slice(0, endIdx), state.currentSection);
          }
          state.buffer = state.buffer.slice(endIdx + tag.end.length);
          state.currentSection = 'answer'; // 标签结束后回到 answer
          processed = true;

          // 如果是 reasoning 结束，发送标记
          if (tag.section === 'reasoning' && tag.end === '</REASONING>') {
            yield '[REASONING_DONE]';
          }
          break;
        }
      }

      if (!processed) {
        // 检查是否有部分标签
        const partialTags = ['<REAS', '<ANSW', '</REAS', '</ANSW'];
        let partialIdx = state.buffer.length;

        for (const partial of partialTags) {
          const idx = state.buffer.indexOf(partial);
          if (idx !== -1 && idx < partialIdx) {
            partialIdx = idx;
          }
        }

        if (partialIdx > 0 && partialIdx < state.buffer.length) {
          // 发送部分标签之前的内容
          yield this.formatOutput(state.buffer.slice(0, partialIdx), state.currentSection);
          state.buffer = state.buffer.slice(partialIdx);
        } else if (partialIdx === state.buffer.length) {
          // 没有部分标签，发送全部
          if (state.buffer.trim()) {
            yield this.formatOutput(state.buffer, state.currentSection);
          }
          state.buffer = '';
        }
        break;
      }
    }
  }

  /**
   * 格式化输出
   */
  protected formatOutput(content: string, section: 'answer' | 'reasoning'): string {
    if (!content.trim()) return '';
    if (section === 'reasoning') {
      return `[REASONING]${content}`;
    }
    return content;
  }

  /**
   * 构建问题生成 prompt
   */
  protected buildQuestionsPrompt(text: string, context?: LLMContext): string {
    if (!context || (!context.before && !context.after)) {
      return `请分析以下文本，提炼出用户最可能提出的5个问题。

文本内容：
${text}

要求：
1. 问题针对选中文本
2. 简洁、具体、有针对性
3. 直接返回5个问题，每行一个问题，不要序号或其他格式`;
    }

    return `请分析以下文本和上下文，提炼出用户最可能提出的5个关于选中文本的问题。

选中文本：${text}

上下文：
...${context.before}【${text}】${context.after}...

要求：
1. 问题针对选中文本
2. 结合上下文背景
3. 简洁、具体、有针对性
4. 直接返回5个问题，每行一个问题，不要序号或其他格式`;
  }

  /**
   * 解析问题列表
   */
  protected parseQuestions(text: string): string[] {
    const lines = text.split('\n').filter(line => line.trim());
    const questions: string[] = [];

    for (const line of lines) {
      let cleaned = line.trim();
      // 移除开头的数字和符号
      while (cleaned && !cleaned[0].match(/[\u4e00-\u9fa5a-zA-Z]/)) {
        cleaned = cleaned.slice(1).trim();
      }
      if (cleaned) {
        questions.push(cleaned);
      }
    }

    return questions.slice(0, 5);
  }

  /**
   * 执行流式请求
   */
  protected async fetchStream(
    messages: LLMMessage[],
    addReasoning: boolean = false
  ): Promise<Response> {
    // 添加思考过程格式要求
    const processedMessages = addReasoning
      ? messages.map((msg, idx) =>
          idx === messages.length - 1 && msg.role === 'user'
            ? addReasoningFormat(msg)
            : msg
        )
      : messages;

    const url = this.getChatUrl();
    const headers = this.getHeaders();
    const body = this.buildRequestBody(processedMessages);

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed: ${response.status} - ${errorText}`);
    }

    return response;
  }
}