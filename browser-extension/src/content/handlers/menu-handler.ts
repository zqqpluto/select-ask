import { restoreSelectionRange } from '../utils/selection';
import { getTranslationMode } from '../../utils/config-manager';

export interface MenuHandlerOptions {
  showResponseInSidebar: (title: string, text: string, context: any, summaryPrompt?: string) => Promise<void>;
  showFloatingTranslation: (text: string, context: any) => Promise<void>;
  showInPlaceTranslation: (text: string, context: any) => Promise<void>;
  handleMindMapFromSelection: () => Promise<void>;
  selectionData: { text: string; context: any } | null;
}

/**
 * 处理菜单动作
 */
export async function handleMenuAction(
  action: string,
  opts: MenuHandlerOptions
): Promise<void> {
  if (!opts.selectionData) {
    console.error('ERROR: currentSelectionData is null!');
    return;
  }

  const { text, context } = opts.selectionData;

  restoreSelectionRange();

  const titles: Record<string, string> = {
    'explain': '解释',
    'translate': '翻译',
    'question': '提问',
    'summarize': '总结页面',
    'search': '搜索',
  };

  const title = titles[action] || action;

  if (action === 'question') {
    // 提问功能已删除
  } else if (action === 'summarize') {
    const summaryPrompt = `请对以下选中的内容进行简明总结，提取核心要点和关键信息：\n\n${text}`;
    await opts.showResponseInSidebar('总结', '总结', context, summaryPrompt);
  } else if (action === 'translate') {
    const translationMode = await getTranslationMode();
    console.log('[翻译原文]:', text);

    if (translationMode === 'floating') {
      await opts.showFloatingTranslation(text, context);
    } else if (translationMode === 'inline') {
      await opts.showInPlaceTranslation(text, context);
    } else {
      await opts.showResponseInSidebar(title, text, context);
    }
  } else if (action === 'explain') {
    await opts.showResponseInSidebar(title, text, context);
  } else if (action === 'search') {
    await opts.showResponseInSidebar(title, text, context);
  } else if (action === 'mindmap') {
    await opts.handleMindMapFromSelection();
  }
}
