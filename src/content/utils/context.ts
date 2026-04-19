import type { ContextData } from '../../types';

const CONTEXT_CONFIG = {
  maxLength: 500,
  breakByParagraph: true,
  breakBySentence: true,
  preserveStructure: true,
} as const;

/**
 * 获取选中文本的上下文
 */
export function getContextData(selection: Selection): ContextData | null {
  if (!selection || selection.rangeCount === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);
  const selectedText = selection.toString();

  if (!selectedText) {
    return null;
  }

  const beforeText = getBeforeText(range, CONTEXT_CONFIG.maxLength);
  const afterText = getAfterText(range, CONTEXT_CONFIG.maxLength);

  return {
    selectedText,
    beforeText,
    afterText,
  };
}

/**
 * 获取选中文本之前的上下文
 */
function getBeforeText(range: Range, maxLength: number): string {
  const startContainer = range.startContainer;
  const startOffset = range.startOffset;

  let text = '';
  let current = startContainer;

  // 向前遍历获取文本
  while (current && text.length < maxLength) {
    if (current.nodeType === Node.TEXT_NODE) {
      const nodeText = current.textContent || '';
      if (current === startContainer) {
        text = nodeText.slice(0, startOffset) + text;
      } else {
        text = nodeText + text;
      }
    }

    // 获取前一个兄弟节点
    let prevSibling = current.previousSibling;
    while (!prevSibling && current.parentElement) {
      current = current.parentElement;
      prevSibling = current.previousSibling;
    }

    if (!prevSibling) {
      break;
    }

    current = prevSibling;
  }

  // 智能边界处理
  return smartTruncate(text, maxLength);
}

/**
 * 获取选中文本之后的上下文
 */
function getAfterText(range: Range, maxLength: number): string {
  const endContainer = range.endContainer;
  const endOffset = range.endOffset;

  let text = '';
  let current = endContainer;

  // 向后遍历获取文本
  while (current && text.length < maxLength) {
    if (current.nodeType === Node.TEXT_NODE) {
      const nodeText = current.textContent || '';
      if (current === endContainer) {
        text += nodeText.slice(endOffset);
      } else {
        text += nodeText;
      }
    }

    // 获取下一个兄弟节点
    let nextSibling = current.nextSibling;
    while (!nextSibling && current.parentElement) {
      current = current.parentElement;
      nextSibling = current.nextSibling;
    }

    if (!nextSibling) {
      break;
    }

    current = nextSibling;
  }

  // 智能边界处理
  return smartTruncate(text, maxLength);
}

/**
 * 智能截断文本，优先在段落或句子边界
 */
function smartTruncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  // 尝试在段落边界截断
  const paragraphMatch = text.slice(0, maxLength).match(/(.*)\n\s*$/);
  if (paragraphMatch && paragraphMatch[1].length > maxLength * 0.5) {
    return paragraphMatch[1];
  }

  // 尝试在句子边界截断
  const sentenceMatch = text.slice(0, maxLength).match(/(.*[。！？.!?。！？])\s*$/);
  if (sentenceMatch && sentenceMatch[1].length > maxLength * 0.5) {
    return sentenceMatch[1];
  }

  // 直接截断
  return text.slice(0, maxLength);
}