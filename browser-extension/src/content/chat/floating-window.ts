/**
 * 悬浮翻译窗口 — 双栏布局
 * 左侧原文，右侧译文。原文自动识别语言，可手动调整；译文默认转系统语言，可调整。支持快速复制译文。
 */

import { marked } from 'marked';
import { escapeHtml } from '../../utils/shared';
import { TARGET_LANGUAGES } from '../../types/config';

const WINDOW_Z_INDEX = 2147483646;
const FLOAT_PADDING = 12;

/** 语言代码 → 显示标签的映射（auto 始终显示"智能"） */
function getLangLabel(code: string): string {
  if (code === 'auto') return '智能';
  const lang = TARGET_LANGUAGES.find(l => l.code === code);
  return lang ? lang.label : code;
}

/** 基于 navigator.language 推断系统语言（用于译文默认目标） */
function detectSystemLanguage(): string {
  const browserLang = navigator.language || 'zh-CN';
  const code = browserLang.toLowerCase().split('-')[0];
  // 中文系统默认翻成英文，其他默认翻成中文
  return code === 'zh' ? 'en' : 'zh';
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
  const systemLang = detectSystemLanguage();
  let sourceLang = 'auto';   // 原文语言（auto=智能识别）
  let targetLang = options?.initialTargetLanguage || systemLang;
  let fullContent = '';
  let isDestroyed = false;

  const windowEl = document.createElement('div');
  windowEl.className = 'select-ask-float-window';
  windowEl.style.zIndex = String(WINDOW_Z_INDEX);

  // 构建语言选项 HTML（供两个下拉菜单复用）
  const sourceLangOptions = `
    <button class="select-ask-float-lang-option${sourceLang === 'auto' ? ' active' : ''}" value="auto">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        <polyline points="21 3 21 9 15 9"/>
      </svg>
      <span>智能识别</span>
    </button>
    ${TARGET_LANGUAGES.map(lang => `
      <button class="select-ask-float-lang-option${lang.code === sourceLang ? ' active' : ''}" value="${lang.code}">
        <span>${lang.label}</span>
      </button>
    `).join('')}
  `;

  const targetLangOptions = `
    <button class="select-ask-float-lang-option${targetLang === 'auto' ? ' active' : ''}" value="auto">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        <polyline points="21 3 21 9 15 9"/>
      </svg>
      <span>智能识别</span>
    </button>
    ${TARGET_LANGUAGES.map(lang => `
      <button class="select-ask-float-lang-option${lang.code === targetLang ? ' active' : ''}" value="${lang.code}">
        <span>${lang.label}</span>
      </button>
    `).join('')}
  `;

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
        <!-- 原文语言选择 -->
        <button class="select-ask-float-lang-btn" data-lang-panel="source" title="原文语言">
          <span class="select-ask-float-lang-label">${getLangLabel(sourceLang)}</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m6 9 6 6 6-6"/>
          </svg>
        </button>
        <span class="select-ask-float-arrow">→</span>
        <!-- 译文语言选择 -->
        <button class="select-ask-float-lang-btn" data-lang-panel="target" title="译文语言">
          <span class="select-ask-float-lang-label">${getLangLabel(targetLang)}</span>
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
    <div class="select-ask-float-body-split">
      <!-- 左侧：原文面板 -->
      <div class="select-ask-float-panel select-ask-float-panel-source">
        <div class="select-ask-float-panel-label">原文</div>
        <div class="select-ask-float-panel-content select-ask-float-source-text"></div>
        <div class="select-ask-float-source-streaming-cursor"></div>
      </div>
      <!-- 右侧：译文面板 -->
      <div class="select-ask-float-panel select-ask-float-panel-target">
        <div class="select-ask-float-panel-header">
          <span class="select-ask-float-panel-label">译文</span>
          <button class="select-ask-float-copy-btn" title="复制译文">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
            </svg>
          </button>
        </div>
        <div class="select-ask-float-panel-content select-ask-float-target-text"></div>
        <div class="select-ask-float-target-streaming-cursor"></div>
      </div>
    </div>
    <!-- 原文语言下拉菜单 -->
    <div class="select-ask-float-lang-dropdown select-ask-float-lang-dropdown-source">
      ${sourceLangOptions}
    </div>
    <!-- 译文语言下拉菜单 -->
    <div class="select-ask-float-lang-dropdown select-ask-float-lang-dropdown-target">
      ${targetLangOptions}
    </div>
    <!-- 加载中状态 -->
    <div class="select-ask-float-loading-overlay" style="display:none;">
      <div class="select-ask-float-loading-dots">
        <span></span><span></span><span></span>
      </div>
    </div>
  `;

  // --- Element references ---
  const sourceTextEl = windowEl.querySelector('.select-ask-float-source-text') as HTMLElement;
  const targetTextEl = windowEl.querySelector('.select-ask-float-target-text') as HTMLElement;
  const sourceLangBtn = windowEl.querySelector('[data-lang-panel="source"]') as HTMLButtonElement;
  const targetLangBtn = windowEl.querySelector('[data-lang-panel="target"]') as HTMLButtonElement;
  const sourceDropdown = windowEl.querySelector('.select-ask-float-lang-dropdown-source') as HTMLElement;
  const targetDropdown = windowEl.querySelector('.select-ask-float-lang-dropdown-target') as HTMLElement;
  const copyBtn = windowEl.querySelector('.select-ask-float-copy-btn') as HTMLButtonElement;
  const loadingOverlay = windowEl.querySelector('.select-ask-float-loading-overlay') as HTMLElement;

  const sourceLangLabel = sourceLangBtn.querySelector('.select-ask-float-lang-label') as HTMLElement;
  const targetLangLabel = targetLangBtn.querySelector('.select-ask-float-lang-label') as HTMLElement;

  // --- Dropdown open/close ---
  function openDropdown(dropdown: HTMLElement, triggerBtn: HTMLButtonElement) {
    // 先关闭其他下拉
    [sourceDropdown, targetDropdown].forEach(dd => {
      if (dd !== dropdown) dd.classList.remove('open');
    });

    // 将下拉菜单移到 body，使用 fixed 定位避免被窗口 overflow:hidden 裁剪
    if (dropdown.parentElement !== document.body) {
      dropdown.style.position = 'fixed';
      document.body.appendChild(dropdown);
    }

    const btnRect = triggerBtn.getBoundingClientRect();
    const dropdownHeight = 280;
    const spaceBelow = window.innerHeight - btnRect.bottom;
    const shouldShowAbove = spaceBelow < dropdownHeight;

    if (shouldShowAbove) {
      dropdown.style.top = `${btnRect.top - 4}px`;
      dropdown.style.bottom = 'auto';
      dropdown.style.transform = 'translateY(-100%)';
    } else {
      dropdown.style.top = `${btnRect.bottom + 4}px`;
      dropdown.style.bottom = 'auto';
      dropdown.style.transform = 'none';
    }
    dropdown.style.left = `${btnRect.left}px`;
    dropdown.style.right = 'auto';

    dropdown.classList.add('open');
  }

  function closeAllDropdowns() {
    sourceDropdown.classList.remove('open');
    targetDropdown.classList.remove('open');
  }

  sourceLangBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openDropdown(sourceDropdown, sourceLangBtn);
  });

  targetLangBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openDropdown(targetDropdown, targetLangBtn);
  });

  // --- Language option click (delegate) ---
  function handleLangOptionClick(dropdown: HTMLElement, isSource: boolean) {
    dropdown.addEventListener('click', (e) => {
      const option = (e.target as HTMLElement).closest('.select-ask-float-lang-option') as HTMLButtonElement;
      if (!option) return;

      const newLang = option.value;
      if (isSource) {
        sourceLang = newLang;
        sourceLangLabel.textContent = getLangLabel(newLang);
      } else {
        targetLang = newLang;
        targetLangLabel.textContent = getLangLabel(newLang);
      }

      // 更新 active
      dropdown.querySelectorAll('.select-ask-float-lang-option').forEach(btn => {
        btn.classList.toggle('active', (btn as HTMLButtonElement).value === newLang);
      });

      closeAllDropdowns();

      if (options?.onLanguageChange && options?.originalText) {
        options.onLanguageChange(isSource ? sourceLang : targetLang);
      }
    });
  }

  handleLangOptionClick(sourceDropdown, true);
  handleLangOptionClick(targetDropdown, false);

  document.addEventListener('click', closeAllDropdowns);

  // --- Copy button ---
  copyBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(fullContent);
      copyBtn.classList.add('success');
      copyBtn.title = '已复制';
      setTimeout(() => {
        copyBtn.classList.remove('success');
        copyBtn.title = '复制译文';
      }, 1500);
    } catch { /* ignore */ }
  });

  // 设置原文内容
  if (options?.originalText) {
    sourceTextEl.textContent = options.originalText;
  }

  // --- Positioning ---
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

  // --- Drag ---
  const headerEl = windowEl.querySelector('.select-ask-float-header') as HTMLElement;
  let isDragging = false;
  let dragStartX = 0, dragStartY = 0, dragStartLeft = 0, dragStartTop = 0;

  function onDragStart(e: MouseEvent) {
    if ((e.target as HTMLElement).closest('.select-ask-float-lang-btn, .select-ask-float-close, .select-ask-float-lang-option, .select-ask-float-copy-btn')) return;
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

  // --- Close ---
  const closeBtn = windowEl.querySelector('.select-ask-float-close') as HTMLButtonElement;
  closeBtn.addEventListener('click', () => {
    if (isDestroyed) return;
    destroy();
    options?.onClose?.();
  });

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

  // --- Public methods ---
  function setContent(text: string) {
    fullContent = text;
    targetTextEl.innerHTML = marked.parse(text) as string;
  }

  function appendContent(chunk: string) {
    fullContent += chunk;
    targetTextEl.innerHTML = marked.parse(fullContent) as string;
    const contentEl = windowEl.querySelector('.select-ask-float-panel-target') as HTMLElement;
    contentEl.scrollTop = contentEl.scrollHeight;
  }

  function setStreaming(streaming: boolean) {
    const sourceCursor = windowEl.querySelector('.select-ask-float-source-streaming-cursor') as HTMLElement;
    const targetCursor = windowEl.querySelector('.select-ask-float-target-streaming-cursor') as HTMLElement;
    if (sourceCursor) sourceCursor.style.display = streaming ? 'inline' : 'none';
    if (targetCursor) targetCursor.style.display = streaming ? 'inline' : 'none';
  }

  function setError(error: string) {
    targetTextEl.innerHTML = `<span class="select-ask-float-error">${escapeHtml(error)}</span>`;
    setStreaming(false);
    loadingOverlay.style.display = 'none';
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
    targetLang = lang;
    targetLangLabel.textContent = getLangLabel(lang);
    targetDropdown.querySelectorAll('.select-ask-float-lang-option').forEach(btn => {
      btn.classList.toggle('active', (btn as HTMLButtonElement).value === lang);
    });
  }

  function destroy() {
    if (isDestroyed) return;
    isDestroyed = true;
    document.removeEventListener('mousedown', onClickOutside);
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', onDragEnd);
    document.removeEventListener('click', closeAllDropdowns);
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
