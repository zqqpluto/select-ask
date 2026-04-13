/**
 * 全文翻译引擎
 * 参照沉浸式翻译的 DOM 结构和批处理策略：
 * 1. wrapper > original + translation 三层包裹结构
 * 2. loading 使用沉浸式风格旋转 spinner
 * 3. 长文本分块翻译，每块携带上下文保持连贯
 */

import { marked } from 'marked';

const TRANSLATION_MARKER_ATTR = 'data-sa-translation';
const PARAGRAPH_ID_ATTR = 'data-sa-paragraph-id';

const SKIP_TAGS = new Set([
  'script', 'style', 'noscript', 'textarea', 'input', 'select',
  'option', 'optgroup', 'code', 'pre', 'svg', 'math', 'canvas',
]);

const BLOCK_TAGS = new Set([
  'P', 'DIV', 'LI', 'TD', 'TH', 'BLOCKQUOTE', 'FIGCAPTION',
  'CAPTION', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'PRE',
  'DT', 'DD', 'SECTION', 'ARTICLE', 'ASIDE', 'HEADER', 'FOOTER',
  'MAIN', 'NAV', 'FIGURE', 'DETAILS', 'SUMMARY',
]);

const translatedParagraphs = new Map<string, HTMLElement>();

export interface TranslatableParagraph {
  id: string;
  element: HTMLElement;
  text: string;
  status: 'pending' | 'translating' | 'done' | 'error';
  translation: string;
  wrapperEl?: HTMLElement;
  error?: string;
  originalTagName?: string;  // 用于 restore 时重建原始元素
}

export interface FullPageTranslationController {
  readonly isTranslating: boolean;
  readonly totalParagraphs: number;
  readonly completedParagraphs: number;
  paragraphs: TranslatableParagraph[];
  start(): Promise<void>;
  stop(): void;
  restore(): void;
  pause(): void;
  resume(): void;
  getStatus(): { total: number; completed: number; errors: number };
}

interface FullPageTranslationOptions {
  targetLanguage: string;
  sourceLanguage?: string;
  onProgress?: (status: { total: number; completed: number; errors: number }) => void;
  onChunk?: (paragraphId: string, chunk: string) => void;
  onDone?: () => void;
  onError?: (error: Error) => void;
  streamTranslate: (text: string, targetLang?: string, context?: { prefix?: string; suffix?: string }) => AsyncGenerator<string, void, unknown>;
}

function collectTranslatableParagraphs(): TranslatableParagraph[] {
  const paragraphs: TranslatableParagraph[] = [];
  const seenElements = new Set<HTMLElement>();
  let idCounter = 0;

  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node: Text): number {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;

        if (parent.offsetParent === null && parent !== document.body) {
          const style = window.getComputedStyle(parent);
          if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
            return NodeFilter.FILTER_REJECT;
          }
        }

        const tag = parent.tagName.toUpperCase();
        if (SKIP_TAGS.has(tag)) return NodeFilter.FILTER_REJECT;

        if (parent.closest(`[${TRANSLATION_MARKER_ATTR}], .select-ask-float-window, .select-ask-floating-icon, .notranslate`)) {
          return NodeFilter.FILTER_REJECT;
        }

        if (parent.isContentEditable || parent.getAttribute('contenteditable') === 'true') {
          return NodeFilter.FILTER_REJECT;
        }

        if (!node.textContent?.trim()) return NodeFilter.FILTER_REJECT;

        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  const textNodes: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) {
    textNodes.push(node as Text);
  }

  for (const textNode of textNodes) {
    const parent = textNode.parentElement!;
    let blockParent: HTMLElement | null = parent;
    while (blockParent && blockParent !== document.body) {
      if (BLOCK_TAGS.has(blockParent.tagName.toUpperCase())) {
        break;
      }
      blockParent = blockParent.parentElement;
    }
    if (!blockParent || blockParent === document.body) {
      blockParent = parent;
    }

    if (seenElements.has(blockParent)) continue;
    seenElements.add(blockParent);

    const text = blockParent.textContent?.trim() || '';
    if (text.length < 2) continue;

    const id = `fp-para-${idCounter++}`;
    paragraphs.push({
      id,
      element: blockParent,
      text,
      status: 'pending' as const,
      translation: '',
      originalTagName: blockParent.tagName.toLowerCase(),
    });
  }

  return paragraphs;
}
function createLoadingSpinner(): HTMLElement {
  const spinner = document.createElement('span');
  spinner.className = 'select-ask-fp-loading-spinner';
  return spinner;
}

/**
 * 恢复单个 wrapper 为原始元素
 * 与 createParagraphWrapper 的 replaceWith 对应：
 * 1. 从 originalBlock 取回原文内容
 * 2. 重建原始标签名的元素
 * 3. 复制原始属性（class、id、style、data-* 等）
 * 4. 用重建的元素替换 wrapper
 */
function restoreSingleWrapper(wrapper: HTMLElement): void {
  const originalBlock = wrapper.querySelector('.select-ask-fp-para-original');
  if (!originalBlock) {
    wrapper.remove();
    return;
  }

  // 从 wrapper 上取原始标签名
  const tagName = wrapper.getAttribute('data-sa-original-tag') || 'div';

  // 重建原始元素
  const originalEl = document.createElement(tagName);
  // 复制 wrapper 上的非翻译相关属性到原始元素
  const attrsToSkip = new Set(['class', TRANSLATION_MARKER_ATTR, PARAGRAPH_ID_ATTR, 'style', 'data-sa-original-tag']);
  for (let i = 0; i < wrapper.attributes.length; i++) {
    const attr = wrapper.attributes[i];
    if (!attrsToSkip.has(attr.name)) {
      originalEl.setAttribute(attr.name, attr.value);
    }
  }

  // 将原文内容移入重建的元素
  while (originalBlock.firstChild) {
    originalEl.appendChild(originalBlock.firstChild);
  }

  wrapper.replaceWith(originalEl);
}

/**
 * 复制原文元素的关键样式到译文容器
 * 参照沉浸式翻译：显式复制计算样式，确保译文样式与原文一致
 */
function copyComputedStyles(target: HTMLElement, source: HTMLElement): void {
  const computed = window.getComputedStyle(source);
  // 复制文字排版样式，包括颜色 — 确保译文与原文视觉一致
  const stylesToCopy = [
    'font-family', 'font-size', 'font-weight', 'font-style',
    'line-height', 'letter-spacing', 'word-spacing',
    'text-align', 'text-indent', 'text-transform',
    'text-decoration', 'text-decoration-line', 'text-decoration-color',
    'white-space', 'word-break', 'word-wrap',
    'padding-top', 'padding-bottom', 'padding-left', 'padding-right',
    'color',
    'direction', 'unicode-bidi',
  ];
  for (const prop of stylesToCopy) {
    const value = computed.getPropertyValue(prop);
    if (value) {
      target.style.setProperty(prop, value, 'important');
    }
  }
}

/**
 * 创建翻译包装器（参照沉浸式翻译的 DOM 结构）
 * 使用 replaceWith 替换原文元素，wrapper 占据原文在 DOM 中的精确位置
 * wrapper > original-block + translation-block
 */
function createParagraphWrapper(paragraph: TranslatableParagraph): HTMLElement {
  if (paragraph.wrapperEl) return paragraph.wrapperEl;

  const wrapper = document.createElement('div');
  wrapper.className = 'select-ask-fp-para-wrapper';
  wrapper.setAttribute(TRANSLATION_MARKER_ATTR, '1');
  wrapper.setAttribute(PARAGRAPH_ID_ATTR, paragraph.id);
  wrapper.setAttribute('data-sa-original-tag', paragraph.element.tagName.toLowerCase());

  // 创建原文包裹层
  const originalBlock = document.createElement('div');
  originalBlock.className = 'select-ask-fp-para-original';

  // 将原文元素的内容移入 originalBlock
  while (paragraph.element.firstChild) {
    originalBlock.appendChild(paragraph.element.firstChild);
  }

  // 把 originalBlock 放入 wrapper
  wrapper.appendChild(originalBlock);

  // 创建翻译块容器（初始为空，带 loading）
  const translationBlock = document.createElement('div');
  translationBlock.className = 'select-ask-fp-para-translation';

  // 复制原文的计算样式到译文容器
  copyComputedStyles(translationBlock, paragraph.element);

  const loadingSpinner = createLoadingSpinner();
  translationBlock.appendChild(loadingSpinner);
  wrapper.appendChild(translationBlock);

  // 用 wrapper 替换原文元素，wrapper 占据原文在 DOM 树中的位置
  paragraph.element.replaceWith(wrapper);

  paragraph.wrapperEl = wrapper;
  translatedParagraphs.set(paragraph.id, wrapper);

  return wrapper;
}

/**
 * 更新段落的翻译内容（流式更新或最终渲染）
 */
function updateParagraphTranslation(
  paragraph: TranslatableParagraph,
  translationText: string,
  isFinal: boolean
): void {
  const wrapper = paragraph.wrapperEl;
  if (!wrapper) return;

  const translationBlock = wrapper.querySelector('.select-ask-fp-para-translation') as HTMLElement;
  if (!translationBlock) return;

  // 移除 loading
  const existingSpinner = translationBlock.querySelector('.select-ask-fp-loading-spinner');
  if (existingSpinner) existingSpinner.remove();

  // marked.parse 返回安全的 HTML
  const rawHtml = marked.parse(translationText) as string;
  const singleParaMatch = rawHtml.match(/^<p>([\s\S]*)<\/p>$/i);
  const contentHtml = singleParaMatch ? singleParaMatch[1] : rawHtml;

  if (isFinal) {
    translationBlock.innerHTML = contentHtml;
    translationBlock.classList.remove('select-ask-translation-streaming');
    paragraph.status = 'done';
  } else {
    translationBlock.innerHTML = contentHtml;
    translationBlock.classList.add('select-ask-translation-streaming');
  }
}

/**
 * 标记段落翻译出错
 */
function markParagraphError(paragraph: TranslatableParagraph, error: string): void {
  const wrapper = paragraph.wrapperEl;
  if (!wrapper) return;

  const translationBlock = wrapper.querySelector('.select-ask-fp-para-translation') as HTMLElement;
  if (!translationBlock) return;

  const existingSpinner = translationBlock.querySelector('.select-ask-fp-loading-spinner');
  if (existingSpinner) existingSpinner.remove();

  translationBlock.innerHTML = `<span class="select-ask-translation-error">${escapeHtml(error)}</span>`;
  translationBlock.classList.remove('select-ask-translation-streaming');
  paragraph.status = 'error';
  paragraph.error = error;
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/** 批量翻译分隔符（参照沉浸式翻译） */
const BATCH_SEPARATOR = '\n\n%%\n\n';
/** 每批最大字符数，避免单次请求过大 */
const BATCH_MAX_CHARS = 4000;
/** 上下文携带字符数（每个 chunk 前后各带一段上下文，参照沉浸式翻译） */
const CONTEXT_CHARS = 200;

export function createFullPageTranslationController(
  options: FullPageTranslationOptions
): FullPageTranslationController {
  let isTranslating = false;
  let isStopped = false;
  let paragraphs: TranslatableParagraph[] = [];

  const controller: FullPageTranslationController = {
    get isTranslating() { return isTranslating; },
    get totalParagraphs() { return paragraphs.length; },
    get completedParagraphs() {
      return paragraphs.filter(p => p.status === 'done').length;
    },
    paragraphs,

    async start(): Promise<void> {
      if (isTranslating) return;

      paragraphs = collectTranslatableParagraphs();
      if (paragraphs.length === 0) {
        options.onError?.(new Error('未找到可翻译的内容'));
        return;
      }

      isTranslating = true;
      isStopped = false;

      // 立即为所有段落创建 wrapper + loading spinner
      for (const p of paragraphs) {
        createParagraphWrapper(p);
      }

      // 批量翻译：按字符数分组，每组一次 API 调用
      await translateInBatches();

      isTranslating = false;
      if (!isStopped) {
        options.onDone?.();
      }
    },

    stop(): void {
      isStopped = true;
      isTranslating = false;
    },

    restore(): void {
      translatedParagraphs.forEach((wrapper) => {
        restoreSingleWrapper(wrapper);
      });
      translatedParagraphs.clear();
      isTranslating = false;
      isStopped = true;
      paragraphs = [];
    },

    pause(): void {
      // 保留 API 兼容，但无 UI
    },

    resume(): void {
      // 保留 API 兼容，但无 UI
    },

    getStatus() {
      const completed = paragraphs.filter(p => p.status === 'done').length;
      const errors = paragraphs.filter(p => p.status === 'error').length;
      return { total: paragraphs.length, completed, errors };
    },
  };

  /**
   * 批量翻译：并行翻译 + 顺序重组（参照沉浸式翻译）
   * 1. 将所有段落分组为批次
   * 2. 每个批次携带上下文（prefix/suffix）
   * 3. 所有批次同时发起 API 调用（并行）
   * 4. 通过 partIndex 确保结果按正确顺序重组
   */
  async function translateInBatches(): Promise<void> {
    // 将段落分组为批次
    interface TranslationBatch {
      index: number;
      paragraphs: TranslatableParagraph[];
      text: string;
      prefix: string;  // 前文上下文
      suffix: string;  // 后文上下文
    }

    const batches: TranslationBatch[] = [];
    let currentBatch: TranslatableParagraph[] = [];
    let currentBatchSize = 0;

    for (const p of paragraphs) {
      const textWithSeparator = currentBatch.length > 0 ? BATCH_SEPARATOR + p.text : p.text;
      if (currentBatchSize + textWithSeparator.length > BATCH_MAX_CHARS && currentBatch.length > 0) {
        batches.push({
          index: batches.length,
          paragraphs: [...currentBatch],
          text: currentBatch.map(p => p.text).join(BATCH_SEPARATOR),
          prefix: '',
          suffix: '',
        });
        currentBatch = [p];
        currentBatchSize = p.text.length;
      } else {
        currentBatch.push(p);
        currentBatchSize += textWithSeparator.length;
      }
    }
    if (currentBatch.length > 0) {
      batches.push({
        index: batches.length,
        paragraphs: currentBatch,
        text: currentBatch.map(p => p.text).join(BATCH_SEPARATOR),
        prefix: '',
        suffix: '',
      });
    }

    // 为每个批次添加上下文（参照沉浸式翻译的 prefix/suffix）
    for (let i = 0; i < batches.length; i++) {
      // 前文：上一个批次的最后 CONTEXT_CHARS 字符
      if (i > 0) {
        const prevBatch = batches[i - 1];
        const prevText = prevBatch.text;
        batches[i].prefix = prevText.slice(-CONTEXT_CHARS);
      }
      // 后文：下一个批次的前 CONTEXT_CHARS 字符
      if (i < batches.length - 1) {
        const nextBatch = batches[i + 1];
        const nextText = nextBatch.text;
        batches[i].suffix = nextText.slice(0, CONTEXT_CHARS);
      }
    }

    // 并行翻译所有批次（参照沉浸式翻译的并行翻译策略）
    const translationPromises = batches.map(async (batch): Promise<{ index: number; result: string } | null> => {
      if (isStopped) return null;

      try {
        let batchResult = '';
        // 传递上下文（prefix/suffix）
        const context = (batch.prefix || batch.suffix) ? {
          prefix: batch.prefix || undefined,
          suffix: batch.suffix || undefined,
        } : undefined;

        for await (const chunk of options.streamTranslate(batch.text, options.targetLanguage, context)) {
          if (isStopped) break;
          batchResult += chunk;
        }
        if (isStopped || !batchResult) return null;
        return { index: batch.index, result: batchResult };
      } catch (error) {
        // 单个批次失败，标记该批次段落为错误
        for (const p of batch.paragraphs) {
          markParagraphError(p, error instanceof Error ? error.message : String(error));
        }
        return null;
      }
    });

    // 等待所有批次完成（并行）
    const results = await Promise.allSettled(translationPromises);

    if (isStopped) return;

    // 按顺序重组结果（参照沉浸式翻译的顺序重组）
    const completedBatches = results
      .filter((r): r is PromiseFulfilledResult<{ index: number; result: string } | null> => r.status === 'fulfilled' && r.value !== null)
      .map(r => r.value!)
      .sort((a, b) => a.index - b.index);

    // 按顺序分发到各段落
    for (const completed of completedBatches) {
      const batch = batches[completed.index];
      const translations = splitTranslations(completed.result, batch.paragraphs.length);

      for (let i = 0; i < batch.paragraphs.length; i++) {
        if (isStopped) break;
        const para = batch.paragraphs[i];
        const translation = translations[i]?.trim();
        if (translation) {
          para.translation = translation;
          updateParagraphTranslation(para, translation, true);
        } else {
          markParagraphError(para, '翻译结果为空');
        }
      }
    }
  }

  /**
   * 拆分批量翻译结果
   * 参照沉浸式翻译：用 %% 分隔符拆分
   */
  function splitTranslations(fullText: string, expectedCount: number): string[] {
    const parts = fullText.split(BATCH_SEPARATOR).map(s => s.trim()).filter(Boolean);

    // 如果拆分数量不匹配，尝试智能拆分
    if (parts.length === expectedCount) {
      return parts;
    }

    // 如果只有一个结果（没有分隔符），可能翻译模型忽略了分隔符
    if (parts.length === 1 && expectedCount > 1) {
      // 尝试按段落拆分（基于标点符号）
      return smartSplit(parts[0], expectedCount);
    }

    // 如果拆分过多或过少，尽可能平均分配
    if (parts.length > expectedCount) {
      // 合并多余的部分
      const result: string[] = [];
      const ratio = parts.length / expectedCount;
      for (let i = 0; i < expectedCount; i++) {
        const start = Math.floor(i * ratio);
        const end = Math.floor((i + 1) * ratio);
        result.push(parts.slice(start, end).join(' '));
      }
      return result;
    }

    // 拆分不够，用空字符串填充
    while (parts.length < expectedCount) {
      parts.push('');
    }
    return parts;
  }

  /**
   * 智能拆分：当翻译结果没有被分隔符正确分割时
   */
  function smartSplit(text: string, count: number): string[] {
    // 尝试按段落边界拆分
    const sentences = text.split(/(?<=[.!?。！？\n])/g).filter(s => s.trim());

    if (sentences.length >= count) {
      const result: string[] = [];
      const ratio = sentences.length / count;
      for (let i = 0; i < count; i++) {
        const start = Math.floor(i * ratio);
        const end = Math.floor((i + 1) * ratio);
        result.push(sentences.slice(start, end).join(' ').trim());
      }
      return result;
    }

    // 兜底：返回整个文本
    return Array(count).fill(text);
  }

  return controller;
}

export function restoreParagraph(paragraphId: string): void {
  const wrapper = translatedParagraphs.get(paragraphId);
  if (wrapper) {
    restoreSingleWrapper(wrapper);
    translatedParagraphs.delete(paragraphId);
  }
}

export function restoreAllTranslations(): void {
  // 先恢复所有原文内容，再移除 wrapper
  translatedParagraphs.forEach((wrapper) => {
    restoreSingleWrapper(wrapper);
  });
  translatedParagraphs.clear();
}

export function isElementTranslated(element: HTMLElement): boolean {
  return translatedParagraphs.has(element.getAttribute(PARAGRAPH_ID_ATTR) || '');
}
