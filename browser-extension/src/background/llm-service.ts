/**
 * Background Script LLM 服务
 * 处理来自 content script 的 LLM 请求
 */

import { getLLMProvider } from '../services/llm';
import { getModelConfig } from '../utils/config-manager';
import type { LLMMessage, LLMContext } from '../types/llm';
import { SYSTEM_PROMPTS, USER_PROMPTS, type Action } from '../services/prompts';

/**
 * 构建 LLM 消息
 * 根据 action 类型生成对应的 system prompt 和 user prompt
 */
function buildMessages(
  action: Action,
  text: string,
  question?: string,
  context?: LLMContext
): LLMMessage[] {
  const messages: LLMMessage[] = [];

  // 添加系统提示词
  const systemContent = SYSTEM_PROMPTS[action];
  if (systemContent) {
    messages.push({ role: 'system', content: systemContent });
  }

  // 构建 user 消息
  let userContent: string;

  switch (action) {
    case 'explain':
      userContent = USER_PROMPTS.explain(text, context ? adaptContext(context) : undefined);
      break;

    case 'search':
      userContent = USER_PROMPTS.search(text, context ? adaptContext(context) : undefined);
      break;

    case 'translate': {
      const browserLang = (self as any).navigator?.language || 'zh-CN';
      const langMap: Record<string, string> = {
        'zh': '中文', 'zh-CN': '中文', 'zh-TW': '繁体中文',
        'en': '英文', 'en-US': '英文', 'en-GB': '英文',
        'ja': '日语', 'ko': '韩语',
      };
      const targetLang = langMap[browserLang] || langMap[browserLang.split('-')[0]] || '中文';
      userContent = USER_PROMPTS.translate(text, targetLang);
      break;
    }

    case 'question':
      userContent = USER_PROMPTS.question(question || '', text, context ? adaptContext(context) : undefined);
      break;

    case 'generateQuestions':
      userContent = USER_PROMPTS.generateQuestions(text, context ? adaptContext(context) : undefined);
      break;

    default:
      userContent = text;
  }

  messages.push({ role: 'user', content: userContent });
  return messages;
}

/**
 * 适配上下文类型：LLMContext -> ContextData
 */
function adaptContext(context: LLMContext) {
  return {
    beforeText: context.before || '',
    afterText: context.after || '',
  };
}

/**
 * 处理 LLM 流式请求
 * 支持两种请求格式：
 * 1. content script 格式：action/text/context/modelId
 * 2. Side Panel 格式：messages 数组 + modelId
 */
export async function handleLLMStream(
  port: chrome.runtime.Port,
  request: {
    action?: 'explain' | 'translate' | 'question' | 'generateQuestions' | 'search';
    text?: string;
    question?: string;
    context?: LLMContext;
    modelId: string;
    messages?: { role: string; content: string }[];
  }
): Promise<void> {
  try {
    // 获取模型配置
    const model = await getModelConfig(request.modelId);

    if (!model) {
      port.postMessage({ type: 'LLM_STREAM_ERROR', error: '模型配置不存在' });
      port.postMessage({ type: 'LLM_STREAM_END' });
      return;
    }

    // 创建 provider
    const provider = getLLMProvider(model.provider, {
      apiKey: model.apiKey,
      baseUrl: model.baseUrl,
      modelId: model.modelId,
    });

    // 构建消息 - 支持两种格式
    let messages: LLMMessage[];

    if (request.messages && request.messages.length > 0) {
      // Side Panel 格式：直接使用 messages 数组
      messages = request.messages.map((m) => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content
      }));
    } else if (request.action && request.text) {
      // content script 格式：使用 buildMessages 构建
      messages = buildMessages(request.action, request.text, request.question, request.context, request.answer);
    } else {
      port.postMessage({ type: 'LLM_STREAM_ERROR', error: '无效的请求格式' });
      port.postMessage({ type: 'LLM_STREAM_END' });
      return;
    }

    // 打印完整的消息内容
    console.log('[Background] Messages to send:', messages.length, 'messages');
    console.log('=== Background: Messages to send to LLM ===');
    messages.forEach((msg, idx) => {
      console.log(`[Message ${idx}] role: ${msg.role}`);
      console.log(`[Message ${idx}] content preview:`, msg.content.substring(0, 500) + (msg.content.length > 500 ? '...' : ''));
    });

    // 流式获取响应
    for await (const chunk of provider.streamChat(messages)) {
      // 检查端口是否仍然连接
      if (!port.name) {
        return;
      }
      port.postMessage({ type: 'LLM_STREAM_CHUNK', chunk });
    }

    port.postMessage({ type: 'LLM_STREAM_END' });
  } catch (error) {
    console.error('LLM stream error:', error);
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    port.postMessage({ type: 'LLM_STREAM_ERROR', error: errorMessage });
    port.postMessage({ type: 'LLM_STREAM_END' });
  }
}
