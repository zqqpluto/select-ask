import { extractMainContent, truncateContent, generateSummaryPrompt } from '../utils/content-extractor';

/**
 * 页面总结处理回调接口
 */
export interface SummaryHandlerOptions {
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
}

/**
 * 显示页面总结 - 通过 Side Panel 展示
 */
export async function showPageSummary(options: SummaryHandlerOptions): Promise<void> {
  try {
    const extractedContent = extractMainContent();
    if (!extractedContent.content || extractedContent.content.trim().length < 10) {
      console.warn('[页面总结] 页面内容太少');
      options.showToast('当前页面内容太少，无法总结');
      return;
    }

    const truncatedContent = truncateContent(extractedContent.content, 6000);
    const summaryPrompt = generateSummaryPrompt({
      ...extractedContent,
      content: truncatedContent,
    });

    // 通过 Side Panel 展示总结
    options.openSidePanel({
      selectedText: '',
      context: null,
      userMessage: '总结页面',
      summaryPrompt: summaryPrompt,
      pageUrl: window.location.href,
      pageTitle: extractedContent.title || document.title,
    });
  } catch (error) {
    console.error('Failed to generate page summary:', error);
    alert('生成页面总结失败: ' + (error instanceof Error ? error.message : String(error)));
  }
}
