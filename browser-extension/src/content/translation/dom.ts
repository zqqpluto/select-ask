/**
 * 行内翻译 DOM 操作工具函数
 * 负责查找段落容器、创建译文元素、插入译文到页面
 */

/**
 * 获取选区跨越的所有段落容器
 * 返回按文档顺序排列的段落元素数组
 *
 * 策略：
 * 1. 使用 TreeWalker 只遍历被 Range 覆盖的文本节点
 * 2. 对每个被选中的文本节点，找到其最近的语义化父元素
 * 3. 去重：相同父元素只保留一次
 *
 * 这样可以确保只提取真正被选中的文本所在的元素，不会包含嵌套内容。
 */
export function getAllParagraphsInRange(range: Range): HTMLElement[] {
  const semanticTags = new Set(['P', 'LI', 'TD', 'TH', 'BLOCKQUOTE', 'FIGCAPTION', 'CAPTION', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'A']);

  // 记录已找到的段落（按插入顺序，用于去重）
  const paragraphs: Map<HTMLElement, number> = new Map();
  let order = 0;

  // 使用 TreeWalker 只遍历文本节点
  const textWalker = document.createTreeWalker(
    range.commonAncestorContainer,
    NodeFilter.SHOW_TEXT,
    null
  );

  let node: Node | null = textWalker.currentNode;
  while (node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const textNode = node;
      // 检查该文本节点是否在选区内
      if (isTextNodeInRange(range, textNode as Text)) {
        const text = textNode.textContent?.trim();
        if (text) {
          // 找到该文本节点的最近语义化父元素
          const parent = findNearestSemanticParent(textNode, semanticTags);
          if (parent) {
            if (!paragraphs.has(parent)) {
              paragraphs.set(parent, order++);
            }
          }
        }
      }
    }
    node = textWalker.nextNode();
  }

  // 按文档顺序排序
  const result = Array.from(paragraphs.keys());
  result.sort((a, b) => (paragraphs.get(a) || 0) - (paragraphs.get(b) || 0));

  return result;
}

/**
 * 检查文本节点是否与 Range 有重叠
 * 使用 intersectsNode API，这是浏览器原生方法
 */
function isTextNodeInRange(range: Range, textNode: Text): boolean {
  try {
    return range.intersectsNode(textNode);
  } catch {
    // 出错时返回 false（不包含该文本节点），避免过多提取
    return false;
  }
}

/**
 * 查找文本节点的最近语义化父元素
 * 找到第一个匹配的语义标签就返回，用于精确匹配文本到其直接语义容器
 */
function findNearestSemanticParent(node: Node, semanticTags: Set<string>): HTMLElement | null {
  let current: Node | null = node.parentElement;
  while (current) {
    if (current.nodeType === Node.ELEMENT_NODE && current instanceof HTMLElement) {
      const el = current as HTMLElement;
      if (semanticTags.has(el.tagName)) {
        return el;
      }
    }
    current = current.parentElement;
  }
  return null;
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
 * 动态检测译文是否应该使用行内模式
 * 通过计算译文宽度是否超过原文容器宽度来判断
 * @param sourceElement 原文元素
 * @param sourceText 原文文本
 * @param translatedText 译文文本
 */
export function detectInlineMode(
  sourceElement: HTMLElement,
  _sourceText: string,
  translatedText: string
): boolean {
  // 创建临时 span 测量译文宽度
  const tempSpan = document.createElement('span');
  tempSpan.style.visibility = 'hidden';
  tempSpan.style.position = 'absolute';
  tempSpan.style.whiteSpace = 'nowrap';
  tempSpan.style.display = 'inline-block';

  // 继承原文样式
  const computedStyle = window.getComputedStyle(sourceElement);
  const styleProperties = [
    'font-family', 'font-size', 'font-weight', 'font-style',
    'line-height', 'letter-spacing', 'text-transform'
  ];
  for (const prop of styleProperties) {
    (tempSpan.style as any)[prop] = computedStyle.getPropertyValue(prop);
  }

  // 测量译文宽度
  tempSpan.textContent = translatedText;
  document.body.appendChild(tempSpan);
  const translatedWidth = tempSpan.offsetWidth;
  document.body.removeChild(tempSpan);

  // 获取原文容器的宽度
  const sourceRect = sourceElement.getBoundingClientRect();

  // 如果译文宽度不超过原文容器宽度的 120%，使用行内模式
  // 这个阈值允许译文比原文稍长一些，但仍然显示在同一行
  return translatedWidth <= sourceRect.width * 1.2;
}

/**
 * 提取指定元素在 Range 内的文本
 * 只收集直接属于该元素的文本节点，不包括嵌套语义子元素的文本
 * 用于多段落翻译时精确提取被选中的文本
 */
export function getTextInElementRange(range: Range, element: HTMLElement): string {
  const semanticTags = new Set(['P', 'LI', 'TD', 'TH', 'BLOCKQUOTE', 'FIGCAPTION', 'CAPTION', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'A']);
  const texts: string[] = [];

  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);
  let node: Node | null = walker.currentNode;
  while (node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const textNode = node as Text;
      if (isTextNodeInRange(range, textNode as Text)) {
        // 检查该文本节点的最近语义父元素是否就是目标元素本身
        // 如果文本被嵌套的语义元素（如子 <li>）包含，则跳过
        let current: Node | null = textNode.parentElement;
        let isDirectText = true;
        while (current && current !== element) {
          if (current.nodeType === Node.ELEMENT_NODE && current instanceof HTMLElement) {
            const el = current as HTMLElement;
            if (semanticTags.has(el.tagName)) {
              isDirectText = false;
              break;
            }
          }
          current = current.parentElement;
        }
        if (isDirectText) {
          const text = textNode.textContent?.trim();
          if (text) {
            texts.push(text);
          }
        }
      }
    }
    node = walker.nextNode();
  }

  return texts.join(' ');
}

/**
 * 判断文本长度，决定使用行内模式还是块级模式（兜底方案）
 * 短文本（<= 50 字符）使用行内模式，显示在原文右侧
 * 长文本使用块级模式，显示在原文下方
 * @deprecated 优先使用 detectInlineMode 进行动态判断
 */
export function shouldUseInlineMode(text: string): boolean {
  return text.length <= 50;
}

/**
 * 创建译文容器元素 - 参照沉浸式翻译 v1.27.2 的简化结构
 * 采用两层结构：theme 容器 + 内容容器（移除 wrapper 层）
 * 使用 insertAdjacentHTML + "afterend" 方式插入
 * @param id - 唯一标识
 * @param isInline - 是否使用行内模式
 */
export function createTranslationElement(id: string, isInline: boolean): { translationEl: HTMLElement; contentEl: HTMLElement } {
  // 第一层：译文内容容器（同时作为 wrapper）
  const translationEl = document.createElement('div');
  translationEl.id = id;
  translationEl.className = `select-ask-translation ${isInline ? 'inline' : 'block'} notranslate`;

  // 第二层：内容包装器（用于样式继承）
  const contentWrapper = document.createElement('div');
  contentWrapper.className = 'select-ask-translation-content-wrapper';

  // 译文内容容器
  const contentEl = document.createElement('span');
  contentEl.className = 'select-ask-translation-content';

  // 流式加载光标
  const streamingEl = document.createElement('span');
  streamingEl.className = 'select-ask-translation-streaming';
  contentEl.appendChild(streamingEl);

  // 组装结构
  contentWrapper.appendChild(contentEl);
  translationEl.appendChild(contentWrapper);

  // 不再添加关闭按钮，译文不支持删除
  // if (!isInline) {
  //   const closeBtn = document.createElement('button');
  //   closeBtn.className = 'select-ask-translation-close';
  //   closeBtn.title = '关闭';
  //   closeBtn.textContent = '×';
  //   translationEl.appendChild(closeBtn);
  // }

  return { translationEl, contentEl };
}

/**
 * 在指定位置插入译文 - 参照沉浸式翻译 v1.27.2 架构
 * 使用 insertAdjacentElement + "afterend" 方式插入译文
 * 译文作为原文的兄弟元素，显示在原文后面（行内）或下方（块级）
 *
 * 两层结构：
 * - translationEl: 译文容器，应用主题样式和 notranslate 类
 * - contentEl: 内容容器，通过 CSS inherit 继承原文样式
 *
 * @param inheritStyles - 是否继承原文样式（如标题、段落等）
 */
export function insertTranslation(
  paragraph: HTMLElement,
  translationId: string,
  isInline: boolean,
  originalText: string,
  range?: Range,
  inheritStyles: boolean = true
): { translationEl: HTMLElement; wrapper: HTMLElement; container: HTMLElement; separatorNode?: Text } {
  // 检查是否已存在
  const existing = document.getElementById(translationId);
  if (existing) {
    return { translationEl: existing, wrapper: existing, container: existing };
  }

  // 创建译文容器元素
  const { translationEl, contentEl: _contentEl } = createTranslationElement(translationId, isInline);

  // 存储关联关系
  translationEl.dataset.translationFor = paragraph.tagName.toLowerCase();
  translationEl.dataset.sourceElement = paragraph.tagName.toLowerCase();
  translationEl.dataset.originalText = originalText;

  // 样式继承：通过 CSS inherit 自动继承（译文容器是原文的兄弟元素，需要显式设置）
  if (inheritStyles) {
    const computedStyle = window.getComputedStyle(paragraph);
    // 复制所有关键样式到译文容器
    const styleProperties = [
      // 基础文本样式
      'font-family', 'font-size', 'font-weight', 'font-style',
      'line-height', 'letter-spacing', 'text-transform',
      'color', 'text-align', 'word-spacing', 'text-indent',
      // 标题特有样式
      'margin-top', 'margin-bottom', 'margin-left', 'margin-right',
      'padding-top', 'padding-bottom', 'padding-left', 'padding-right',
      // 超链接特有样式
      'text-decoration', 'text-decoration-color', 'text-decoration-line',
      'text-decoration-style', 'cursor',
      // 其他布局样式
      'display', 'vertical-align',
    ];
    for (const prop of styleProperties) {
      const value = computedStyle.getPropertyValue(prop);
      if (value) {
        (translationEl.style as any)[prop.replace(/-./g, x => x[1].toUpperCase())] = value;
      }
    }

    // 针对标题元素，确保字号正确继承
    if (['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(paragraph.tagName)) {
      // 标题元素通常有默认的大字号，确保继承
      const fontSize = computedStyle.getPropertyValue('font-size');
      if (fontSize) {
        translationEl.style.fontSize = fontSize;
      }
    }

    // 针对超链接元素，确保链接样式正确继承
    if (paragraph.tagName === 'A') {
      // 链接元素通常有下划线和特定颜色，确保继承
      const textDecoration = computedStyle.getPropertyValue('text-decoration');
      if (textDecoration) {
        translationEl.style.textDecoration = textDecoration;
      }
      const color = computedStyle.getPropertyValue('color');
      if (color) {
        translationEl.style.color = color;
      }
      // 链接鼠标样式
      translationEl.style.cursor = 'pointer';
    }
  }

  if (isInline) {
    // 行内模式：确保译文是 inline-block，不被原文的 display 样式影响
    translationEl.style.display = 'inline-block';
    // 垂直对齐：与原文基线对齐
    translationEl.style.verticalAlign = 'baseline';

    let separatorNode: Text | undefined;

    // 标题元素在行内模式下：插入到标题内容末尾（内部）
    // 由于译文设置了 display: inline-block，它会和标题文本在同一行显示
    if (['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(paragraph.tagName)) {
      paragraph.appendChild(translationEl);
    } else {
      // 译文作为 inline-block 插入到段落内部，紧跟选中的文本
      if (range && !range.collapsed) {
        // 在 Range 结束位置的文本节点后插入
        separatorNode = insertAfterRange(range, translationEl);
      } else {
        // 兜底：直接追加到段落末尾
        paragraph.appendChild(translationEl);
      }
    }

    return { translationEl, wrapper: translationEl, container: translationEl, separatorNode };
  } else {
    // 块级模式：译文作为独立 block 插入到原文后面（使用 insertAdjacentElement）
    // 特殊处理：如果原文是 li 元素，不能直接插入到 ul/ol 中，需要放在 li 内部
    const parentTag = paragraph.parentNode?.nodeName?.toUpperCase();

    if (parentTag === 'UL' || parentTag === 'OL') {
      // 原文是 li，父元素是 ul/ol：将译文插入到 li 内部末尾
      paragraph.appendChild(translationEl);
    } else {
      // 普通元素：使用 insertAdjacentElement + "afterend" 插入到原文后面
      paragraph.insertAdjacentElement('afterend', translationEl);
    }

    return { translationEl, wrapper: translationEl, container: translationEl };
  }
}

/**
 * 在段落后面插入 loading 元素（作为独立兄弟元素）
 * 参照沉浸式翻译：loading 显示在译文容器位置，而不是段落内部
 * loading 作为独立的 block 元素，显示在原文下方（块级模式）或原文后面（行内模式）
 */
export function insertLoadingAtEnd(paragraph: HTMLElement, isInline: boolean = false, range?: Range): { loadingEl: HTMLElement; container: HTMLElement; separatorNode?: Text } {
  if (isInline) {
    // 行内模式：loading 作为 inline 插入到选中文本后面
    const loadingEl = document.createElement('span');
    loadingEl.className = 'select-ask-translation-loading-inline';
    loadingEl.innerHTML = '<div class="select-ask-loading-spinner"></div>';

    if (range && !range.collapsed) {
      // 在 Range 结束位置的文本节点后插入
      return { loadingEl, container: paragraph, separatorNode: insertAfterRange(range, loadingEl) };
    } else {
      // 兜底：直接追加到段落末尾
      paragraph.appendChild(loadingEl);
      return { loadingEl, container: paragraph };
    }
  } else {
    // 块级模式：loading 作为独立 block 插入到段落后面（使用 insertAdjacentElement）
    const loadingEl = document.createElement('div');
    loadingEl.className = 'select-ask-translation-loading block';
    loadingEl.innerHTML = '<div class="select-ask-loading-spinner"></div><span class="select-ask-loading-text">翻译中...</span>';

    // 使用 insertAdjacentElement + "afterend" 插入
    paragraph.insertAdjacentElement('afterend', loadingEl);

    return { loadingEl, container: loadingEl };
  }
}

/**
 * @deprecated 使用 insertLoadingAtEnd 替代
 */
export function insertInlineLoading(
  paragraph: HTMLElement,
  range?: Range
): { loadingEl: HTMLElement; container: HTMLElement; separatorNode?: Text } {
  return insertLoadingAtEnd(paragraph, true, range);
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
