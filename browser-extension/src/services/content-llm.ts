/**
 * Content Script LLM Service
 * Handles LLM calls within the content script context
 * 通过 Background Service Worker 代理 API 请求以避免 CORS 问题
 */

import { getSelectedChatModel, getSelectedQuestionModel } from '../utils/config-manager';
import { LLM_STREAM_PORT_NAME } from '../types/messages';
import type { LLMMessage, LLMContext } from '../types/llm';

/**
 * 通过 Background 发起 LLM 流式请求
 */
async function* streamViaBackground(
  action: 'explain' | 'translate' | 'question' | 'generateQuestions',
  text: string,
  question?: string,
  context?: LLMContext
): AsyncGenerator<string, void, unknown> {
  // 获取当前模型
  const model = action === 'generateQuestions'
    ? await getSelectedQuestionModel()
    : await getSelectedChatModel();

  if (!model) {
    throw new Error(action === 'generateQuestions' ? '请先在设置中选择问题生成模型' : '请先在设置中选择问答模型');
  }

  console.log('[content-llm] Sending request to background:', {
    action,
    modelId: model.id,
    modelName: model.name,
    provider: model.provider,
    textLength: text.length
  });

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
      console.error('[content-llm] Background error:', message.error);
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
 * 构建解释 Prompt（保留用于显示）
 */
function buildExplainPrompt(text: string, context?: LLMContext): LLMMessage[] {
  let userContent = '';
  if (context && (context.before || context.after)) {
    userContent = `"${text}"是什么？

上下文：
...${context.before}【${text}】${context.after}...`;
  } else {
    userContent = `"${text}"是什么？`;
  }

  return [
    { role: 'user', content: userContent },
  ];
}

/**
 * 获取目标翻译语言
 */
function getTargetLanguage(): string {
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

  // 查找匹配的语言
  if (browserLang) {
    // 先尝试完全匹配
    if (languageNames[browserLang]) {
      return languageNames[browserLang];
    }
    // 再尝试匹配语言代码前缀
    const langCode = browserLang.split('-')[0];
    if (languageNames[langCode]) {
      return languageNames[langCode];
    }
  }

  // 默认返回中文
  return '中文';
}

/**
 * 构建翻译 Prompt（保留用于显示）
 */
function buildTranslatePrompt(text: string): LLMMessage[] {
  const targetLang = getTargetLanguage();
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
  text: string
): AsyncGenerator<string, void, unknown> {
  yield* streamViaBackground('translate', text);
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
 * 生成问题列表
 */
export async function generateQuestions(
  text: string,
  context?: LLMContext
): Promise<string[]> {
  let responseText = '';

  for await (const chunk of streamViaBackground('generateQuestions', text, undefined, context)) {
    responseText += chunk;
  }

  // 过滤掉可能的 REASONING/ANSWER 标签内容
  // 提取 <ANSWER> 标签内的内容（如果存在）
  const answerMatch = responseText.match(/<ANSWER>([\s\S]*?)<\/ANSWER>/);
  if (answerMatch) {
    responseText = answerMatch[1].trim();
  }

  // 移除可能存在的 REASONING 标签和内容
  responseText = responseText.replace(/<REASONING>[\s\S]*?<\/REASONING>/g, '');
  responseText = responseText.replace(/\[REASONING\]/g, '');
  responseText = responseText.replace(/\[REASONING_DONE\]/g, '');

  // 解析问题列表
  const lines = responseText.split('\n').filter(line => line.trim());
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