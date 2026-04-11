/**
 * 全文翻译引擎
 * TreeWalker 遍历 DOM，收集可翻译段落，使用 <font> 标签包裹译文
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
  streamTranslate: (text: string, targetLang?: string) => AsyncGenerator<string, void, unknown>;
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

        if (parent.closest(`[${TRANSLATION_MARKER_ATTR}], .select-ask-float-window, .select-ask-floating-icon, .select-ask-fp-control-bar, .notranslate`)) {
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
    });
  }

  return paragraphs;
}

function createControlBar(): HTMLElement {
  const bar = document.createElement('div');
  bar.className = 'select-ask-fp-control-bar';

  const statusText = document.createElement('span');
  statusText.className = 'select-ask-fp-status-text';
  statusText.textContent = '准备翻译...';

  const progressBar = document.createElement('div');
  progressBar.className = 'select-ask-fp-progress-bar';
  const fill = document.createElement('div');
  fill.className = 'select-ask-fp-progress-fill';
  fill.style.width = '0%';
  progressBar.appendChild(fill);

  const pauseBtn = document.createElement('button');
  pauseBtn.className = 'select-ask-fp-btn select-ask-fp-pause-btn';
  pauseBtn.textContent = '暂停';

  const stopBtn = document.createElement('button');
  stopBtn.className = 'select-ask-fp-btn select-ask-fp-stop-btn';
  stopBtn.textContent = '停止';

  bar.appendChild(statusText);
  bar.appendChild(progressBar);
  bar.appendChild(pauseBtn);
  bar.appendChild(stopBtn);

  document.body.appendChild(bar);
  return bar;
}

function insertTranslationWrapper(
  paragraph: TranslatableParagraph,
  translationText: string
): HTMLElement {
  const wrapper = document.createElement('font');
  wrapper.className = 'notranslate';
  wrapper.setAttribute(TRANSLATION_MARKER_ATTR, '1');
  wrapper.setAttribute(PARAGRAPH_ID_ATTR, paragraph.id);
  wrapper.style.cssText = 'display:block;margin:4px 0 0 0;';

  // 译文标签
  const label = document.createElement('span');
  label.className = 'select-ask-fp-translation-label';
  label.textContent = '译文';

  const contentSpan = document.createElement('span');
  contentSpan.className = 'select-ask-fp-translation-content';

  // marked.parse 返回安全的 HTML（用户可控文本经 LLM 翻译）
  // 如果结果只包含单个 <p> 标签，剥离外层 <p> 避免多余间距
  const rawHtml = marked.parse(translationText) as string;
  const singleParaMatch = rawHtml.match(/^<p>([\s\S]*)<\/p>$/i);
  contentSpan.innerHTML = singleParaMatch ? singleParaMatch[1] : rawHtml;

  wrapper.appendChild(label);
  wrapper.appendChild(contentSpan);

  // 移除 loading
  removeLoadingFromParagraph(paragraph.element);

  paragraph.element.insertAdjacentElement('afterend', wrapper);
  paragraph.wrapperEl = wrapper;
  translatedParagraphs.set(paragraph.id, wrapper);

  return wrapper;
}

/**
 * 在段落上显示 loading 状态
 */
function showLoadingOnParagraph(element: HTMLElement): void {
  removeLoadingFromParagraph(element);

  const loadingEl = document.createElement('span');
  loadingEl.className = 'select-ask-fp-paragraph-loading';
  loadingEl.setAttribute('data-loading', '1');

  const spinner = document.createElement('span');
  spinner.className = 'select-ask-fp-loading-spinner';

  loadingEl.appendChild(spinner);
  element.appendChild(loadingEl);
}

/**
 * 移除段落上的 loading
 */
function removeLoadingFromParagraph(element: HTMLElement): void {
  const existing = element.querySelector('[data-loading="1"]');
  if (existing) existing.remove();
}

export function createFullPageTranslationController(
  options: FullPageTranslationOptions
): FullPageTranslationController {
  let isTranslating = false;
  let isPaused = false;
  let isStopped = false;
  let paragraphs: TranslatableParagraph[] = [];
  let controlBar: HTMLElement | null = null;
  const concurrentLimit = 3;
  let runningCount = 0;

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
      isPaused = false;

      controlBar = createControlBar();

      const pauseBtn = controlBar.querySelector('.select-ask-fp-pause-btn') as HTMLButtonElement;
      const stopBtn = controlBar.querySelector('.select-ask-fp-stop-btn') as HTMLButtonElement;

      pauseBtn.addEventListener('click', () => {
        if (isPaused) controller.resume();
        else controller.pause();
      });

      stopBtn.addEventListener('click', () => controller.stop());

      updateControlBar();
      await processQueue();

      if (!isStopped) {
        options.onDone?.();
        const statusText = controlBar?.querySelector('.select-ask-fp-status-text');
        if (statusText) statusText.textContent = '翻译完成';
        setTimeout(() => {
          if (controlBar) {
            controlBar.style.opacity = '0';
            setTimeout(() => controlBar?.remove(), 300);
          }
        }, 3000);
      }
    },

    stop(): void {
      isStopped = true;
      isTranslating = false;
      isPaused = false;
      const statusText = controlBar?.querySelector('.select-ask-fp-status-text');
      if (statusText) statusText.textContent = '已停止';
    },

    restore(): void {
      translatedParagraphs.forEach((wrapper) => wrapper.remove());
      translatedParagraphs.clear();
      if (controlBar) { controlBar.remove(); controlBar = null; }
      isTranslating = false;
      isStopped = true;
      paragraphs = [];
    },

    pause(): void {
      isPaused = true;
      const pauseBtn = controlBar?.querySelector('.select-ask-fp-pause-btn');
      if (pauseBtn) pauseBtn.textContent = '继续';
    },

    resume(): void {
      isPaused = false;
      const pauseBtn = controlBar?.querySelector('.select-ask-fp-pause-btn');
      if (pauseBtn) pauseBtn.textContent = '暂停';
      processQueue();
    },

    getStatus() {
      const completed = paragraphs.filter(p => p.status === 'done').length;
      const errors = paragraphs.filter(p => p.status === 'error').length;
      return { total: paragraphs.length, completed, errors };
    },
  };

  function updateControlBar() {
    if (!controlBar) return;
    const status = controller.getStatus();
    const statusText = controlBar.querySelector('.select-ask-fp-status-text');
    const fill = controlBar.querySelector('.select-ask-fp-progress-fill') as HTMLElement;
    if (statusText) statusText.textContent = `翻译中: ${status.completed}/${status.total}`;
    if (fill && status.total > 0) fill.style.width = `${(status.completed / status.total) * 100}%`;
  }

  async function processQueue(): Promise<void> {
    while (true) {
      if (isStopped) break;
      if (isPaused) { await sleep(200); continue; }

      const pendingIdx = paragraphs.findIndex(p => p.status === 'pending');
      if (pendingIdx < 0) {
        if (paragraphs.every(p => p.status === 'done' || p.status === 'error')) break;
        await sleep(100);
        continue;
      }

      if (runningCount >= concurrentLimit) { await sleep(100); continue; }

      const paragraph = paragraphs[pendingIdx];
      runningCount++;
      translateOne(paragraph).finally(() => { runningCount--; });
    }

    while (runningCount > 0 && !isStopped) { await sleep(100); }
  }

  async function translateOne(paragraph: TranslatableParagraph): Promise<void> {
    if (isStopped) return;

    paragraph.status = 'translating';
    updateControlBar();
    showLoadingOnParagraph(paragraph.element);

    try {
      let fullTranslation = '';
      for await (const chunk of options.streamTranslate(paragraph.text, options.targetLanguage)) {
        if (isStopped || isPaused) break;
        fullTranslation += chunk;
        paragraph.translation = fullTranslation;
        options.onChunk?.(paragraph.id, chunk);
      }

      if (!isStopped && fullTranslation) {
        paragraph.status = 'done';
        insertTranslationWrapper(paragraph, fullTranslation);
      } else if (!isStopped) {
        paragraph.status = 'error';
        paragraph.error = '翻译结果为空';
        removeLoadingFromParagraph(paragraph.element);
      }
    } catch (error) {
      paragraph.status = 'error';
      paragraph.error = error instanceof Error ? error.message : String(error);
      removeLoadingFromParagraph(paragraph.element);
    }

    updateControlBar();
    options.onProgress?.(controller.getStatus());
  }

  return controller;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function restoreParagraph(paragraphId: string): void {
  const wrapper = translatedParagraphs.get(paragraphId);
  if (wrapper) {
    wrapper.remove();
    translatedParagraphs.delete(paragraphId);
  }
}

export function restoreAllTranslations(): void {
  translatedParagraphs.forEach((wrapper) => wrapper.remove());
  translatedParagraphs.clear();
  const controlBar = document.querySelector('.select-ask-fp-control-bar');
  if (controlBar) controlBar.remove();
}

export function isElementTranslated(element: HTMLElement): boolean {
  return translatedParagraphs.has(element.getAttribute(PARAGRAPH_ID_ATTR) || '');
}
