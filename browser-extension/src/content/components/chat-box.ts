import { getDisplayMode, setDisplayMode } from '../utils/config-manager';
import { openSidebarLayout } from '../utils/layout';
import { showToast } from '../utils/helpers';

/**
 * 创建 AI 头像元素 - 使用项目logo
 */
export function createAIAvatar(): HTMLElement {
  const avatar = document.createElement('div');
  avatar.className = 'select-ask-message-avatar select-ask-avatar-ai';
  const iconUrl = chrome.runtime.getURL('public/icons/icon48.png');
  avatar.innerHTML = `<img src="${iconUrl}" alt="AI" />`;
  return avatar;
}

/**
 * 创建用户头像元素
 */
export function createUserAvatar(): HTMLElement {
  const avatar = document.createElement('div');
  avatar.className = 'select-ask-message-avatar select-ask-avatar-user';
  // 用户头像使用简单的人物图标
  avatar.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
  </svg>`;
  return avatar;
}

/**
 * 创建可拖拽的标题栏
 */
export async function createChatHeader(box: HTMLElement): Promise<HTMLElement> {
  const header = document.createElement('div');
  header.className = 'select-ask-chat-header';

  // 获取当前显示模式
  const currentMode = await getDisplayMode();
  const isSidebar = currentMode === 'sidebar';

  header.innerHTML = `
    <div class="select-ask-chat-header-title">
      <span class="select-ask-chat-header-name">select ask</span>
      <span class="select-ask-chat-header-divider">·</span>
      <span class="select-ask-chat-header-slogan">选中即问，知识自来</span>
    </div>
    <div class="select-ask-chat-header-actions">
      <button class="select-ask-mode-toggle-btn" title="${isSidebar ? '切换为浮动窗口' : '切换为侧边栏'}">
        ${isSidebar ? `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="2" width="20" height="20" rx="2" ry="2"></rect>
          </svg>
        ` : `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="2" width="20" height="20" rx="2" ry="2"></rect>
            <line x1="17" y1="2" x2="17" y2="22"></line>
          </svg>
        `}
      </button>
      <button class="select-ask-fullscreen-btn" title="全屏">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
        </svg>
      </button>
      <button class="select-ask-history-btn" title="历史记录">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
      </button>
      ${isSidebar ? `
      <button class="select-ask-close-btn" title="关闭">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
      ` : ''}
    </div>
  `;

  // 添加模式切换事件
  const modeToggleBtn = header.querySelector('.select-ask-mode-toggle-btn');
  modeToggleBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleDisplayMode(box);
  });

  return header;
}

/**
 * 切换显示模式（浮动窗口 <-> 侧边栏）
 * 使用移动DOM的方式，保持所有事件绑定和流式响应
 */
export async function toggleDisplayMode(box: HTMLElement): Promise<void> {
  // 保存当前聊天内容和输入区域的引用
  const chatContainer = box.querySelector('.select-ask-chat-container') as HTMLElement;
  const inputArea = box.querySelector('.select-ask-input-area') as HTMLElement;

  // 保存当前的滚动位置
  const scrollTop = chatContainer?.scrollTop || 0;

  // 保存新的显示模式
  await setDisplayMode('sidebar');

  // 先将旧容器设置为透明，避免闪烁
  box.style.opacity = '0';
  box.style.transition = 'opacity 0.15s ease-out';

  // 等待过渡完成
  await new Promise(resolve => setTimeout(resolve, 150));

  // 创建侧边栏容器
  const newBox = document.createElement('div');
  newBox.className = 'select-ask-sidebar';
  newBox.style.opacity = '0';

  // 创建新的头部
  const newHeader = await createChatHeader(newBox);
  newBox.appendChild(newHeader);

  // 设置事件
  setupDraggable(newBox, newHeader);

  // 移动聊天内容到新容器
  if (chatContainer) {
    newBox.appendChild(chatContainer);
  }

  // 移动输入区域到新容器
  if (inputArea) {
    newBox.appendChild(inputArea);
  }

  // 使用动态导入避免循环依赖（index.ts 静态导入本模块）
  const { setupHistoryButton, setupFullscreenButton } = await import('../content/index');
  setupHistoryButton(newHeader, newBox);
  setupFullscreenButton(newHeader, newBox);

  // 先添加新容器到 DOM
  document.body.appendChild(newBox);

  // 设置 currentSidebar（从 sidebar.ts 导入）
  const { setCurrentSidebar } = await import('./sidebar');
  setCurrentSidebar(newBox);

  // 调整页面布局，为侧边栏腾出空间
  openSidebarLayout();

  // 移除旧的 box
  box.remove();

  // 淡入新容器
  requestAnimationFrame(() => {
    newBox.style.transition = 'opacity 0.2s ease-out';
    newBox.style.opacity = '1';
    if (chatContainer) {
      chatContainer.scrollTop = scrollTop;
    }
  });

  showToast('已切换到侧边栏模式', 'info');
}

/**
 * 设置拖拽功能（支持整个对话框空白区域拖拽）
 */
export function setupDraggable(box: HTMLElement, header: HTMLElement): void {
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let initialLeft = 0;
  let initialTop = 0;

  const handleMouseDown = (e: MouseEvent) => {
    // 检查是否点击了可交互元素
    const target = e.target as HTMLElement;
    const isInteractive = target.closest(
      'button, input, textarea, a, .select-ask-copy-btn, .select-ask-regenerate-btn'
    );

    if (isInteractive) return;

    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    initialLeft = parseInt(box.style.left) || 0;
    initialTop = parseInt(box.style.top) || 0;
    box.classList.add('dragging');
    header.classList.add('dragging');
    e.preventDefault();
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;

    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;

    box.style.left = `${initialLeft + deltaX}px`;
    box.style.top = `${initialTop + deltaY}px`;
  };

  const handleMouseUp = () => {
    if (isDragging) {
      isDragging = false;
      box.classList.remove('dragging');
      header.classList.remove('dragging');
    }
  };

  // 只在头部绑定 mousedown 事件
  header.addEventListener('mousedown', handleMouseDown);
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);

  // 清理函数存储在 box 上，以便在 box 移除时清理
  const cleanup = () => {
    header.removeEventListener('mousedown', handleMouseDown);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  (box as any)._dragCleanup = cleanup;
}
