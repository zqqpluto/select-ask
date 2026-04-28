import { extractMainContent, truncateContent } from '../utils/content-extractor';

/**
 * 脑图处理回调接口
 */
export interface MindMapHandlerOptions {
  /** 显示 toast 提示 */
  showToast: (message: string, type?: string) => void;
  /** 打开侧边栏的回调 */
  openSidePanel: (params: {
    selectedText: string;
    context: null;
    userMessage: string;
    summaryPrompt: string;
    pageUrl: string;
    pageTitle: string;
  }) => void;
  /** 当前选中文本数据 */
  selectionData: { text: string } | null;
}

/**
 * 基于页面全文生成脑图
 */
export async function handleMindMapFromPage(options: MindMapHandlerOptions): Promise<void> {
  try {
    const extractedContent = extractMainContent();
    if (!extractedContent.content || extractedContent.content.trim().length < 10) {
      options.showToast('当前页面内容太少，无法生成脑图');
      return;
    }

    const truncatedContent = truncateContent(extractedContent.content, 100000);
    const prompt = `将以下内容整理为思维导图（Markdown 格式）：\n"""\n${truncatedContent}\n"""`;

    options.openSidePanel({
      selectedText: '',
      context: null,
      userMessage: '生成脑图',
      summaryPrompt: prompt,
      pageUrl: window.location.href,
      pageTitle: extractedContent.title || document.title,
    });
  } catch (error) {
    console.error('[脑图] 生成失败:', error);
    options.showToast('生成脑图失败: ' + (error instanceof Error ? error.message : String(error)));
  }
}

/**
 * 基于选中文本生成脑图
 */
export async function handleMindMapFromSelection(options: MindMapHandlerOptions): Promise<void> {
  if (!options.selectionData) return;

  const { text } = options.selectionData;
  const prompt = `将以下内容整理为思维导图（Markdown 格式）：\n"""\n${text}\n"""`;

  options.openSidePanel({
    selectedText: '',
    context: null,
    userMessage: '生成脑图',
    summaryPrompt: prompt,
    pageUrl: window.location.href,
    pageTitle: document.title,
  });
}
