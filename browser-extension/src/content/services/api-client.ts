import { streamExplain, streamTranslate, streamQuestion, streamSearch } from '../services/content-llm';
import {
  addSession,
  updateSession,
  generateSessionId,
  generateTitle,
} from '../../utils/history-manager';
import { getSelectedChatModel } from '../../utils/config-manager';
import { renderMarkdown } from '../../utils/markdown';
import {
  normalizeReasoningText,
  renderReasoningText,
} from '../utils/helpers';
import { saveToCache } from '../utils/response-cache';
import type { HistorySession, HistoryMessage } from '../../types/history';

/**
 * Session state interface for API calls
 */
export interface APISessionState {
  sessionId: string | null;
  sessionType: 'explain' | 'translate' | 'question' | 'search' | 'summarize' | 'custom';
  selectedText: string;
  messages: HistoryMessage[];
  saved: boolean;
}

/**
 * UI elements for backend API calls
 */
export interface BackendAPIUI {
  reasoningText: HTMLElement | null;
  answerText: HTMLElement | null;
  reasoningToggle: HTMLElement | null;
  reasoningSection: HTMLElement | null;
  aiContent: HTMLElement | null;
  messageElement: HTMLElement;
  floatingBox: HTMLElement;
  inputArea: HTMLElement;
}

/**
 * 调用后端 API 获取流式响应（解释/翻译/搜索）
 */
export async function callBackendAPI(
  action: string,
  text: string,
  context: any,
  ui: BackendAPIUI,
  sessionState: APISessionState,
  onSessionStateUpdate: (state: Partial<APISessionState>) => void
): Promise<void> {
  const startTime = Date.now();

  const actionMap: Record<string, string> = {
    '解释': 'explain',
    '翻译': 'translate',
    '搜索': 'search',
  };

  const apiAction = actionMap[action] || action;

  const { reasoningText, answerText, reasoningToggle, reasoningSection, aiContent, messageElement, floatingBox, inputArea } = ui;

  let reasoningContent = '';
  let answerContent = '';
  let hasReasoning = false;
  let hasAnswer = false;

  try {
    // 如果之前的会话已保存到历史记录，创建新会话
    if (sessionState.saved) {
      onSessionStateUpdate({
        sessionId: generateSessionId(),
        sessionType: apiAction === 'translate' ? 'translate' : 'explain',
        selectedText: text,
        messages: [],
        saved: false,
      });
    }

    // 初始化新会话
    if (!sessionState.sessionId) {
      onSessionStateUpdate({
        sessionId: generateSessionId(),
        sessionType: apiAction === 'translate' ? 'translate' : 'explain',
        selectedText: text,
        messages: [],
        saved: false,
      });
    }

    // 确保用户消息被添加到会话
    const currentMessages = [...sessionState.messages];
    const hasUserMessage = currentMessages.some(
      m => m.role === 'user' && m.content === text
    );
    if (!hasUserMessage) {
      currentMessages.push({
        role: 'user',
        content: text,
        timestamp: Date.now(),
      });
    }

    const llmContext = context ? {
      selected: text,
      before: context.before || '',
      after: context.after || '',
    } : undefined;

    const streamGenerator = apiAction === 'translate'
      ? streamTranslate(text)
      : streamExplain(text, llmContext);

    for await (const chunk of streamGenerator) {
      if (chunk === '[REASONING]') {
        hasReasoning = true;
        if (reasoningSection) {
          reasoningSection.style.display = 'block';
          reasoningSection.classList.add('expanded');
        }
        if (answerText) {
          answerText.innerHTML = '';
          answerText.classList.remove('select-ask-loading-placeholder');
        }
        continue;
      }
      if (chunk === '[REASONING_DONE]') {
        if (reasoningToggle) {
          reasoningToggle.textContent = '思考过程';
        }
        continue;
      }
      if (chunk.startsWith('[REASONING]')) {
        if (!hasReasoning) {
          hasReasoning = true;
          if (reasoningSection) {
            reasoningSection.style.display = 'block';
            reasoningSection.classList.add('expanded');
          }
          if (answerText) {
            answerText.innerHTML = '';
            answerText.classList.remove('select-ask-loading-placeholder');
          }
        }
        const text = chunk.slice(11);
        reasoningContent += text;
        if (reasoningText) {
          reasoningText.innerHTML = renderReasoningText(normalizeReasoningText(reasoningContent));
        }
      } else if (chunk.startsWith('[ERROR:')) {
        throw new Error(chunk.slice(7, -1));
      } else {
        if (!hasAnswer) {
          hasAnswer = true;
          if (answerText) {
            answerText.innerHTML = '';
            answerText.classList.remove('select-ask-loading-placeholder');
          }
        }
        answerContent += chunk;
        if (answerText) {
          answerText.innerHTML = renderMarkdown(answerContent);
        }
      }
    }

    if (answerText) {
      answerText.classList.remove('streaming');
    }

    if (reasoningText && reasoningContent) {
      reasoningText.innerHTML = renderReasoningText(normalizeReasoningText(reasoningContent));
    }

    // 存储重新生成上下文
    if (messageElement && answerContent) {
      messageElement.dataset.regenerateType = apiAction;
      messageElement.dataset.regenerateText = text;
      messageElement.dataset.regenerateContext = context ? JSON.stringify(context) : '';
    }

    // 保存到缓存
    saveToCache(text, {
      [apiAction]: answerContent,
      [`${apiAction}Reasoning`]: reasoningContent
    });

    // 保存 AI 回答到当前会话消息
    const currentModel = await getSelectedChatModel();
    const finalMessages = [...currentMessages, {
      role: 'assistant' as const,
      content: answerContent,
      reasoning: reasoningContent || undefined,
      timestamp: Date.now(),
      modelName: currentModel?.name || 'AI',
      duration: Date.now() - startTime,
    }];

    onSessionStateUpdate({ messages: finalMessages });

    // 保存会话到历史记录
    const updatedSessionId = sessionState.sessionId;
    if (updatedSessionId && finalMessages.length > 0) {
      const model = await getSelectedChatModel();
      if (!sessionState.saved) {
        const session: HistorySession = {
          id: updatedSessionId,
          title: generateTitle(sessionState.selectedText, sessionState.sessionType),
          type: sessionState.sessionType,
          selectedText: sessionState.selectedText,
          messages: finalMessages,
          modelId: model?.id || 'unknown',
          modelName: model?.name || 'AI',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          pageUrl: window.location.href,
          pageTitle: document.title,
        };
        await addSession(session);
        onSessionStateUpdate({ saved: true });
      } else {
        await updateSession(updatedSessionId, {
          messages: finalMessages,
          modelId: model?.id || 'unknown',
          modelName: model?.name || 'AI',
        });
      }
    }

    return {
      answerContent,
      reasoningContent,
      elapsed: (Date.now() - startTime) / 1000,
      messages: finalMessages,
    };
  } catch (error) {
    console.error('Failed to call LLM:', error);
    if (answerText) {
      const errorMessage = error instanceof Error ? error.message : '请求失败，请稍后重试';
      answerText.innerHTML = `<div class="select-ask-error-message">${errorMessage}</div>`;
      answerText.classList.remove('streaming');
    }
    throw error;
  }
}

/**
 * 调用后端 API 获取追问流式响应
 */
export async function callFollowUpBackendAPI(
  question: string,
  originalText: string,
  context: any,
  ui: {
    messageElement: HTMLElement;
    inputArea: HTMLElement;
    reasoningText: HTMLElement | null;
    answerText: HTMLElement | null;
    reasoningToggle: HTMLElement | null;
    reasoningSection: HTMLElement | null;
    aiContent: HTMLElement | null;
  },
  sessionState: {
    sessionId: string | null;
    selectedText: string;
    sessionType: 'explain' | 'translate' | 'question' | 'search' | 'summarize' | 'custom';
    messages: HistoryMessage[];
  },
  onUpdateSession: (messages: HistoryMessage[]) => void
): Promise<{ answerContent: string; reasoningContent: string }> {
  const startTime = Date.now();
  const { messageElement, inputArea, reasoningText, answerText, reasoningToggle, reasoningSection, aiContent } = ui;

  let reasoningContent = '';
  let answerContent = '';
  let hasReasoning = false;
  let hasAnswer = false;

  try {
    const llmContext = context ? {
      selected: originalText,
      before: context.before || '',
      after: context.after || '',
    } : undefined;

    for await (const chunk of streamQuestion(question, originalText, llmContext)) {
      if (chunk === '[REASONING]') {
        hasReasoning = true;
        if (reasoningSection) {
          reasoningSection.style.display = 'block';
          reasoningSection.classList.add('expanded');
        }
        if (answerText) {
          answerText.innerHTML = '';
          answerText.classList.remove('select-ask-loading-placeholder');
        }
        continue;
      }
      if (chunk === '[REASONING_DONE]') {
        if (reasoningText) reasoningText.classList.remove('streaming');
        if (reasoningToggle) reasoningToggle.textContent = '思考过程';
        continue;
      }
      if (chunk.startsWith('[REASONING]')) {
        if (!hasReasoning) {
          hasReasoning = true;
          if (reasoningSection) {
            reasoningSection.style.display = 'block';
            reasoningSection.classList.add('expanded');
          }
          if (answerText) {
            answerText.innerHTML = '';
            answerText.classList.remove('select-ask-loading-placeholder');
          }
        }
        const text = chunk.slice(11);
        reasoningContent += text;
        if (reasoningText) {
          reasoningText.innerHTML = renderReasoningText(normalizeReasoningText(reasoningContent));
        }
      } else if (chunk.startsWith('[ERROR:')) {
        throw new Error(chunk.slice(7, -1));
      } else {
        if (!hasAnswer) {
          hasAnswer = true;
          if (answerText) {
            answerText.innerHTML = '';
            answerText.classList.remove('select-ask-loading-placeholder');
          }
        }
        answerContent += chunk;
        if (answerText) answerText.innerHTML = renderMarkdown(answerContent);
      }
    }

    if (answerText) answerText.classList.remove('streaming');

    if (reasoningText && reasoningContent) {
      reasoningText.innerHTML = renderReasoningText(normalizeReasoningText(reasoningContent));
    }

    // 存储重新生成上下文
    if (messageElement) {
      messageElement.dataset.regenerateType = 'followup';
      messageElement.dataset.regenerateText = originalText;
      messageElement.dataset.regenerateContext = context ? JSON.stringify(context) : '';
      messageElement.dataset.regenerateQuestion = question;
    }

    // 保存追问消息到当前会话
    if (sessionState.sessionId) {
      const newMessages = [
        ...sessionState.messages,
        { role: 'user' as const, content: question, timestamp: Date.now() },
        {
          role: 'assistant' as const,
          content: answerContent,
          reasoning: reasoningContent || undefined,
          timestamp: Date.now(),
        },
      ];
      onUpdateSession(newMessages);

      const currentModel = await getSelectedChatModel();
      await updateSession(sessionState.sessionId, {
        messages: newMessages,
        modelId: currentModel?.id || 'unknown',
        modelName: currentModel?.name || 'AI',
      });
    }

    return { answerContent, reasoningContent };
  } catch (error) {
    console.error('Follow-up API failed:', error);
    if (answerText) {
      const errorMessage = error instanceof Error ? error.message : '请求失败，请稍后重试';
      answerText.innerHTML = `<div class="select-ask-error-message">${errorMessage}</div>`;
      answerText.classList.remove('streaming');
    }
    throw error;
  }
}

/**
 * 侧边栏模式下的后端 API 调用
 */
export async function callBackendAPIForSidebar(
  action: string,
  text: string,
  context: any,
  ui: {
    messageElement: HTMLElement;
    sidebar: HTMLElement;
    inputArea: HTMLElement;
    reasoningText: HTMLElement | null;
    answerText: HTMLElement | null;
    reasoningToggle: HTMLElement | null;
    reasoningSection: HTMLElement | null;
    aiContent: HTMLElement | null;
    aiTimeEl: HTMLElement | null;
  },
  sessionState: {
    sessionId: string | null;
    selectedText: string;
    sessionType: 'explain' | 'translate' | 'question' | 'search' | 'summarize' | 'custom';
    messages: HistoryMessage[];
    saved: boolean;
  },
  onUpdateSession: (state: Partial<APISessionState>) => void,
  onEnableFollowUp: () => void
): Promise<void> {
  const startTime = Date.now();

  const actionMap: Record<string, string> = {
    '解释': 'explain',
    '翻译': 'translate',
    '搜索': 'search',
  };

  const apiAction = actionMap[action] || action;

  const { messageElement, sidebar, inputArea, reasoningText, answerText, reasoningToggle, reasoningSection, aiContent, aiTimeEl } = ui;

  let reasoningContent = '';
  let answerContent = '';
  let hasReasoning = false;
  let hasAnswer = false;

  try {
    const llmContext = context ? {
      selected: text,
      before: context.before || '',
      after: context.after || '',
    } : undefined;

    let streamGenerator;
    if (apiAction === 'translate') {
      streamGenerator = streamTranslate(text);
    } else if (apiAction === 'search') {
      streamGenerator = streamSearch(text, llmContext);
    } else {
      streamGenerator = streamExplain(text, llmContext);
    }

    for await (const chunk of streamGenerator) {
      if (chunk === '[REASONING]') {
        hasReasoning = true;
        if (reasoningSection) {
          reasoningSection.style.display = 'block';
          reasoningSection.classList.add('expanded');
        }
        if (answerText) {
          answerText.innerHTML = '';
          answerText.classList.remove('select-ask-loading-placeholder');
        }
        continue;
      }
      if (chunk === '[REASONING_DONE]') {
        if (reasoningToggle) {
          reasoningToggle.textContent = '思考过程';
        }
        continue;
      }
      if (chunk.startsWith('[REASONING]')) {
        if (!hasReasoning) {
          hasReasoning = true;
          if (reasoningSection) {
            reasoningSection.style.display = 'block';
            reasoningSection.classList.add('expanded');
          }
          if (answerText) {
            answerText.innerHTML = '';
            answerText.classList.remove('select-ask-loading-placeholder');
          }
        }
        const text = chunk.slice(11);
        reasoningContent += text;
        if (reasoningText) {
          reasoningText.innerHTML = renderReasoningText(normalizeReasoningText(reasoningContent));
        }
      } else if (chunk.startsWith('[ERROR:')) {
        throw new Error(chunk.slice(7, -1));
      } else {
        if (!hasAnswer) {
          hasAnswer = true;
          if (answerText) {
            answerText.innerHTML = '';
            answerText.classList.remove('select-ask-loading-placeholder');
          }
        }
        answerContent += chunk;
        if (answerText) {
          answerText.innerHTML = renderMarkdown(answerContent);
        }
      }
    }

    // 更新耗时
    const elapsed = (Date.now() - startTime) / 1000;
    if (aiTimeEl) {
      aiTimeEl.textContent = `${elapsed.toFixed(1)}s`;
    }

    // 添加操作按钮标记
    if (messageElement) {
      messageElement.dataset.regenerateType = apiAction;
      messageElement.dataset.regenerateText = text;
      messageElement.dataset.regenerateContext = context ? JSON.stringify(context) : '';
    }

    // 保存到缓存
    saveToCache(text, {
      [apiAction]: answerContent,
      [`${apiAction}Reasoning`]: reasoningContent
    });

    // 保存 AI 回答到当前会话消息
    const currentModel = await getSelectedChatModel();
    const newMessages = [
      ...sessionState.messages,
      {
        role: 'assistant' as const,
        content: answerContent,
        reasoning: reasoningContent || undefined,
        timestamp: Date.now(),
        modelName: currentModel?.name || 'AI',
        duration: Date.now() - startTime,
      },
    ];

    // 保存会话到历史记录
    if (sessionState.sessionId && newMessages.length > 0) {
      const model = await getSelectedChatModel();
      if (!sessionState.saved) {
        const session: HistorySession = {
          id: sessionState.sessionId,
          title: generateTitle(sessionState.selectedText, sessionState.sessionType),
          type: sessionState.sessionType,
          selectedText: sessionState.selectedText,
          messages: newMessages,
          modelId: model?.id || 'unknown',
          modelName: model?.name || 'AI',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          pageUrl: window.location.href,
          pageTitle: document.title,
        };
        await addSession(session);
        onUpdateSession({ saved: true, messages: newMessages });
      } else {
        await updateSession(sessionState.sessionId, {
          messages: newMessages,
          modelId: model?.id || 'unknown',
          modelName: model?.name || 'AI',
        });
        onUpdateSession({ messages: newMessages });
      }
    }

    // 启用输入功能
    onEnableFollowUp();
    inputArea.dataset.isLoading = 'false';

  } catch (error) {
    console.error('Failed to call LLM:', error);
    if (answerText) {
      const errorMessage = error instanceof Error ? error.message : '请求失败，请稍后重试';
      answerText.innerHTML = `<div class="select-ask-error-message">${errorMessage}</div>`;
    }
    inputArea.dataset.isLoading = 'false';
    throw error;
  }
}
