/**
 * Content Script LLM Service
 * Handles LLM calls within the content script context
 * 通过 Background Service Worker 代理 API 请求以避免 CORS 问题
 */

import { getSelectedChatModel, getSelectedQuestionModel, getSelectedTranslationModel } from '../utils/config-manager';
import type { ModelConfig } from '../types/config';
import { LLM_STREAM_PORT_NAME } from '../types/messages';
import type { LLMMessage, LLMContext } from '../types/llm';

/**
 * 通过 Background 发起 LLM 流式请求
 */
async function* streamViaBackground(
  action: 'explain' | 'translate' | 'question' | 'search',
  text: string,
  question?: string,
  context?: LLMContext,
  targetLanguage?: string
): AsyncGenerator<string, void, unknown> {
  console.log('[content-llm] 开始 - action:', action, 'textLength:', text.length);

  // 根据 action 选择对应的模型
  let model: ModelConfig | null;
  switch (action) {
    case 'translate':
      model = await getSelectedTranslationModel();
      break;
    case 'question':
      model = await getSelectedQuestionModel() || await getSelectedChatModel();
      break;
    default:
      model = await getSelectedChatModel();
  }

  if (!model) {
    console.error('[content-llm] 模型未配置');
    throw new Error('请先在设置中配置并启用至少一个模型');
  }

  console.log('[content-llm] 模型:', model.name);

  // 创建端口连接
  const port = chrome.runtime.connect({ name: LLM_STREAM_PORT_NAME });

  // 创建消息队列
  const messageQueue: { type: string; chunk?: string; error?: string }[] = [];
  let resolveNext: ((value: IteratorResult<string>) => void) | null = null;
  let done = false;
  let error: Error | null = null;

  // 监听端口消息
  port.onMessage.addListener((message) => {
    if (message.type === 'LLM_STREAM_CHUNK') {
      if (resolveNext) {
        resolveNext({ value: message.chunk || '', done: false });
        resolveNext = null;
      } else {
        messageQueue.push(message);
      }
    } else if (message.type === 'LLM_STREAM_ERROR') {
      console.error('[content-llm] 错误:', message.error);
      error = new Error(message.error);
      if (resolveNext) {
        resolveNext({ value: '', done: true });
        resolveNext = null;
      }
    } else if (message.type === 'LLM_STREAM_END') {
      done = true;
      if (resolveNext) {
        resolveNext({ value: '', done: true });
        resolveNext = null;
      }
    }
  });

  // 端口断开时结束
  port.onDisconnect.addListener(() => {
    done = true;
    if (resolveNext) {
      resolveNext({ value: '', done: true });
      resolveNext = null;
    }
  });

  // 发送请求
  port.postMessage({
    type: 'LLM_STREAM_START',
    payload: {
      action,
      text,
      question,
      context,
      modelId: model.id,
      targetLanguage,
    },
  });

  // 生成器
  while (!done) {
    if (messageQueue.length > 0) {
      const msg = messageQueue.shift()!;
      yield msg.chunk || '';
    } else if (error) {
      throw error;
    } else {
      // 等待下一条消息
      yield await new Promise<string>((resolve) => {
        resolveNext = (result) => {
          if (result.done) {
            resolve('');
          } else {
            resolve(result.value);
          }
        };
      });
      if (done) break;
    }
  }

  port.disconnect();
}

/**
 * 构建解释 Prompt（保留用于显示）- 侧重解读、翻译、简化、说明
 */
function buildExplainPrompt(text: string, context?: LLMContext): LLMMessage[] {
  let userContent = '';
  if (context && (context.before || context.after)) {
    userContent = `请用通俗易懂的方式解释"${text}"。

上下文：
...${context.before}【${text}】${context.after}...

请结合上下文从以下几个方面进行说明（如果相关）：
1. 在当前语境中的具体含义（用大白话）
2. 与上下文的关联关系
3. 如有抽象概念，用简单类比说明
4. 如有逻辑关系，分步骤拆解
5. 相关背景或补充信息`;
  } else {
    userContent = `请用通俗易懂的方式解释"${text}"。

请从以下几个方面进行说明（如果相关）：
1. 用大白话讲清楚是什么
2. 如有抽象概念，用简单类比说明
3. 如有逻辑关系，分步骤拆解
4. 补充相关背景或概念说明`;
  }

  return [
    { role: 'user', content: userContent },
  ];
}

/**
 * 构建搜索 Prompt（保留用于显示）- 侧重检索、匹配、整理信息
 */
function buildSearchPrompt(text: string, context?: LLMContext): LLMMessage[] {
  let userContent = '';
  if (context && (context.before || context.after)) {
    userContent = `请搜索并提供关于"${text}"的相关信息。

上下文：
...${context.before}【${text}】${context.after}...

请结合上下文从以下几个方面进行整理（如果相关）：
1. 在当前语境中的具体含义
2. 关键要点或特征
3. 与上下文的关联关系
4. 相关背景或扩展信息

注意：
- 优先提供可验证的事实信息
- 结合上下文理解选中文本的实际用途
- 如有相关概念，请提供对比说明`;
  } else {
    userContent = `请搜索并提供关于"${text}"的相关信息。

请从以下几个方面进行整理（如果相关）：
1. 核心定义/概述
2. 关键要点或特征
3. 相关背景或来源
4. 扩展信息或关联概念

注意：
- 优先提供可验证的事实信息
- 如有多个来源，请综合整理
- 对于专业术语，请提供准确的定义`;
  }

  return [
    { role: 'user', content: userContent },
  ];
}

/**
 * 获取目标翻译语言
 * 支持显式指定或使用浏览器语言
 */
function getTargetLanguage(override?: string): string {
  const browserLang = navigator.language || (navigator as any).userLanguage;
  // 语言代码映射到语言名称
  const languageNames: Record<string, string> = {
    'zh': '中文',
    'zh-CN': '中文',
    'zh-TW': '繁体中文',
    'zh-HK': '繁体中文',
    'en': '英文',
    'en-US': '英文',
    'en-GB': '英文',
    'ja': '日语',
    'ko': '韩语',
    'fr': '法语',
    'de': '德语',
    'es': '西班牙语',
    'ru': '俄语',
    'pt': '葡萄牙语',
    'it': '意大利语',
    'ar': '阿拉伯语',
    'th': '泰语',
    'vi': '越南语',
  };

  // 如果显式指定了语言
  const langToUse = override || browserLang;
  if (langToUse) {
    if (languageNames[langToUse]) return languageNames[langToUse];
    const langCode = langToUse.split('-')[0];
    if (languageNames[langCode]) return languageNames[langCode];
  }

  // 默认返回中文
  return '中文';
}

/**
 * 构建翻译 Prompt（支持指定目标语言）
 */
function buildTranslatePrompt(text: string, targetLanguage?: string): LLMMessage[] {
  const targetLang = getTargetLanguage(targetLanguage);
  const userContent = `将"${text}"翻译成${targetLang}`;

  return [
    { role: 'user', content: userContent },
  ];
}

/**
 * 构建问题回答 Prompt（保留用于显示）
 */
function buildQuestionPrompt(question: string, text: string, context?: LLMContext): LLMMessage[] {
  let userContent = '';
  if (context && (context.before || context.after)) {
    userContent = `${question}

选中文本：${text}

上下文：
...${context.before}【${text}】${context.after}...`;
  } else {
    userContent = `${question}

选中文本：${text}`;
  }

  return [
    { role: 'user', content: userContent },
  ];
}

/**
 * 构建问题生成 Prompt（保留用于显示）
 */
function buildQuestionsGenerationPrompt(text: string, context?: LLMContext): LLMMessage[] {
  let userContent = '';
  if (context && (context.before || context.after)) {
    userContent = `请分析以下文本和上下文，提炼出用户最可能提出的5个关于选中文本的问题。

选中文本：${text}

上下文：
...${context.before}【${text}】${context.after}...

要求：
1. 问题针对选中文本
2. 结合上下文背景
3. 简洁、具体、有针对性
4. 直接返回5个问题，每行一个问题，不要序号或其他格式`;
  } else {
    userContent = `请分析以下文本，提炼出用户最可能提出的5个问题。

文本内容：
${text}

要求：
1. 问题针对选中文本
2. 简洁、具体、有针对性
3. 直接返回5个问题，每行一个问题，不要序号或其他格式`;
  }

  return [
    { role: 'user', content: userContent },
  ];
}

/**
 * 流式聊天回调
 */
export interface StreamCallbacks {
  onReasoning: (text: string) => void;
  onReasoningDone: () => void;
  onContent: (text: string) => void;
  onError: (error: Error) => void;
  onComplete: () => void;
}

/**
 * 执行解释操作
 */
export async function* streamExplain(
  text: string,
  context?: LLMContext
): AsyncGenerator<string, void, unknown> {
  yield* streamViaBackground('explain', text, undefined, context);
}

/**
 * 执行翻译操作
 */
export async function* streamTranslate(
  text: string,
  targetLanguage?: string,
  context?: { prefix?: string; suffix?: string }
): AsyncGenerator<string, void, unknown> {
  try {
    // 将 prefix/suffix 适配到 LLMContext 格式
    const llmContext: LLMContext | undefined = context ? {
      before: context.prefix || '',
      after: context.suffix || '',
    } : undefined;
    yield* streamViaBackground('translate', text, undefined, llmContext, targetLanguage);
  } catch (error) {
    console.error('[streamTranslate] 失败:', error instanceof Error ? error.message : error);
    throw error;
  }
}

/**
 * 执行问题回答操作
 */
export async function* streamQuestion(
  question: string,
  text: string,
  context?: LLMContext
): AsyncGenerator<string, void, unknown> {
  yield* streamViaBackground('question', text, question, context);
}

/**
 * 执行搜索操作
 */
export async function* streamSearch(
  text: string,
  context?: LLMContext
): AsyncGenerator<string, void, unknown> {
  yield* streamViaBackground('search', text, undefined, context);
}

/**
 * 执行页面总结操作
 */
export async function* streamSummarize(
  text: string
): AsyncGenerator<string, void, unknown> {
  yield* streamViaBackground('question', text, undefined, undefined);
}


/**
 * 检查模型是否已配置
 */
export async function checkModelConfigured(): Promise<{ chat: boolean; question: boolean }> {
  const [chatModel, questionModel] = await Promise.all([
    getSelectedChatModel(),
    getSelectedQuestionModel(),
  ]);

  return {
    chat: !!chatModel,
    question: !!questionModel,
  };
}