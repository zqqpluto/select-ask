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
  context?: LLMContext,
  _answer?: string,
  targetLanguage?: string
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
      // 如果显式指定了目标语言代码，转换为语言名称
      const langMap: Record<string, string> = {
        'zh': 'Chinese', 'zh-CN': 'Chinese', 'zh-TW': 'Chinese (Traditional)',
        'en': 'English', 'en-US': 'English', 'en-GB': 'English',
        'ja': 'Japanese', 'ko': 'Korean',
        'fr': 'French', 'de': 'German', 'es': 'Spanish', 'ru': 'Russian',
        'pt': 'Portuguese', 'it': 'Italian', 'ar': 'Arabic', 'th': 'Thai',
        'vi': 'Vietnamese'
      };

      let targetLang: string;
      if (targetLanguage && langMap[targetLanguage]) {
        targetLang = langMap[targetLanguage];
      } else {
        // 回退到浏览器语言
        const browserLang = (self as any).navigator?.language || 'zh-CN';
        targetLang = langMap[browserLang] || langMap[browserLang.split('-')[0]] || 'Chinese';
      }

      // 检测源语言（基于 Unicode 字符范围）
      let chineseCount = 0, japaneseKanaCount = 0, koreanCount = 0, latinCount = 0, totalCount = 0;
      for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);
        if (code <= 0x7f && !/[a-zA-Z]/.test(text[i])) continue;
        totalCount++;
        if ((code >= 0x4e00 && code <= 0x9fff) || (code >= 0x3400 && code <= 0x4dbf)) chineseCount++;
        if ((code >= 0x3040 && code <= 0x309f) || (code >= 0x30a0 && code <= 0x30ff)) japaneseKanaCount++;
        if (code >= 0xac00 && code <= 0xd7af) koreanCount++;
        if (/[a-zA-Z]/.test(text[i])) latinCount++;
      }

      const ratios: Record<string, number> = { 'Chinese': chineseCount / (totalCount || 1), 'Japanese': japaneseKanaCount / (totalCount || 1), 'Korean': koreanCount / (totalCount || 1), 'English': latinCount / (totalCount || 1) };
      let sourceLang = 'English';
      let bestRatio = 0;
      for (const [lang, ratio] of Object.entries(ratios)) {
        if (ratio > bestRatio) { bestRatio = ratio; sourceLang = lang; }
      }

      userContent = USER_PROMPTS.translate(text, targetLang, sourceLang);

      // 替换 system prompt 中的{{to}}和{{from}}变量
      const systemContent = SYSTEM_PROMPTS[action]
        .replace(/{{to}}/g, targetLang)
        .replace(/{{from}}/g, sourceLang);
      messages[0] = { role: 'system', content: systemContent };
      messages.push({ role: 'user', content: userContent });
      return messages;
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
    targetLanguage?: string;
    answer?: string;
  }
): Promise<void> {
  try {
    // 获取模型配置
    const model = await getModelConfig(request.modelId);

    if (!model) {
      console.error('[llm-service] 模型配置不存在，modelId:', request.modelId);
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
      messages = buildMessages(request.action, request.text, request.question, request.context, request.answer, request.targetLanguage);
    } else {
      console.error('[llm-service] 无效的请求格式');
      port.postMessage({ type: 'LLM_STREAM_ERROR', error: '无效的请求格式' });
      port.postMessage({ type: 'LLM_STREAM_END' });
      return;
    }

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
    console.error('[llm-service] LLM stream error:', error);
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    port.postMessage({ type: 'LLM_STREAM_ERROR', error: errorMessage });
    port.postMessage({ type: 'LLM_STREAM_END' });
  }
}
