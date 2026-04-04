/**
 * 行内翻译 DOM 操作工具函数
 * 负责查找段落容器、创建译文元素、插入译文到页面
 */

/**
 * 查找选中文本所在的语义段落容器
 * 优先查找语义化标签（P、LI、TD 等），其次查找块级元素
 */
export function findParagraphContainer(range: Range): HTMLElement {
  // 获取选区的共同祖先节点
  let container = range.commonAncestorContainer as HTMLElement;

  // 如果共同祖先是文本节点，取其父元素
  if (container.nodeType === Node.TEXT_NODE) {
    container = container.parentElement as HTMLElement;
  }

  // 语义化段落标签优先级最高
  const semanticTags = ['P', 'LI', 'TD', 'TH', 'BLOCKQUOTE', 'FIGCAPTION', 'CAPTION'];
  let node: HTMLElement | null = container;

  while (node && node !== document.body) {
    // 检查是否是语义化标签
    if (semanticTags.includes(node.tagName)) {
      return node;
    }

    // 检查是否是块级元素
    const display = window.getComputedStyle(node).display;
    if (['block', 'list-item', 'table-cell', 'flex', 'grid'].includes(display)) {
      // 排除容器型元素（太大会影响布局），除非只有一个子元素
      if (!['DIV', 'SECTION', 'ARTICLE', 'MAIN'].includes(node.tagName) ||
          node.childElementCount <= 1) {
        return node;
      }
    }
    node = node.parentElement;
  }

  // 兜底：返回共同祖先
  return container;
}

/**
 * 生成译文唯一 ID
 * 使用时间戳 + 文本哈希确保唯一性
 */
export function generateTranslationId(text: string): string {
  // 简单哈希算法
  let hash = 0;
  for (let i = 0; i < Math.min(text.length, 100); i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `translation-${Date.now()}-${Math.abs(hash)}`;
}

/**
 * 创建译文容器元素
 */
export function createTranslationElement(id: string): HTMLElement {
  const translationEl = document.createElement('div');
  translationEl.id = id;
  translationEl.className = 'select-ask-translation';

  // 创建基本结构
  translationEl.innerHTML = `
    <div class="select-ask-translation-header">
      <span class="select-ask-translation-badge">翻译</span>
      <div class="select-ask-translation-actions">
        <button class="select-ask-translation-close" title="关闭翻译 (×)">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    </div>
    <div class="select-ask-translation-content">
      <span class="select-ask-translation-streaming"></span>
    </div>
  `;

  return translationEl;
}

/**
 * 在指定段落元素后插入译文容器
 * 如果已存在该 ID 的元素，直接返回
 */
export function insertTranslationAfter(
  paragraph: HTMLElement,
  translationId: string
): HTMLElement {
  // 检查是否已存在
  const existing = document.getElementById(translationId);
  if (existing) {
    return existing;
  }

  const translationEl = createTranslationElement(translationId);

  // 存储关联关系
  translationEl.dataset.translationFor = paragraph.tagName.toLowerCase();
  translationEl.dataset.sourceElement = paragraph.tagName.toLowerCase();

  // 插入到段落之后
  if (paragraph.nextSibling) {
    paragraph.parentNode?.insertBefore(translationEl, paragraph.nextSibling);
  } else {
    paragraph.parentNode?.appendChild(translationEl);
  }

  return translationEl;
}

/**
 * 安全地移除译文元素（带淡出动画）
 */
export function removeTranslation(translationEl: HTMLElement): void {
  if (!translationEl) return;

  // 添加淡出效果
  translationEl.style.transition = 'all 0.3s ease';
  translationEl.style.opacity = '0';
  translationEl.style.transform = 'translateY(-8px)';

  // 等待动画完成后移除
  setTimeout(() => {
    translationEl.remove();
  }, 300);
}
