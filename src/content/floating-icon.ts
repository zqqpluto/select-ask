/**
 * 右侧悬浮图标 + 菜单 — 入口文件
 *
 * 职责：创建/缓存悬浮图标实例，绑定事件，提供公共 API。
 * DOM 拖拽在 components/floating-icon.ts，菜单项在 components/floating-menu.ts。
 *
 * 设计：
 * - 胶囊容器：btn 即胶囊，overflow:hidden + border-radius:19px
 * - 收起时：高度38px，overflow 隐藏菜单，只显示圆形 logo
 * - 展开时：高度自适应，菜单在 logo 下方露出，整体是完整胶囊
 * - 锚点：top:0 + transform:translateY 实现向下展开
 * - 主按钮：项目 Logo
 * - 关闭按钮：胶囊左上角外侧，不受 overflow 裁切
 */

import {
  createFloatingIconDOM,
  type FloatingIconDOM,
} from './components/floating-icon';
import {
  buildTranslateMenuItem,
  buildSummarizeMenuItem,
  buildMindMapMenuItem,
  buildHistoryMenuItem,
  buildTranslateIcon,
  type FloatingMenuOptions,
} from './components/floating-menu';

export interface FloatingIconOptions {
  onFullPageTranslate: () => void;
  onRestore?: () => void;
  onToggleFullPageTranslate?: () => void;
  onSummarizePage?: () => void;
  onMindMapPage?: () => void;
  onClickIcon?: () => void;
  isTranslating?: boolean;
  onHideMenu?: () => void;
}

// ========== 实例级状态 ==========
let floatingIconEl: HTMLElement | null = null;
let hoverTimer: ReturnType<typeof setTimeout> | null = null;
let leaveTimer: ReturnType<typeof setTimeout> | null = null;
let isDragging = false;
let dom: FloatingIconDOM | null = null;

/**
 * 创建悬浮图标实例
 */
export function createFloatingIcon(options: FloatingIconOptions): HTMLElement {
  if (floatingIconEl) return floatingIconEl;

  dom = createFloatingIconDOM(
    { get current() { return isDragging; } },
    {
      get current() { return hoverTimer; },
      set current(v) { hoverTimer = v; },
    },
    {
      get current() { return leaveTimer; },
      set current(v) { leaveTimer = v; },
    },
    () => {
      floatingIconEl = null;
      dom = null;
    },
    options.onClickIcon
  );

  const { container, btn, menu, closeBtn, showMenu, hideMenu } = dom;

  // 填充菜单项
  const translateItem = buildTranslateMenuItem(options as FloatingMenuOptions);
  const summarizeItem = buildSummarizeMenuItem(options as FloatingMenuOptions, hideMenu);
  const mindMapItem = buildMindMapMenuItem(options as FloatingMenuOptions, hideMenu);
  const historyItem = buildHistoryMenuItem(hideMenu);

  menu.appendChild(translateItem);
  menu.appendChild(summarizeItem);
  menu.appendChild(mindMapItem);
  menu.appendChild(historyItem);

  // 点击图标打开侧边栏 — 在 setupDrag 的 onPointerUp 中通过回调触发

  // btn hover
  btn.addEventListener('mouseenter', showMenu);
  btn.addEventListener('mouseleave', hideMenu);

  // 菜单 hover
  menu.addEventListener('mouseenter', () => {
    if (leaveTimer) { clearTimeout(leaveTimer); leaveTimer = null; }
  });
  menu.addEventListener('mouseleave', hideMenu);

  // 阻止菜单展开时 pointerdown 冒泡到 btn
  menu.addEventListener('pointerdown', (e) => {
    if (btn.classList.contains('active')) e.stopPropagation();
  });

  // 关闭按钮 hover
  closeBtn.addEventListener('mouseenter', () => {
    if (leaveTimer) { clearTimeout(leaveTimer); leaveTimer = null; }
  });
  closeBtn.addEventListener('mouseleave', hideMenu);

  // 翻译菜单点击
  if (translateItem) {
    translateItem.addEventListener('click', (e) => {
      e.stopPropagation();
      hideMenu();
      options.onToggleFullPageTranslate?.();
    });
  }

  // 初始状态
  refreshMenuState();

  function refreshMenuState() {
    if (!translateItem) return;
    const isTranslating = options.isTranslating ?? false;
    translateItem.setAttribute('data-icon', isTranslating ? 'stop-translate' : 'translate');
    translateItem.setAttribute('data-tooltip', isTranslating ? '停止翻译' : '翻译全文');

    const oldSvg = translateItem.querySelector('svg');
    if (oldSvg) oldSvg.remove();
    const newIcon = buildTranslateIcon(isTranslating ? 'stop-translate' : 'translate');
    if (newIcon) translateItem.appendChild(newIcon);
  }

  (container as any).__refreshMenuState = refreshMenuState;

  floatingIconEl = container;
  return container;
}

/**
 * 更新菜单状态（用于翻译状态切换后刷新图标）
 */
export function updateMenuState(): void {
  if (!floatingIconEl) return;
  const refreshFn = (floatingIconEl as any).__refreshMenuState;
  if (refreshFn) refreshFn();
}

export function destroyFloatingIcon(): void {
  if (floatingIconEl) {
    floatingIconEl.remove();
    floatingIconEl = null;
  }
  dom = null;
  if (hoverTimer) clearTimeout(hoverTimer);
  if (leaveTimer) clearTimeout(leaveTimer);
  hoverTimer = null;
  leaveTimer = null;
  isDragging = false;
}

export function getFloatingIcon(): HTMLElement | null {
  return floatingIconEl;
}

// Re-export for direct module access
export { dragThreshold } from './components/floating-icon';
