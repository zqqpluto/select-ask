/**
 * Background Script LLM 服务
 * 处理来自 content script 的 LLM 请求
 */

import { getLLMProvider } from '../services/llm';
import { getModelConfig } from '../utils/config-manager';
import type { LLMMessage, LLMContext } from '../types/llm';

/**
 * 构建 LLM 消息
 * 根据 action 类型生成对应的 system prompt 和 user prompt
 */
function buildMessages(
  action: 'explain' | 'translate' | 'question' | 'generateQuestions' | 'search',
  text: string,
  question?: string,
  context?: LLMContext
): LLMMessage[] {
  const messages: LLMMessage[] = [];

  // 添加系统提示词
  let systemContent = '';
  console.log('====== [buildMessages] START ======');
  console.log('[buildMessages] action:', action);
  console.log('[buildMessages] text:', text?.substring(0, 50));
  console.log('[buildMessages] context:', context ? 'has context' : 'no context');

  switch (action) {
    case 'explain':
      systemContent = `你是一个专业的知识解释助手，擅长用通俗易懂的方式解释复杂概念。
你的回答应该：
- 使用简单易懂的语言，避免过度专业化
- 多用类比和例子帮助理解
- 逻辑清晰，分步骤讲解
- 提供相关背景知识但不要偏离主题`;
      break;

    case 'search':
      systemContent = `你是一个专业的信息检索助手，擅长搜索、整理和提供准确的事实信息。
你的回答应该：
- 优先提供可验证的事实信息
- 清晰标注信息来源或依据
- 综合多个来源的信息进行整理
- 对于专业术语提供准确的定义
- 区分事实和推测`;
      break;

    case 'translate':
      systemContent = `你是一个专业的翻译助手，擅长准确传达原文含义。
你的翻译应该：
- 保持原文的语调和风格
- 准确传达原文含义，不随意增减内容
- 专业术语使用对应的标准翻译
- 输出仅包含翻译结果，不要添加额外解释`;
      break;

    default:
      break;
  }

  if (systemContent) {
    messages.push({ role: 'system', content: systemContent });
  }

  // 构建 user 消息
  let userContent = '';
  switch (action) {
    case 'explain':
      // AI 解释：侧重解读、翻译、简化、说明
      if (context && (context.before || context.after)) {
        userContent = `请用通俗易懂的方式解释以下内容：\n\n${text}\n\n上下文：\n...${context.before}【${text}】${context.after}...\n\n请结合上下文从以下几个方面进行说明（如果相关）：\n1. 在当前语境中的具体含义（用大白话）\n2. 与上下文的关联关系\n3. 如有抽象概念，用简单类比说明\n4. 如有逻辑关系，分步骤拆解\n5. 相关背景或补充信息`;
      } else {
        userContent = `请用通俗易懂的方式解释以下内容：\n\n${text}\n\n请从以下几个方面进行说明（如果相关）：\n1. 用大白话讲清楚是什么\n2. 如有抽象概念，用简单类比说明\n3. 如有逻辑关系，分步骤拆解\n4. 补充相关背景或概念说明`;
      }
      break;

    case 'search':
      // AI 搜索：侧重检索、匹配、整理信息
      if (context && (context.before || context.after)) {
        userContent = `请搜索并提供关于以下内容的相关信息：\n\n${text}\n\n上下文：\n...${context.before}【${text}】${context.after}...\n\n请结合上下文从以下几个方面进行整理（如果相关）：\n1. 在当前语境中的具体含义\n2. 关键要点或特征\n3. 与上下文的关联关系\n4. 相关背景或扩展信息\n\n注意：\n- 优先提供可验证的事实信息\n- 结合上下文理解选中文本的实际用途\n- 如有相关概念，请提供对比说明`;
      } else {
        userContent = `请搜索并提供关于以下内容的相关信息：\n\n${text}\n\n请从以下几个方面进行整理（如果相关）：\n1. 核心定义/概述\n2. 关键要点或特征\n3. 相关背景或来源\n4. 扩展信息或关联概念\n\n注意：\n- 优先提供可验证的事实信息\n- 如有多个来源，请综合整理\n- 对于专业术语，请提供准确的定义`;
      }
      break;

    case 'translate': {
      // 翻译：准确传达原文含义
      const browserLang = (self as any).navigator?.language || 'zh-CN';
      const langMap: Record<string, string> = {
        'zh': '中文', 'zh-CN': '中文', 'zh-TW': '繁体中文',
        'en': '英文', 'en-US': '英文', 'en-GB': '英文',
        'ja': '日语', 'ko': '韩语',
      };
      const targetLang = langMap[browserLang] || langMap[browserLang.split('-')[0]] || '中文';
      userContent = `请将以下内容翻译成${targetLang}：\n\n${text}\n\n要求：\n1. 保持原文的语调和风格\n2. 准确传达原文含义\n3. 专业术语使用对应的标准翻译\n4. 输出仅包含翻译结果，不要添加额外解释`;
      break;
    }

    case 'question':
      if (context && (context.before || context.after)) {
        userContent = `${question}\n\n选中文本：${text}\n\n上下文：\n...${context.before}【${text}】${context.after}...`;
      } else {
        userContent = `${question}\n\n选中文本：${text}`;
      }
      break;

    case 'generateQuestions':
      if (context && (context.before || context.after)) {
        userContent = `请分析以下文本和上下文，提炼出用户最可能提出的 5 个关于选中文本的问题。\n\n选中文本：${text}\n\n上下文：\n...${context.before}【${text}】${context.after}...\n\n要求：\n1. 问题针对选中文本\n2. 结合上下文背景\n3. 简洁、具体、有针对性\n4. 直接返回 5 个问题，每行一个问题，不要序号或其他格式`;
      } else {
        userContent = `请分析以下文本，提炼出用户最可能提出的 5 个问题。\n\n文本内容：\n${text}\n\n要求：\n1. 问题针对选中文本\n2. 简洁、具体、有针对性\n3. 直接返回 5 个问题，每行一个问题，不要序号或其他格式`;
      }
      break;

    default:
      userContent = text;
      break;
  }

  messages.push({ role: 'user', content: userContent });
  return messages;
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
    console.log('[Background] Handling LLM stream request:', request.modelId);
    console.log('[Background] Request payload:', JSON.stringify(request, null, 2));

    // 获取模型配置
    const model = await getModelConfig(request.modelId);
    console.log('[Background] Model config loaded:', model ? {
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

    // 打印完整的消息内容（用于调试 system prompt）
    console.log('=== Background: Messages to send to LLM ===');
    messages.forEach((msg, idx) => {
      console.log(`[Message ${idx}] role: ${msg.role}`);
      console.log(`[Message ${idx}] content preview:`, msg.content.substring(0, 200) + (msg.content.length > 200 ? '...' : ''));
    });
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
