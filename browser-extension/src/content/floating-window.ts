/**
 * 悬浮翻译窗口
 * 选中文本后点击翻译，在选区附近显示悬浮窗口
 */

import { marked } from 'marked';
import { TARGET_LANGUAGES } from '../types/config';

const WINDOW_Z_INDEX = 2147483646;
const FLOAT_PADDING = 12;

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
      <span class="select-ask-float-title">翻译</span>
      <select class="select-ask-float-lang-select" title="目标语言">
        <option value="auto">🔄 智能</option>
        ${TARGET_LANGUAGES.map(lang => `<option value="${lang.code}" ${lang.code === currentLang ? 'selected' : ''}>${lang.label}</option>`).join('')}
      </select>
      <button class="select-ask-float-close" title="关闭">&times;</button>
    </div>
    <div class="select-ask-float-content">
      <div class="select-ask-float-body"></div>
      <div class="select-ask-float-streaming-cursor"></div>
    </div>
  `;

  const bodyEl = windowEl.querySelector('.select-ask-float-body') as HTMLElement;
  const cursorEl = windowEl.querySelector('.select-ask-float-streaming-cursor') as HTMLElement;
  const langSelect = windowEl.querySelector('.select-ask-float-lang-select') as HTMLSelectElement;

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
    if ((e.target as HTMLElement).closest('.select-ask-float-lang-select, .select-ask-float-close')) return;
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

  // 语言切换
  langSelect.addEventListener('change', () => {
    currentLang = langSelect.value;
    if (options?.onLanguageChange && options?.originalText) {
      options.onLanguageChange(currentLang);
    }
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
    langSelect.value = lang;
  }

  function destroy() {
    if (isDestroyed) return;
    isDestroyed = true;
    document.removeEventListener('mousedown', onClickOutside);
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', onDragEnd);
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
