import type { FloatingBoxPosition } from '../types';

const MAX_TEXT_LENGTH = 10000;

/**
 * 检查选中文本长度
 */
export function isValidSelection(selection: Selection): boolean {
  const text = selection.toString();
  // 检查文本非空且非纯空白字符
  return text.trim().length > 0 && text.length <= MAX_TEXT_LENGTH;
}

/**
 * 获取选中文本的位置信息
 */
export function getSelectionPosition(selection: Selection): { x: number; y: number; width: number; height: number } {
  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();

  return {
    x: rect.left + window.scrollX,
    y: rect.top + window.scrollY,
    width: rect.width,
    height: rect.height,
  };
}

/**
 * 计算图标菜单的最佳显示位置
 * 默认显示在选中文本结束位置的上方（鼠标结束位置）
 */
export function calculateIconPosition(selectionRect: { x: number; y: number; width: number; height: number }): { x: number; y: number } {
  const iconSize = 36;
  const padding = 4;

  // 显示在选中文本结束位置的上方居中
  let x = selectionRect.x + selectionRect.width - iconSize / 2;
  let y = selectionRect.y - iconSize - padding;

  // 检查左边界
  if (x < window.scrollX) {
    x = window.scrollX + padding;
  }

  // 检查右边界
  if (x + iconSize > window.innerWidth + window.scrollX) {
    x = window.innerWidth + window.scrollX - iconSize - padding;
  }

  // 检查上边界（如果上方空间不足，显示在下方）
  if (y < window.scrollY) {
    y = selectionRect.y + selectionRect.height + padding;
  }

  return { x, y };
}

/**
 * 移除所有图标菜单和下拉菜单
 */
export function removeIconMenus(): void {
  const menus = document.querySelectorAll('.select-ask-icon-menu, .select-ask-dropdown-menu');
  menus.forEach((menu) => menu.remove());
}

/**
 * 移除所有图标菜单（不删除下拉菜单）
 */
export function removeIconOnly(): void {
  const menus = document.querySelectorAll('.select-ask-icon-menu');
  menus.forEach((menu) => menu.remove());
}

/**
 * 移除所有下拉菜单
 */
export function removeDropdowns(): void {
  const dropdowns = document.querySelectorAll('.select-ask-dropdown-menu');
  dropdowns.forEach((dropdown) => dropdown.remove());
}