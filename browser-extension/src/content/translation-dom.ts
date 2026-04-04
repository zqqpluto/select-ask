/**
 * 行内翻译 DOM 操作工具函数
 * 负责查找段落容器、创建译文元素、插入译文到页面
 */

/**
 * 获取选区跨越的所有段落容器
 * 返回按文档顺序排列的段落元素数组
 * 只获取直接的段落容器，不包含嵌套的子段落
 */
export function getAllParagraphsInRange(range: Range): HTMLElement[] {
  const paragraphs: Map<HTMLElement, number> = new Map(); // 用 Map 记录顺序
  const semanticTags = ['P', 'LI', 'TD', 'TH', 'BLOCKQUOTE', 'FIGCAPTION', 'CAPTION'];

  // 获取选区覆盖的所有元素节点（按文档顺序）
  const elementWalker = document.createTreeWalker(
    range.commonAncestorContainer,
    NodeFilter.SHOW_ELEMENT,
    null
  );

  let node: Node | null = elementWalker.currentNode;
  while (node) {
    const el = node as HTMLElement;

    // 检查元素是否在选区内（通过文本内容判断）
    if (el.textContent?.trim()) {
      // 检查是否是语义化段落标签
      if (semanticTags.includes(el.tagName)) {
        // 检查该元素是否有选中的文本
        if (isElementTextInRange(range, el)) {
          // 只记录，不立即添加（需要检查是否已被父段落包含）
          if (!paragraphs.has(el)) {
            paragraphs.set(el, paragraphs.size);
          }
        }
      }
    }
    node = elementWalker.nextNode();
  }

  // 如果找到了语义化段落，返回它们
  if (paragraphs.size > 0) {
    return Array.from(paragraphs.keys());
  }

  // 兜底：查找块级元素作为段落
  const blockWalker = document.createTreeWalker(
    range.commonAncestorContainer,
    NodeFilter.SHOW_ELEMENT,
    null
  );

  node = blockWalker.currentNode;
  while (node) {
    const el = node as HTMLElement;
    const display = window.getComputedStyle(el).display;

    if (['block', 'list-item', 'table-cell', 'flex', 'grid'].includes(display)) {
      if (el.textContent?.trim() && isElementTextInRange(range, el)) {
        // 排除容器型元素，除非只有一个子元素
        if (!['DIV', 'SECTION', 'ARTICLE', 'MAIN'].includes(el.tagName) ||
            el.childElementCount <= 1) {
          if (!paragraphs.has(el)) {
            paragraphs.set(el, paragraphs.size);
          }
        }
      }
    }
    node = blockWalker.nextNode();
  }

  return Array.from(paragraphs.keys());
}

/**
 * 检查元素内的文本是否在选区范围内
 */
function isElementTextInRange(range: Range, element: HTMLElement): boolean {
  // 简单检查：元素是否与选区有交集
  try {
    const elementRange = document.createRange();
    elementRange.selectNodeContents(element);

    // 检查两个范围是否有重叠
    return !range.compareBoundaryPoints(Range.END_TO_START, elementRange) ||
           !range.compareBoundaryPoints(Range.START_TO_END, elementRange) ||
           range.compareBoundaryPoints(Range.START_TO_START, elementRange) <= 0 &&
           range.compareBoundaryPoints(Range.END_TO_END, elementRange) >= 0;
  } catch {
    return true; // 兜底：假设在范围内
  }
}

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
 * 判断文本长度，决定使用行内模式还是块级模式
 * 短文本（<= 50 字符）使用行内模式，显示在原文右侧
 * 长文本使用块级模式，显示在原文下方
 */
export function shouldUseInlineMode(text: string): boolean {
  return text.length <= 50;
}

/**
 * 创建译文容器元素 - 简洁的沉浸式样式
 * @param id - 唯一标识
 * @param isInline - 是否使用行内模式
 */
export function createTranslationElement(id: string, isInline: boolean): HTMLElement {
  const translationEl = document.createElement('div');
  translationEl.id = id;
  translationEl.className = `select-ask-translation ${isInline ? 'inline' : 'block'}`;

  // 简洁结构：内容 + 关闭按钮
  translationEl.innerHTML = `
    <span class="select-ask-translation-content"><span class="select-ask-translation-streaming"></span></span>
    <button class="select-ask-translation-close" title="关闭">×</button>
  `;

  return translationEl;
}

/**
 * 在指定位置插入译文
 * 短文本：在选中的文本节点后面插入译文
 * 长文本：复制原文标签，插入到原文后面
 */
export function insertTranslation(
  paragraph: HTMLElement,
  translationId: string,
  isInline: boolean,
  originalText: string,
  range?: Range
): { translationEl: HTMLElement; container: HTMLElement; separatorNode?: Text } {
  // 检查是否已存在
  const existing = document.getElementById(translationId);
  if (existing) {
    return { translationEl: existing, container: existing };
  }

  const translationEl = createTranslationElement(translationId, isInline);

  // 存储关联关系
  translationEl.dataset.translationFor = paragraph.tagName.toLowerCase();
  translationEl.dataset.sourceElement = paragraph.tagName.toLowerCase();
  translationEl.dataset.originalText = originalText;

  if (isInline) {
    // 短文本：在选中的文本节点后面插入译文
    const streamingSpan = translationEl.querySelector('.select-ask-translation-streaming');
    if (streamingSpan) {
      streamingSpan.remove();
    }
    const contentEl = translationEl.querySelector('.select-ask-translation-content');
    if (contentEl) {
      contentEl.innerHTML = '<span class="select-ask-translation-streaming"></span>';
    }

    // 在 Range 结束位置的文本节点后插入
    let separatorNode: Text | undefined;
    if (range && !range.collapsed) {
      separatorNode = insertAfterRange(range, translationEl);
    } else {
      // 兜底：直接追加到段落末尾
      paragraph.appendChild(translationEl);
    }

    return { translationEl, container: paragraph, separatorNode };
  } else {
    // 长文本：复制一份标签，插入到原文后面
    const clonedParagraph = paragraph.cloneNode(false) as HTMLElement;
    clonedParagraph.id = translationId + '-clone';
    clonedParagraph.innerHTML = '';
    clonedParagraph.appendChild(translationEl);
    clonedParagraph.classList.add('select-ask-translation-clone');

    if (paragraph.nextSibling) {
      paragraph.parentNode?.insertBefore(clonedParagraph, paragraph.nextSibling);
    } else {
      paragraph.parentNode?.appendChild(clonedParagraph);
    }

    return { translationEl, container: clonedParagraph };
  }
}

/**
 * 在 Range 结束位置后插入元素，返回创建的分隔符节点
 */
function insertAfterRange(range: Range, elementToInsert: HTMLElement): Text | undefined {
  // 获取 Range 结束位置的容器
  const endContainer = range.endContainer;
  const endOffset = range.endOffset;

  // 如果结束位置是文本节点，在该节点后插入
  if (endContainer.nodeType === Node.TEXT_NODE) {
    // 分割文本节点，在选区结束位置后面插入
    const textNode = endContainer as Text;
    const parent = textNode.parentNode;

    if (!parent) {
      return undefined;
    }

    // 创建分隔符（空格）
    const separator = document.createTextNode(' ');

    // 在文本节点后面插入分隔符和译文
    // 使用 splitText 在选区结束位置分割文本
    let afterSeparator: Node = separator;
    try {
      // 如果 endOffset 在文本节点范围内，分割它
      if (endOffset < textNode.length) {
        afterSeparator = textNode.splitText(endOffset);
      }
      // 在分割点后面插入分隔符和译文
      parent.insertBefore(separator, afterSeparator);
      parent.insertBefore(elementToInsert, afterSeparator);
    } catch (e) {
      // 分割失败时，直接追加到末尾
      parent.appendChild(separator);
      parent.appendChild(elementToInsert);
    }

    return separator;
  } else {
    // 结束位置是元素节点，在其内部插入
    const element = endContainer as HTMLElement;
    try {
      const child = element.childNodes[endOffset];
      const separator = document.createTextNode(' ');
      element.insertBefore(separator, child);
      element.insertBefore(elementToInsert, child);
      return separator;
    } catch (e) {
      // 插入失败时，直接追加到段落
      const paragraph = range.commonAncestorContainer.parentElement;
      if (paragraph) {
        paragraph.appendChild(elementToInsert);
      }
      return undefined;
    }
  }
}

/**
 * 安全地移除译文元素（带淡出动画）
 */
export function removeTranslation(translationEl: HTMLElement): void {
  if (!translationEl) return;

  // 添加淡出效果
  translationEl.style.transition = 'all 0.2s ease';
  translationEl.style.opacity = '0';

  // 等待动画完成后移除
  setTimeout(() => {
    translationEl.remove();
  }, 200);
}
