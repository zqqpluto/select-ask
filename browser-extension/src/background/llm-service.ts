/**
 * Background Script LLM 服务
 * 处理来自 content script 的 LLM 请求
 */

import { getLLMProvider } from '../services/llm';
import { getModelConfig } from '../utils/config-manager';
import type { LLMMessage, LLMContext } from '../types/llm';

/**
 * 构建 LLM 消息
 */
function buildMessages(
  action: 'explain' | 'translate' | 'question' | 'generateQuestions',
  text: string,
  question?: string,
  context?: LLMContext
): LLMMessage[] {
  switch (action) {
    case 'explain':
      if (context && (context.before || context.after)) {
        return [
          { role: 'user', content: `请解释以下内容：\n\n${text}\n\n上下文：\n...${context.before}【${text}】${context.after}...` },
        ];
      }
      return [{ role: 'user', content: `请解释以下内容：\n\n${text}` }];

    case 'translate': {
      // 获取目标语言
      const browserLang = (self as any).navigator?.language || 'zh-CN';
      const langMap: Record<string, string> = {
        'zh': '中文', 'zh-CN': '中文', 'zh-TW': '繁体中文',
        'en': '英文', 'en-US': '英文', 'en-GB': '英文',
        'ja': '日语', 'ko': '韩语',
      };
      const targetLang = langMap[browserLang] || langMap[browserLang.split('-')[0]] || '中文';
      return [{ role: 'user', content: `请将以下内容翻译成${targetLang}：\n\n${text}` }];
    }

    case 'question':
      if (context && (context.before || context.after)) {
        return [
          { role: 'user', content: `${question}\n\n选中文本：${text}\n\n上下文：\n...${context.before}【${text}】${context.after}...` },
        ];
      }
      return [{ role: 'user', content: `${question}\n\n选中文本：${text}` }];

    case 'generateQuestions':
      if (context && (context.before || context.after)) {
        return [
          { role: 'user', content: `请分析以下文本和上下文，提炼出用户最可能提出的5个关于选中文本的问题。\n\n选中文本：${text}\n\n上下文：\n...${context.before}【${text}】${context.after}...\n\n要求：\n1. 问题针对选中文本\n2. 结合上下文背景\n3. 简洁、具体、有针对性\n4. 直接返回5个问题，每行一个问题，不要序号或其他格式` },
        ];
      }
      return [
        { role: 'user', content: `请分析以下文本，提炼出用户最可能提出的5个问题。\n\n文本内容：\n${text}\n\n要求：\n1. 问题针对选中文本\n2. 简洁、具体、有针对性\n3. 直接返回5个问题，每行一个问题，不要序号或其他格式` },
      ];

    default:
      return [{ role: 'user', content: text }];
  }
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
    action?: 'explain' | 'translate' | 'question' | 'generateQuestions';
    text?: string;
    question?: string;
    context?: LLMContext;
    modelId: string;
    messages?: { role: string; content: string }[];
  }
): Promise<void> {
  try {
    console.log('[Background] Handling LLM stream request:', request.modelId);

    // 获取模型配置
    const model = await getModelConfig(request.modelId);
    console.log('[Background] Model config:', model ? {
      id: model.id,
      name: model.name,
      provider: model.provider,
      modelId: model.modelId
    } : 'NOT FOUND');

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

    console.log('[Background] Created provider for', model.provider);

    // 构建消息 - 支持两种格式
    let messages: LLMMessage[];

    if (request.messages && request.messages.length > 0) {
      // Side Panel 格式：直接使用 messages 数组
      messages = request.messages.map((m) => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content
      }));
      console.log('=== Background: Using Side Panel message format, count:', messages.length);
    } else if (request.action && request.text) {
      // content script 格式：使用 buildMessages 构建
      messages = buildMessages(request.action, request.text, request.question, request.context);
      console.log('=== Background: Using content script message format ===');
    } else {
      port.postMessage({ type: 'LLM_STREAM_ERROR', error: '无效的请求格式' });
      port.postMessage({ type: 'LLM_STREAM_END' });
      return;
    }

    console.log('=== Background: Starting streamChat ===');

    // 流式获取响应
    let chunkCount = 0;
    for await (const chunk of provider.streamChat(messages)) {
      // 检查端口是否仍然连接
      if (!port.name) {
        console.log('Port disconnected, stopping stream');
        return;
      }
      chunkCount++;
      port.postMessage({ type: 'LLM_STREAM_CHUNK', chunk });
    }

    console.log('=== Background: Stream completed, chunks sent:', chunkCount);
    port.postMessage({ type: 'LLM_STREAM_END' });
  } catch (error) {
    console.error('LLM stream error:', error);
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    port.postMessage({ type: 'LLM_STREAM_ERROR', error: errorMessage });
    port.postMessage({ type: 'LLM_STREAM_END' });
  }
}