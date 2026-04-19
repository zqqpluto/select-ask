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

    const truncatedContent = truncateContent(extractedContent.content, 6000);
    const prompt = `请将以下内容整理为层级化 Markdown 脑图格式。要求：
1. 使用 ## 作为一级标题，### 作为二级标题，#### 作为三级标题
2. 使用 - 列表项表示子节点
3. 结构清晰，层次分明
4. 提取核心要点，不要遗漏重要信息

内容：
${truncatedContent}`;

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
  const prompt = `请将以下内容整理为层级化 Markdown 脑图格式。要求：
1. 使用 ## 作为一级标题，### 作为二级标题，#### 作为三级标题
2. 使用 - 列表项表示子节点
3. 结构清晰，层次分明
4. 提取核心要点，不要遗漏重要信息

内容：
${text}`;

  options.openSidePanel({
    selectedText: '',
    context: null,
    userMessage: '生成脑图',
    summaryPrompt: prompt,
    pageUrl: window.location.href,
    pageTitle: document.title,
  });
}
