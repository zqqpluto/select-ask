/**
 * 悬浮翻译窗口
 * 选中文本后点击翻译，在选区附近显示悬浮窗口
 */

import { marked } from 'marked';
import { TARGET_LANGUAGES } from '../types/config';

const WINDOW_Z_INDEX = 2147483646;
const FLOAT_PADDING = 12;

/** 获取语言标签显示文本 */
function getLangLabel(code: string): string {
  if (code === 'auto') return '智能';
  const lang = TARGET_LANGUAGES.find(l => l.code === code);
  return lang ? lang.label : code;
}

export interface FloatingTranslationWindow {
  element: HTMLElement;
  setContent(text: string): void;
  appendContent(chunk: string): void;
  setStreaming(isStreaming: boolean): void;
  setError(error: string): void;
  destroy(): void;
  show(): void;
  hide(): void;
  reposition(): void;
  setTargetLanguage(lang: string): void;
  onLanguageChange?: (newLang: string) => void;
  onClose?: () => void;
}

export function createFloatingTranslationWindow(
  range: Range,
  options?: {
    initialTargetLanguage?: string;
    originalText?: string;
    onLanguageChange?: (lang: string) => void;
    onClose?: () => void;
  }
): FloatingTranslationWindow {
  let currentLang = options?.initialTargetLanguage || 'en';
  let fullContent = '';
  let isStreaming = false;
  let isDestroyed = false;

  const windowEl = document.createElement('div');
  windowEl.className = 'select-ask-float-window';
  windowEl.style.zIndex = String(WINDOW_Z_INDEX);

  windowEl.innerHTML = `
    <div class="select-ask-float-header">
      <div class="select-ask-float-header-left">
        <div class="select-ask-float-icon-wrap">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 8l6 6"/>
            <path d="M4 14l6-6 2-3"/>
            <path d="M2 5h12"/>
            <path d="M7 2h1"/>
            <path d="M22 22l-5-10-5 10"/>
            <path d="M14 18h6"/>
          </svg>
        </div>
        <span class="select-ask-float-title">翻译</span>
      </div>
      <div class="select-ask-float-header-right">
        <button class="select-ask-float-lang-btn" title="目标语言">
          <span class="select-ask-float-lang-label">${getLangLabel(currentLang)}</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m6 9 6 6 6-6"/>
          </svg>
        </button>
        <button class="select-ask-float-close" title="关闭">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 6 6 18"/>
            <path d="m6 6 12 12"/>
          </svg>
        </button>
      </div>
    </div>
    <div class="select-ask-float-content">
      <div class="select-ask-float-body"></div>
      <div class="select-ask-float-streaming-cursor"></div>
    </div>
    <div class="select-ask-float-actions">
      <button class="select-ask-float-action-btn" data-action="copy">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
          <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
        </svg>
        <span>复制</span>
      </button>
    </div>
    <div class="select-ask-float-lang-dropdown">
      <button class="select-ask-float-lang-option" value="auto">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          <polyline points="21 3 21 9 15 9"/>
        </svg>
        <span>智能识别</span>
      </button>
      ${TARGET_LANGUAGES.map(lang => `
        <button class="select-ask-float-lang-option${lang.code === currentLang ? ' active' : ''}" value="${lang.code}">
          <span>${lang.label}</span>
        </button>
      `).join('')}
    </div>
  `;

  const bodyEl = windowEl.querySelector('.select-ask-float-body') as HTMLElement;
  const cursorEl = windowEl.querySelector('.select-ask-float-streaming-cursor') as HTMLElement;
  const langBtn = windowEl.querySelector('.select-ask-float-lang-btn') as HTMLButtonElement;
  const langDropdown = windowEl.querySelector('.select-ask-float-lang-dropdown') as HTMLElement;
  const langLabel = windowEl.querySelector('.select-ask-float-lang-label') as HTMLElement;

  // 语言按钮：点击显示/隐藏下拉菜单
  langBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    // 智能定位：如果下方空间不足，在上方显示
    const dropdownRect = langDropdown.getBoundingClientRect();
    const btnRect = langBtn.getBoundingClientRect();
    const spaceBelow = window.innerHeight - btnRect.bottom;
    const dropdownHeight = dropdownRect.height || 280; // 默认估算高度
    const shouldShowAbove = spaceBelow < dropdownHeight;

    if (shouldShowAbove) {
      langDropdown.style.top = 'auto';
      langDropdown.style.bottom = '100%';
      langDropdown.style.transform = 'translateY(-4px)';
    } else {
      langDropdown.style.top = '100%';
      langDropdown.style.bottom = 'auto';
      langDropdown.style.transform = 'translateY(4px)';
    }

    langDropdown.classList.toggle('open');
  });

  // 语言选项点击
  langDropdown.addEventListener('click', (e) => {
    const option = (e.target as HTMLElement).closest('.select-ask-float-lang-option') as HTMLButtonElement;
    if (!option) return;

    currentLang = option.value;
    langLabel.textContent = getLangLabel(currentLang);
    langDropdown.classList.remove('open');

    // 更新 active 状态
    langDropdown.querySelectorAll('.select-ask-float-lang-option').forEach(btn => {
      btn.classList.toggle('active', (btn as HTMLButtonElement).value === currentLang);
    });

    if (options?.onLanguageChange && options?.originalText) {
      options.onLanguageChange(currentLang);
    }
  });

  // 点击外部关闭下拉菜单
  const closeDropdownHandler = () => {
    langDropdown.classList.remove('open');
  };
  document.addEventListener('click', closeDropdownHandler);

  // 复制按钮
  const copyBtn = windowEl.querySelector('[data-action="copy"]') as HTMLButtonElement;
  copyBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(fullContent);
      const originalText = copyBtn.querySelector('span')!.textContent;
      copyBtn.querySelector('span')!.textContent = '已复制';
      copyBtn.classList.add('success');
      setTimeout(() => {
        copyBtn.querySelector('span')!.textContent = originalText;
        copyBtn.classList.remove('success');
      }, 1500);
    } catch { /* ignore */ }
  });

  function positionWindow() {
    const rect = range.getBoundingClientRect();
    const winRect = windowEl.getBoundingClientRect();

    let left = rect.left + (rect.width / 2) - (winRect.width / 2);
    let top = rect.top - winRect.height - FLOAT_PADDING;

    if (left < FLOAT_PADDING) left = FLOAT_PADDING;
    if (left + winRect.width > window.innerWidth - FLOAT_PADDING) {
      left = window.innerWidth - winRect.width - FLOAT_PADDING;
    }
    if (top < FLOAT_PADDING) {
      top = rect.bottom + FLOAT_PADDING;
    }
    if (top + winRect.height > window.innerHeight - FLOAT_PADDING) {
      top = window.innerHeight - winRect.height - FLOAT_PADDING;
    }

    windowEl.style.left = `${left}px`;
    windowEl.style.top = `${top}px`;
  }

  windowEl.style.position = 'fixed';
  windowEl.style.left = '0px';
  windowEl.style.top = '0px';
  windowEl.style.display = 'none';
  document.body.appendChild(windowEl);
  positionWindow();

  // 拖拽
  const headerEl = windowEl.querySelector('.select-ask-float-header') as HTMLElement;
  let isDragging = false;
  let dragStartX = 0, dragStartY = 0, dragStartLeft = 0, dragStartTop = 0;

  function onDragStart(e: MouseEvent) {
    if ((e.target as HTMLElement).closest('.select-ask-float-lang-btn, .select-ask-float-close, .select-ask-float-lang-option, .select-ask-float-action-btn')) return;
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragStartLeft = windowEl.offsetLeft;
    dragStartTop = windowEl.offsetTop;
    windowEl.style.transition = 'none';
    e.preventDefault();
  }

  function onDragMove(e: MouseEvent) {
    if (!isDragging) return;
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    let newLeft = dragStartLeft + dx;
    let newTop = dragStartTop + dy;
    const maxLeft = window.innerWidth - windowEl.offsetWidth - FLOAT_PADDING;
    const maxTop = window.innerHeight - windowEl.offsetHeight - FLOAT_PADDING;
    newLeft = Math.max(FLOAT_PADDING, Math.min(newLeft, maxLeft));
    newTop = Math.max(FLOAT_PADDING, Math.min(newTop, maxTop));
    windowEl.style.left = `${newLeft}px`;
    windowEl.style.top = `${newTop}px`;
  }

  function onDragEnd() {
    isDragging = false;
    windowEl.style.transition = '';
  }

  headerEl.addEventListener('mousedown', onDragStart);
  document.addEventListener('mousemove', onDragMove);
  document.addEventListener('mouseup', onDragEnd);

  // 关闭
  const closeBtn = windowEl.querySelector('.select-ask-float-close') as HTMLButtonElement;
  closeBtn.addEventListener('click', () => {
    if (isDestroyed) return;
    destroy();
    options?.onClose?.();
  });

  // 点击外部关闭
  function onClickOutside(e: MouseEvent) {
    if (isDestroyed) return;
    if (!(e.target as HTMLElement).closest('.select-ask-float-window')) {
      destroy();
      options?.onClose?.();
    }
  }
  setTimeout(() => {
    document.addEventListener('mousedown', onClickOutside);
  }, 100);

  function setContent(text: string) {
    fullContent = text;
    bodyEl.innerHTML = marked.parse(text) as string;
  }

  function appendContent(chunk: string) {
    fullContent += chunk;
    bodyEl.innerHTML = marked.parse(fullContent) as string;
    const contentEl = windowEl.querySelector('.select-ask-float-content') as HTMLElement;
    contentEl.scrollTop = contentEl.scrollHeight;
  }

  function setStreaming(streaming: boolean) {
    isStreaming = streaming;
    cursorEl.style.display = streaming ? 'inline' : 'none';
  }

  function setError(error: string) {
    bodyEl.innerHTML = `<span class="select-ask-float-error">${escapeHtml(error)}</span>`;
    setStreaming(false);
  }

  function show() {
    windowEl.style.display = 'block';
    windowEl.style.animation = 'selectAskFloatIn 0.2s ease-out';
  }

  function hide() {
    windowEl.style.display = 'none';
  }

  function reposition() {
    positionWindow();
  }

  function setTargetLanguage(lang: string) {
    currentLang = lang;
    langLabel.textContent = getLangLabel(lang);
    langDropdown.querySelectorAll('.select-ask-float-lang-option').forEach(btn => {
      btn.classList.toggle('active', (btn as HTMLButtonElement).value === lang);
    });
  }

  function destroy() {
    if (isDestroyed) return;
    isDestroyed = true;
    document.removeEventListener('mousedown', onClickOutside);
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', onDragEnd);
    document.removeEventListener('click', closeDropdownHandler);
    headerEl.removeEventListener('mousedown', onDragStart);
    windowEl.remove();
  }

  return {
    element: windowEl,
    setContent,
    appendContent,
    setStreaming,
    setError,
    destroy,
    show,
    hide,
    reposition,
    setTargetLanguage,
    onLanguageChange: options?.onLanguageChange,
    onClose: options?.onClose,
  };
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
