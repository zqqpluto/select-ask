/**
 * 行内翻译交互处理
 * 处理关闭按钮、双击原文、ESC 键等交互操作
 */

import { TranslationManager } from './translation-manager';
import { removeTranslation } from './translation-dom';

/**
 * 设置译文元素的交互事件
 */
export function setupTranslationInteraction(
  translationEl: HTMLElement,
  entryId: string
): void {
  // 关闭按钮点击事件
  const closeBtn = translationEl.querySelector('.select-ask-translation-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeTranslation(entryId);
    });
  }
}

/**
 * 为原文段落设置交互事件（双击关闭等）
 */
export function setupSourceElementInteraction(
  paragraph: HTMLElement,
  translationId: string
): void {
  // 检查是否已经设置过
  if (paragraph.dataset.hasTranslationInteraction === 'true') {
    return;
  }

  // 双击原文关闭译文
  paragraph.addEventListener('dblclick', () => {
    const entry = TranslationManager.get(translationId);
    if (entry && entry.isVisible) {
      closeTranslation(translationId);
    }
  });

  // 标记已设置
  paragraph.dataset.hasTranslationInteraction = 'true';
}

/**
 * 关闭单个译文
 */
export function closeTranslation(id: string): void {
  const entry = TranslationManager.get(id);
  if (!entry) return;

  // 移除关联标记
  if (entry.sourceElement.dataset.hasTranslationInteraction === 'true') {
    entry.sourceElement.dataset.hasTranslationInteraction = 'false';
  }

  // 淡出并移除
  removeTranslation(entry.translationElement);

  // 从管理器中移除
  TranslationManager.remove(id);
}

/**
 * 关闭离指定元素最近的译文
 */
export function closeNearestTranslation(targetElement: HTMLElement): void {
  // 向上查找最近的有译文的段落
  let element: HTMLElement | null = targetElement;
  while (element && element !== document.body) {
    const translations = document.querySelectorAll(
      `.select-ask-translation[data-source-element="${element.tagName.toLowerCase()}"]`
    );
    if (translations.length > 0) {
      // 找到译文，关闭最后一个
      const lastTranslation = translations[translations.length - 1] as HTMLElement;
      const id = lastTranslation.id;
      closeTranslation(id);
      return;
    }
    element = element.parentElement;
  }
}

/**
 * 设置全局 ESC 键关闭监听
 */
export function setupGlobalEscListener(): void {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const visibleTranslations = TranslationManager.getVisibleTranslations();
      if (visibleTranslations.length > 0) {
        // 关闭最后一个可见的译文
        const lastEntry = visibleTranslations[visibleTranslations.length - 1];
        closeTranslation(lastEntry.id);
      }
    }
  });
}

/**
 * 初始化全局交互监听
 */
export function initGlobalInteractions(): void {
  // 设置 ESC 键监听（只设置一次）
  let escListenerInitialized = false;
  if (!escListenerInitialized) {
    setupGlobalEscListener();
    escListenerInitialized = true;
  }
}
