/**
 * 保存选中文本范围
 */
export function saveSelectionRange(): void {
  const selection = window.getSelection();
  if (selection && selection.rangeCount > 0) {
    savedRange = selection.getRangeAt(0).cloneRange();
  }
}

/**
 * 恢复选中文本范围
 */
export function restoreSelectionRange(): void {
  if (savedRange) {
    const selection = window.getSelection();
    try {
      const rangeNode = savedRange.startContainer;
      if (!rangeNode || !document.contains(rangeNode)) {
        console.warn('Saved range is no longer valid');
        return;
      }
      selection.removeAllRanges();
      selection.addRange(savedRange);
    } catch (e) {
      console.warn('Failed to restore selection:', e);
    }
  }
}

/**
 * 清除选中文本范围
 */
export function clearSelection(): void {
  const selection = window.getSelection();
  if (selection) {
    selection.removeAllRanges();
  }
}

// Module-level state
let savedRange: Range | null = null;

export function setSavedRange(range: Range | null): void {
  savedRange = range;
}

export function getSavedRange(): Range | null {
  return savedRange;
}
