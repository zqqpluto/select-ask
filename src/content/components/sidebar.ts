import { streamQuestion } from '../../services/content-llm';
import { getSelectedChatModel, getAppConfig, saveAppConfig } from '../../utils/config-manager';
import { renderMarkdown } from '../../utils/markdown';
import { escapeHtml } from '../../utils/shared';
import { openSidebarLayout, closeSidebarLayout } from '../utils/layout';
import type { HistorySession } from '../../types/history';

let currentSidebar: HTMLElement | null = null;

/**
 * 设置当前侧边栏实例
 */
export function setCurrentSidebar(sb: HTMLElement | null): void {
  currentSidebar = sb;
}

/**
 * 获取当前侧边栏实例
 */
export function getCurrentSidebar(): HTMLElement | null {
  return currentSidebar;
}

/**
 * 关闭当前侧边栏
 */
export function closeSidebar(): void {
  if (currentSidebar) {
    currentSidebar.remove();
    currentSidebar = null;
    closeSidebarLayout();
  }
}

/**
 * 创建侧边栏
 */
export async function createSidebar(session?: HistorySession): Promise<HTMLElement> {
  // 移除已有的侧边栏
  if (currentSidebar) {
    currentSidebar.remove();
    closeSidebarLayout();
  }

  // 获取用户偏好宽度
  const config = await getAppConfig();
  const savedWidth = config.preferences?.sidebarWidth || 420;

  const sidebar = document.createElement('div');
  sidebar.className = 'select-ask-sidebar';
  sidebar.style.width = `${savedWidth}px`;

  // 创建拖拽手柄
  const resizeHandle = document.createElement('div');
  resizeHandle.className = 'select-ask-sidebar-resize-handle';
  resizeHandle.style.cssText = `
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 4px;
    cursor: ew-resize;
    background: transparent;
    transition: background 0.2s;
    z-index: 10;
  `;

  resizeHandle.addEventListener('mouseenter', () => {
    resizeHandle.style.background = 'rgba(59, 130, 246, 0.3)';
  });
  resizeHandle.addEventListener('mouseleave', () => {
    resizeHandle.style.background = 'transparent';
  });

  sidebar.appendChild(resizeHandle);

  sidebar.innerHTML += `
    <div class="select-ask-sidebar-header">
      <div class="select-ask-sidebar-header-title">
        <img src="${chrome.runtime.getURL('public/icons/icon48.png')}" alt="Select Ask" class="select-ask-sidebar-logo" />
        <span>Select Ask</span>
      </div>
      <button class="select-ask-sidebar-close">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
    </div>
    <div class="select-ask-sidebar-content">
      <div class="select-ask-sidebar-chat"></div>
    </div>
    <div class="select-ask-sidebar-input">
      <div class="select-ask-sidebar-input-box">
        <textarea placeholder="输入消息..." rows="1"></textarea>
        <button class="select-ask-sidebar-send" disabled>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(sidebar);
  currentSidebar = sidebar;

  // 拖拽调整宽度
  let isResizing = false;
  let startX = 0;
  let startWidth = savedWidth;

  resizeHandle.addEventListener('mousedown', (e) => {
    isResizing = true;
    startX = e.clientX;
    startWidth = sidebar.offsetWidth;
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    const deltaX = startX - e.clientX;
    const newWidth = Math.max(300, Math.min(800, startWidth + deltaX));
    sidebar.style.width = `${newWidth}px`;
    document.body.style.marginRight = `${newWidth}px`;
    document.body.style.width = `calc(100% - ${newWidth}px)`;
  });

  document.addEventListener('mouseup', async () => {
    if (!isResizing) return;
    isResizing = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';

    const newWidth = sidebar.offsetWidth;
    const config = await getAppConfig();
    config.preferences = {
      ...config.preferences,
      sendWithEnter: config.preferences?.sendWithEnter ?? false,
      sidebarWidth: newWidth,
      autoGenerateQuestions: config.preferences?.autoGenerateQuestions ?? true,
    };
    await saveAppConfig(config);
  });

  // 调整页面布局
  openSidebarLayout();

  // 关闭按钮
  const closeBtn = sidebar.querySelector('.select-ask-sidebar-close');
  closeBtn?.addEventListener('click', () => {
    sidebar.remove();
    currentSidebar = null;
    closeSidebarLayout();
  });

  // 恢复会话
  if (session) {
    await restoreSession(sidebar, session);
  }

  // 输入框
  const textarea = sidebar.querySelector('textarea') as HTMLTextAreaElement;
  const sendBtn = sidebar.querySelector('.select-ask-sidebar-send') as HTMLButtonElement;

  textarea?.addEventListener('input', () => {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    sendBtn.disabled = !textarea.value.trim();
  });

  sendBtn?.addEventListener('click', async () => {
    const message = textarea.value.trim();
    if (!message) return;

    addSidebarMessage(sidebar, 'user', message);
    textarea.value = '';
    textarea.style.height = 'auto';
    sendBtn.disabled = true;

    const aiMsgElement = addSidebarMessage(sidebar, 'assistant', '', true);
    await getSidebarAIResponse(sidebar, message, aiMsgElement, session);
  });

  textarea?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (textarea.value.trim() && !sendBtn.disabled) {
        sendBtn.click();
      }
    }
  });

  return sidebar;
}

/**
 * 添加侧边栏消息
 */
export function addSidebarMessage(sidebar: HTMLElement, role: 'user' | 'assistant', content: string, isLoading: boolean = false): HTMLElement {
  const chatContainer = sidebar.querySelector('.select-ask-sidebar-chat') as HTMLElement;
  const msgDiv = document.createElement('div');
  msgDiv.className = `select-ask-sidebar-message select-ask-sidebar-message-${role}`;

  if (role === 'user') {
    msgDiv.innerHTML = `<div class="select-ask-sidebar-message-content">${escapeHtml(content)}</div>`;
  } else {
    msgDiv.innerHTML = `
      <div class="select-ask-sidebar-message-content">
        ${isLoading ? '<span class="select-ask-sidebar-loading">思考中...</span>' : renderMarkdown(content)}
      </div>
    `;
  }

  chatContainer.appendChild(msgDiv);
  chatContainer.scrollTop = chatContainer.scrollHeight;
  return msgDiv;
}

/**
 * 获取侧边栏 AI 响应
 */
export async function getSidebarAIResponse(sidebar: HTMLElement, question: string, msgElement: HTMLElement, session?: HistorySession): Promise<void> {
  const contentEl = msgElement.querySelector('.select-ask-sidebar-message-content') as HTMLElement;

  try {
    const model = await getSelectedChatModel();
    if (!model) {
      contentEl.innerHTML = '<span class="select-ask-sidebar-error">请先配置模型</span>';
      return;
    }

    let fullContent = '';
    let hasAnswer = false;

    for await (const chunk of streamQuestion(question, session?.selectedText || '', undefined)) {
      if (chunk === '[REASONING]') continue;
      if (chunk === '[REASONING_DONE]') continue;
      if (chunk.startsWith('[REASONING]')) continue;
      if (chunk.startsWith('[ERROR:')) throw new Error(chunk.slice(7, -1));

      if (!hasAnswer) {
        hasAnswer = true;
        contentEl.innerHTML = '';
      }
      fullContent += chunk;
      contentEl.innerHTML = renderMarkdown(fullContent);

      const chatContainer = sidebar.querySelector('.select-ask-sidebar-chat') as HTMLElement;
      if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    contentEl.innerHTML = `<span class="select-ask-sidebar-error">错误: ${errorMessage}</span>`;
  }
}

/**
 * 恢复会话内容
 */
export async function restoreSession(sidebar: HTMLElement, session: HistorySession): Promise<void> {
  const chatContainer = sidebar.querySelector('.select-ask-sidebar-chat') as HTMLElement;
  chatContainer.innerHTML = '';

  if (session.selectedText) {
    const contextDiv = document.createElement('div');
    contextDiv.className = 'select-ask-sidebar-context';
    contextDiv.innerHTML = `
      <div class="select-ask-sidebar-context-label">原始文本</div>
      <div class="select-ask-sidebar-context-text">${escapeHtml(session.selectedText.slice(0, 200))}${session.selectedText.length > 200 ? '...' : ''}</div>
    `;
    chatContainer.appendChild(contextDiv);
  }

  for (const msg of session.messages) {
    addSidebarMessage(sidebar, msg.role, msg.content);
  }
}

/**
 * 在 Chrome Side Panel 中显示解释/翻译响应
 */
export async function showResponseInSidebar(
  title: string,
  text: string,
  context: any,
  summaryPrompt?: string
): Promise<void> {
  chrome.runtime.sendMessage({
    type: 'OPEN_SIDE_PANEL',
    selectedText: text,
    context: context,
    userMessage: title,
    summaryPrompt: summaryPrompt || null,
    pageUrl: window.location.href,
    pageTitle: document.title,
  }, (response) => {
    if (!response?.success) {
      console.error('Failed to open Side Panel:', response?.error);
    }
  });
}
