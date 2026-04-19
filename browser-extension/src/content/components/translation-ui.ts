import { restoreSelectionRange, clearSelection } from '../utils/selection';
import { removeIconMenus } from '../utils/dom-utils';

export interface TranslationDeps {
  showResponseFloatingBox?: (action: string, text: string, context: any, model: any) => Promise<void>;
}

/**
 * 悬浮窗口翻译 - 在选区附近显示悬浮窗口进行翻译
 * 支持窗口内切换目标语言
 */
export async function showFloatingTranslation(text: string, context: any): Promise<void> {
  const { createFloatingTranslationWindow } = await import('../chat/floating-window');
  const { getTargetLanguage } = await import('../../utils/config-manager');
  const { streamTranslate } = await import('../../services/content-llm');

  // 恢复选区
  restoreSelectionRange();

  // 获取选区
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    console.warn('No selection found');
    return;
  }

  const range = selection.getRangeAt(0);
  const targetLang = await getTargetLanguage(text);

  // 清除选区
  clearSelection();

  // 移除图标和下拉菜单
  removeIconMenus();

  let currentTargetLang = targetLang;
  let floatWindow: ReturnType<typeof createFloatingTranslationWindow> | null = null;
  let abortController = new AbortController();

  async function startTranslation(lang: string) {
    if (!floatWindow) return;

    floatWindow.setContent('');
    floatWindow.setStreaming(true);
    abortController = new AbortController();

    let fullText = '';
    let isReasoning = false;
    try {
      for await (const chunk of streamTranslate(text, lang)) {
        if (abortController.signal.aborted) break;
        // 过滤推理标签
        if (chunk === '[REASONING]') { isReasoning = true; continue; }
        if (chunk === '[REASONING_DONE]') { isReasoning = false; continue; }
        if (isReasoning) continue;
        fullText += chunk;
        floatWindow?.appendContent(chunk);
      }
      floatWindow?.setStreaming(false);
    } catch (error) {
      if (!abortController.signal.aborted) {
        floatWindow?.setError(error instanceof Error ? error.message : '翻译出错');
      }
    }
  }

  // 创建悬浮窗口
  floatWindow = createFloatingTranslationWindow(range, {
    initialTargetLanguage: targetLang,
    originalText: text,
    onLanguageChange: async (newLang) => {
      if (newLang === 'auto') {
        // 智能模式：根据文本语言自动选择目标
        currentTargetLang = await getTargetLanguage(text);
      } else {
        currentTargetLang = newLang;
      }
      // 保存语言偏好
      const { setTargetLanguage } = await import('../../utils/config-manager');
      await setTargetLanguage(currentTargetLang);
      // 重新翻译
      startTranslation(currentTargetLang);
    },
    onClose: () => {
      abortController.abort();
      floatWindow = null;
    },
  });

  floatWindow.show();

  // 开始翻译
  startTranslation(currentTargetLang);
}

/**
 * 行内翻译 - 短文本显示在原文右侧，长文本显示在原文下方
 * 支持单段和多段文本选择
 * loading 始终显示在段落尾部（不换行），翻译完成后再根据文本长度决定译文显示位置
 */
export async function showInPlaceTranslation(text: string, context: any, deps?: TranslationDeps): Promise<void> {
  const { findParagraphContainer, getAllParagraphsInRange, generateTranslationId, insertTranslation, insertLoadingAtEnd, detectInlineMode, shouldUseInlineMode, getTextInElementRange } = await import('../translation/dom');
  const { TranslationManager } = await import('../translation/manager');
  const { setupTranslationInteraction, setupSourceElementInteraction } = await import('../translation/interaction');
  const { streamTranslate } = await import('../../services/content-llm');
  const { marked } = await import('marked');

  // 恢复选区
  restoreSelectionRange();

  // 获取选区
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    console.warn('No selection found');
    return;
  }

  const range = selection.getRangeAt(0);

  // 检测是否是多段选择
  const paragraphs = getAllParagraphsInRange(range);

  // 获取到段落后清除选区
  clearSelection();

  if (paragraphs.length > 1) {
    // 多段选择：每段单独翻译，一起发送，分别插入
    await translateMultipleParagraphs(paragraphs, range, {
      generateTranslationId,
      insertTranslation,
      insertLoadingAtEnd,
      TranslationManager,
      setupTranslationInteraction,
      setupSourceElementInteraction,
      detectInlineMode,
      shouldUseInlineMode,
      getTextInElementRange,
    });
    return;
  }

  // 单段选择
  const targetParagraph = findParagraphContainer(range);

  if (!targetParagraph) {
    console.warn('Could not find paragraph container, falling back to floating box');
    // 降级：使用浮动框
    if (deps?.showResponseFloatingBox) {
      await deps.showResponseFloatingBox('翻译', text, context, null);
    } else {
      console.warn('No fallback handler available for showInPlaceTranslation');
    }
    return;
  }

  // 生成唯一 ID
  const translationId = generateTranslationId(text);

  // 翻译开始时：在段落后面插入 loading（作为兄弟元素）
  // 先使用原文长度预估模式（短文本使用行内 loading，长文本使用块级 loading）
  const estimatedInline = shouldUseInlineMode(text);
  const { loadingEl } = insertLoadingAtEnd(targetParagraph, estimatedInline, estimatedInline ? range : undefined);

  // 创建临时条目用于管理 loading 状态
  let translationEl: HTMLElement | null = null;
  let separatorNode: Text | undefined;
  let isInline = true; // 默认使用行内模式，等翻译完成后动态判断

  const tempEntry = {
    id: translationId,
    originalText: text,
    sourceElement: targetParagraph,
    translationElement: loadingEl,
    isVisible: true,
    createdAt: Date.now(),
    streamCompleted: false,
  };

  // 注册到管理器
  TranslationManager.register(tempEntry);

  // 流式翻译
  let fullTranslation = '';
  let isReasoning = false; // 是否在思考过程标签内

  try {
    for await (const chunk of streamTranslate(text)) {
      // 处理思考过程标签
      if (chunk === '[REASONING]') {
        isReasoning = true;
        continue;
      }
      if (chunk === '[REASONING_DONE]') {
        isReasoning = false;
        continue;
      }

      // 如果在思考过程中，跳过不显示
      if (isReasoning) {
        continue;
      }

      fullTranslation += chunk;

      // 第一条内容到达时，移除 loading 并创建正式译文容器
      if (tempEntry.isVisible) {
        loadingEl.remove();

        // 使用 shouldUseInlineMode 作为初始判断（基于原文长度）
        isInline = shouldUseInlineMode(text);

        const result = insertTranslation(targetParagraph, translationId, isInline, text, isInline ? range : undefined);
        translationEl = result.translationEl;
        separatorNode = result.separatorNode;

        // 更新条目
        tempEntry.translationElement = translationEl;
        tempEntry.sourceElement = targetParagraph;
        tempEntry.separatorNode = separatorNode;

        // 设置交互
        setupTranslationInteraction(translationEl, translationId);

        // 标记为已切换
        tempEntry.isVisible = false;
      }

      // 渲染 Markdown（注意：marked 输出需要 sanitized，这里假设输入来自可信的 LLM）
      if (translationEl) {
        const contentEl = translationEl.querySelector('.select-ask-translation-content');
        if (contentEl) {
          const htmlContent = await marked(fullTranslation) as string;
          contentEl.innerHTML = htmlContent;
        }
        // 滚动到译文可见
        translationEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }

    // 流式完成，动态判断是否需要切换模式
    if (translationEl && fullTranslation.trim()) {
      // 使用 detectInlineMode 动态判断
      const shouldBeInline = detectInlineMode(targetParagraph, text, fullTranslation);

      // 如果当前模式与应该使用的模式不同，切换 translationEl 的类名
      if (shouldBeInline !== isInline) {
        translationEl.classList.remove(isInline ? 'inline' : 'block');
        translationEl.classList.add(shouldBeInline ? 'inline' : 'block');
      }
    }

    TranslationManager.update(translationId, { streamCompleted: true });

    // 打印完整译文
    if (fullTranslation.trim()) {
      console.log('[翻译译文]:', fullTranslation);
    }

  } catch (error) {
    console.error('[翻译失败]:', error instanceof Error ? error.message : error);
    // 翻译失败，移除 loading 并显示错误
    loadingEl.remove();
    if (!tempEntry.isVisible && translationEl) {
      const contentEl = translationEl.querySelector('.select-ask-translation-content');
      if (contentEl) {
        contentEl.textContent = `翻译失败：${error instanceof Error ? error.message : String(error)}`;
      }
    }
  }
}

export interface TranslateMultipleParagraphsDeps {
  generateTranslationId: (text: string) => string;
  insertTranslation: (paragraph: HTMLElement, translationId: string, isInline: boolean, originalText: string, range?: Range) => { translationEl: HTMLElement; wrapper: HTMLElement; container: HTMLElement; separatorNode?: Text };
  insertLoadingAtEnd: (paragraph: HTMLElement, isInline?: boolean, range?: Range) => { loadingEl: HTMLElement; container: HTMLElement; separatorNode?: Text };
  TranslationManager: typeof import('../translation/manager').TranslationManager;
  setupTranslationInteraction: (translationEl: HTMLElement, entryId: string) => void;
  setupSourceElementInteraction: (paragraph: HTMLElement, translationId: string) => void;
  detectInlineMode: (sourceElement: HTMLElement, sourceText: string, translatedText: string) => boolean;
  shouldUseInlineMode: (text: string) => boolean;
  getTextInElementRange: (range: Range, element: HTMLElement) => string;
}

/**
 * 翻译多个段落
 * 参照沉浸式翻译实现：多段文本合并为一个请求，用分隔符分隔
 * 翻译完成后按分隔符拆分结果
 */
export async function translateMultipleParagraphs(
  paragraphs: HTMLElement[],
  range: Range,
  deps: TranslateMultipleParagraphsDeps
): Promise<void> {
  const { generateTranslationId, insertTranslation, insertLoadingAtEnd, TranslationManager, setupTranslationInteraction, setupSourceElementInteraction, detectInlineMode, shouldUseInlineMode, getTextInElementRange } = deps;
  const { streamTranslate } = await import('../../services/content-llm');
  const { marked } = await import('marked');

  // 限制最大段落数量，防止过多请求
  const MAX_PARAGRAPHS = 100;
  let targetParagraphs = paragraphs;

  if (paragraphs.length > MAX_PARAGRAPHS) {
    console.warn('Too many paragraphs detected, using first', MAX_PARAGRAPHS);
    targetParagraphs = paragraphs.slice(0, MAX_PARAGRAPHS);
  }

  // 提取每段在选区内的文本（只提取被选中的文本，不包括嵌套子元素）
  const paragraphTexts: string[] = [];
  for (let i = 0; i < targetParagraphs.length; i++) {
    const p = targetParagraphs[i];
    let text = getTextInElementRange(range, p);
    // 过滤空段落
    if (text) {
      paragraphTexts.push(text);
    }
  }

  // 为每个段落创建加载状态（inline loading）
  const loadingEntries: Array<{
    paragraph: HTMLElement;
    paragraphIdx: number;
    translationId: string;
    loadingEl: HTMLElement;
    container: HTMLElement;
    originalText: string;
    // 翻译完成后填充
    translationEl?: HTMLElement;
  }> = [];

  for (let i = 0; i < targetParagraphs.length; i++) {
    const paragraph = targetParagraphs[i];
    const originalText = paragraphTexts[i] || '';
    if (!originalText) continue;

    const translationId = generateTranslationId('loading-' + i);

    // 在段落内部插入 inline loading（行内显示）
    // 多段落翻译时，loading 应该显示在每个段落内部，而不是段落后面
    const { loadingEl, container } = insertLoadingAtEnd(paragraph, true);

    loadingEntries.push({
      paragraph,
      paragraphIdx: i,
      translationId,
      loadingEl,
      container,
      originalText,
    });
  }

  // 合并多段文本为一个请求（使用 \n\n 分隔，让大模型知道段落边界）
  const combinedText = paragraphTexts.join('\n\n');

  // 打印翻译请求的原文（合并后的）
  console.log('[翻译原文]:', combinedText.substring(0, 500) + (combinedText.length > 500 ? '...' : ''));

  try {
    let fullResponse = '';
    let isReasoning = false;

    // 发起单次翻译请求
    for await (const chunk of streamTranslate(combinedText)) {
      if (chunk === '[REASONING]') {
        isReasoning = true;
        continue;
      }
      if (chunk === '[REASONING_DONE]') {
        isReasoning = false;
        continue;
      }
      if (isReasoning) continue;

      fullResponse += chunk;
    }

    // 打印完整译文
    if (fullResponse.trim()) {
      console.log('[翻译译文]:', fullResponse.substring(0, 500) + (fullResponse.length > 500 ? '...' : ''));
    }

    // 尝试按双换行符拆分翻译结果（因为原文是用 \n\n 分隔的）
    // 先尝试按 \n\n 拆分，如果段数不匹配，再尝试按句子拆分
    let translatedSegments = fullResponse.split(/\n\n+/).map(s => s.trim()).filter(s => s.length > 0);

    console.log('[段落数]', `原文:${paragraphTexts.length} 段，译文:${translatedSegments.length} 段`);

    // 详细日志：原文段落
    paragraphTexts.forEach((t, i) => {
      console.log(`[原文段落 ${i}]:`, t.substring(0, 100) + (t.length > 100 ? '...' : ''));
    });

    // 详细日志：译文段落
    translatedSegments.forEach((t, i) => {
      console.log(`[译文段落 ${i}]:`, t.substring(0, 100) + (t.length > 100 ? '...' : ''));
    });

    // 如果译文段数与原文段数不匹配，需要重新分配
    if (translatedSegments.length !== loadingEntries.length) {
      console.warn('[翻译段数不匹配] 原文段落:', loadingEntries.length, '译文段落:', translatedSegments.length);

      // 如果译文段数多于原文段数，合并多余的段
      if (translatedSegments.length > loadingEntries.length) {
        const ratio = translatedSegments.length / loadingEntries.length;
        const newSegments: string[] = [];
        for (let i = 0; i < loadingEntries.length; i++) {
          const start = Math.floor(i * ratio);
          const end = Math.floor((i + 1) * ratio);
          newSegments.push(translatedSegments.slice(start, end).join(' '));
        }
        translatedSegments = newSegments;
      }
      // 如果译文段数少于原文段数，将译文平均分配或重复使用
      else if (translatedSegments.length < loadingEntries.length) {
        if (translatedSegments.length === 1) {
          // 只有一段译文，所有段落都使用这一段
          translatedSegments = Array(loadingEntries.length).fill(translatedSegments[0]);
        } else {
          // 按比例分配
          const newSegments: string[] = [];
          const ratio = loadingEntries.length / translatedSegments.length;
          for (let i = 0; i < loadingEntries.length; i++) {
            const segmentIdx = Math.min(Math.floor(i / ratio), translatedSegments.length - 1);
            newSegments.push(translatedSegments[segmentIdx]);
          }
          translatedSegments = newSegments;
        }
      }
    }

    // 为每段创建译文容器
    for (let i = 0; i < loadingEntries.length; i++) {
      const loadingEntry = loadingEntries[i];
      const translationText = translatedSegments[i] || '';

      console.log(`[插入译文 ${i}/${loadingEntries.length}]`, `段落原文:"${loadingEntry.originalText.substring(0, 50)}..." -> 译文:"${translationText.substring(0, 50)}..."`);

      // 移除 loading
      loadingEntry.loadingEl.remove();

      // 动态判断使用行内还是块级模式
      const isInline = translationText
        ? detectInlineMode(loadingEntry.paragraph, loadingEntry.originalText, translationText)
        : shouldUseInlineMode(loadingEntry.originalText);

      // 创建正式的译文容器
      const translationId = loadingEntry.translationId;
      const result = insertTranslation(loadingEntry.paragraph, translationId, isInline, loadingEntry.originalText, undefined);

      loadingEntry.translationEl = result.translationEl;

      // 设置交互
      setupTranslationInteraction(result.translationEl, translationId);

      // 渲染译文
      const contentEl = result.translationEl.querySelector('.select-ask-translation-content');
      if (contentEl) {
        if (translationText && translationText.trim()) {
          contentEl.innerHTML = await marked(translationText) as string;
        } else {
          contentEl.innerHTML = '<span class="select-ask-translation-error">翻译失败</span>';
        }
      }

      // 更新 TranslationManager 中的条目
      const entry = TranslationManager.get(translationId);
      if (entry) {
        entry.streamCompleted = true;
      }
    }
  } catch (error) {
    console.error('[翻译失败]:', error instanceof Error ? error.message : error);
    // 翻译失败，移除所有 loading 并显示错误
    for (const loadingEntry of loadingEntries) {
      loadingEntry.loadingEl.remove();
      const contentEl = loadingEntry.container.querySelector('.select-ask-translation-content');
      if (contentEl) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        contentEl.textContent = `翻译失败：${errorMessage}`;
        contentEl.classList.add('select-ask-translation-error');
      }
    }
  }
}
