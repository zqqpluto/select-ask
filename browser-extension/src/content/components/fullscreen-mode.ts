import { getHistory } from '../../utils/history-manager';
import { escapeHtml } from '../../utils/shared';
import { renderMarkdown } from '../../utils/markdown';
import { showToast, formatAbsoluteTime, formatHistoryTime } from '../utils/helpers';
import type { HistorySession } from '../../types/history';

/**
 * 全屏状态（模块级单例）
 */
let isFullscreen = false;

export function getFullscreenState(): boolean {
  return isFullscreen;
}

export function setFullscreenState(value: boolean): void {
  isFullscreen = value;
}

/**
 * 当前历史记录侧边栏引用
 */
let currentHistorySidebar: HTMLElement | null = null;

export function getCurrentHistorySidebar(): HTMLElement | null {
  return currentHistorySidebar;
}

export function setCurrentHistorySidebar(sidebar: HTMLElement | null): void {
  currentHistorySidebar = sidebar;
}

export interface FullscreenModeDeps {
  /** 从历史会话创建聊天框 */
  createChatBoxFromHistory: (session: HistorySession) => void;
  /** 设置当前会话状态（供 resumeSession 使用） */
  setSessionState: (state: {
    sessionId: string;
    sessionType: HistorySession['type'];
    selectedText: string;
    messages: HistorySession['messages'];
    sessionSaved: boolean;
  }) => void;
}

let deps: FullscreenModeDeps | null = null;

export function setFullscreenModeDeps(d: FullscreenModeDeps): void {
  deps = d;
}

/**
 * 切换全屏模式
 */
export function toggleFullscreen(box: HTMLElement, header: HTMLElement): void {
  isFullscreen = !isFullscreen;

  if (isFullscreen) {
    box.classList.add('fullscreen');
    const fullscreenBtn = header.querySelector('.select-ask-fullscreen-btn');
    if (fullscreenBtn) {
      fullscreenBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"></path>
        </svg>
      `;
      (fullscreenBtn as HTMLElement).title = '退出全屏';
    }

    const mainContent = document.createElement('div');
    mainContent.className = 'select-ask-fullscreen-main';

    const historyPanel = document.createElement('div');
    historyPanel.className = 'select-ask-fullscreen-history';
    historyPanel.innerHTML = `
      <div class="select-ask-fullscreen-history-header">
        <h3>历史记录</h3>
        <button class="select-ask-clear-history-btn" title="清空全部记录">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
          清空
        </button>
      </div>
      <div class="select-ask-fullscreen-history-list">
        <div class="select-ask-fullscreen-history-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          <p>加载中...</p>
        </div>
      </div>
    `;

    const rightContent = document.createElement('div');
    rightContent.className = 'select-ask-fullscreen-content';

    const chatContainer = box.querySelector('.select-ask-chat-container');
    const inputArea = box.querySelector('.select-ask-input-area');
    if (chatContainer) rightContent.appendChild(chatContainer);
    if (inputArea) rightContent.appendChild(inputArea);

    mainContent.appendChild(historyPanel);
    mainContent.appendChild(rightContent);
    box.appendChild(mainContent);

    loadFullscreenHistoryData(historyPanel, box);
  } else {
    box.classList.remove('fullscreen');
    const fullscreenBtn = header.querySelector('.select-ask-fullscreen-btn');
    if (fullscreenBtn) {
      fullscreenBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
        </svg>
      `;
      (fullscreenBtn as HTMLElement).title = '全屏';
    }

    const mainContent = box.querySelector('.select-ask-fullscreen-main');
    const rightContent = box.querySelector('.select-ask-fullscreen-content');
    const chatContainer = rightContent?.querySelector('.select-ask-chat-container');
    const inputArea = rightContent?.querySelector('.select-ask-input-area');

    if (chatContainer) box.appendChild(chatContainer);
    if (inputArea) box.appendChild(inputArea);

    if (mainContent) mainContent.remove();
  }
}

/**
 * 异步加载全屏历史记录数据
 */
export async function loadFullscreenHistoryData(
  historyPanel: HTMLElement,
  box: HTMLElement
): Promise<void> {
  const sessions = await getHistory();

  const clearBtn = historyPanel.querySelector('.select-ask-clear-history-btn');
  clearBtn?.addEventListener('click', async () => {
    if (confirm('确定要清空所有历史记录吗？此操作不可撤销。')) {
      const { clearHistory } = await import('../../utils/history-manager');
      await clearHistory();
      const listEl = historyPanel.querySelector('.select-ask-fullscreen-history-list');
      if (listEl) {
        listEl.innerHTML = `
          <div class="select-ask-fullscreen-history-empty">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            <p>暂无历史记录</p>
          </div>
        `;
      }
      showToast('历史记录已清空', 'success');
    }
  });

  const listEl = historyPanel.querySelector('.select-ask-fullscreen-history-list');
  if (!listEl) return;

  if (sessions.length === 0) {
    listEl.innerHTML = `
      <div class="select-ask-fullscreen-history-empty">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
        <p>暂无历史记录</p>
      </div>
    `;
    return;
  }

  listEl.innerHTML = '';
  sessions.slice(0, 20).forEach(session => {
    const firstMessageTime = session.messages.length > 0 ? session.messages[0].timestamp : session.createdAt;
    const firstMessageContent = session.messages.length > 0 ? session.messages[0].content : session.title;

    const maxContentLength = 50;
    const displayContent = firstMessageContent.length > maxContentLength
      ? firstMessageContent.substring(0, maxContentLength) + '...'
      : firstMessageContent;

    const item = document.createElement('div');
    item.className = 'select-ask-fullscreen-history-item';
    item.innerHTML = `
      <div class="select-ask-fullscreen-history-item-header">
        <span class="select-ask-fullscreen-history-item-time">${formatAbsoluteTime(firstMessageTime)}</span>
      </div>
      <div class="select-ask-fullscreen-history-item-content">${escapeHtml(displayContent)}</div>
    `;
    item.addEventListener('click', () => {
      deps?.createChatBoxFromHistory?.(session);
    });
    listEl.appendChild(item);
  });

  if (sessions.length > 20) {
    const moreInfo = document.createElement('div');
    moreInfo.className = 'select-ask-fullscreen-history-more';
    moreInfo.textContent = `还有 ${sessions.length - 20} 条记录`;
    listEl.appendChild(moreInfo);
  }
}

/**
 * 设置全屏按钮事件
 */
export function setupFullscreenButton(header: HTMLElement, box: HTMLElement): void {
  const fullscreenBtn = header.querySelector('.select-ask-fullscreen-btn');
  if (!fullscreenBtn) return;

  fullscreenBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleFullscreen(box, header);
  });
}

/**
 * 恢复历史会话
 */
async function resumeSession(session: HistorySession, box: HTMLElement): Promise<void> {
  deps?.setSessionState({
    sessionId: session.id,
    sessionType: session.type,
    selectedText: session.selectedText,
    messages: [...session.messages],
    sessionSaved: true,
  });

  const chatContainer = box.querySelector('.select-ask-chat-container') as HTMLElement;
  if (!chatContainer) return;

  chatContainer.innerHTML = '';

  for (const msg of session.messages) {
    const messageEl = document.createElement('div');
    messageEl.className = `select-ask-message select-ask-message-${msg.role}`;

    const avatar = msg.role === 'user'
      ? '<div class="select-ask-message-avatar select-ask-avatar-user">我</div>'
      : `<div class="select-ask-message-avatar select-ask-avatar-ai"><img src="${chrome.runtime.getURL('public/icons/icon48.png')}" alt="AI" /></div>`;

    messageEl.innerHTML = `
      ${avatar}
      <div class="select-ask-message-content">
        <div class="select-ask-message-body">
          <div class="select-ask-message-text">${msg.role === 'user' ? escapeHtml(msg.content) : ''}</div>
        </div>
      </div>
    `;

    if (msg.role === 'user') {
      chatContainer.appendChild(messageEl);
    } else {
      const contentEl = messageEl.querySelector('.select-ask-message-text');
      if (contentEl) {
        contentEl.innerHTML = renderMarkdown(msg.content);
      }
      chatContainer.appendChild(messageEl);
    }
  }

  chatContainer.scrollTop = chatContainer.scrollHeight;

  showToast('已恢复历史对话', 'info');
}

/**
 * 显示历史记录侧边栏
 */
export async function showHistoryPanel(box: HTMLElement, triggerBtn: HTMLElement): Promise<void> {
  if (currentHistorySidebar) {
    currentHistorySidebar.remove();
    currentHistorySidebar = null;
    return;
  }

  const sessions = await getHistory();

  const sidebar = document.createElement('div');
  sidebar.className = 'select-ask-history-sidebar';
  currentHistorySidebar = sidebar;

  const typeNames: Record<string, string> = {
    explain: '解释',
    translate: '翻译',
    question: '问答',
    custom: '自定义',
  };

  sidebar.innerHTML = `
    <div class="select-ask-history-sidebar-header">
      <h3>历史记录</h3>
      <button class="select-ask-history-sidebar-close">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
    <div class="select-ask-history-sidebar-list">
      ${sessions.length === 0 ? `
        <div class="select-ask-history-sidebar-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          <p>暂无历史记录</p>
        </div>
      ` : ''}
    </div>
  `;

  const closeBtn = sidebar.querySelector('.select-ask-history-sidebar-close');
  closeBtn?.addEventListener('click', () => {
    sidebar.remove();
    currentHistorySidebar = null;
  });

  const listContainer = sidebar.querySelector('.select-ask-history-sidebar-list');
  if (listContainer && sessions.length > 0) {
    sessions.forEach((session) => {
      const item = document.createElement('div');
      item.className = 'select-ask-history-sidebar-item';

      item.innerHTML = `
        <div class="select-ask-history-sidebar-item-header">
          <span class="select-ask-history-sidebar-item-type">${typeNames[session.type] || session.type}</span>
          <span class="select-ask-history-sidebar-item-time">${formatHistoryTime(session.updatedAt)}</span>
        </div>
        <div class="select-ask-history-sidebar-item-title">${escapeHtml(session.title)}</div>
        <div class="select-ask-history-sidebar-item-model">${session.modelName}</div>
      `;

      item.addEventListener('click', () => {
        resumeSession(session, box);
        sidebar.remove();
        currentHistorySidebar = null;
      });

      listContainer.appendChild(item);
    });
  }

  document.body.appendChild(sidebar);

  sidebar.addEventListener('click', (e) => {
    if (e.target === sidebar) {
      sidebar.remove();
      currentHistorySidebar = null;
    }
  });
}
