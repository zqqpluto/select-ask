/**
 * 右侧悬浮图标 + 菜单
 * 支持拖拽（左右移动后自动回弹）、hover 弹出子菜单、翻译全文切换
 * 设计：
 * - 主按钮：项目 Logo
 * - hover 时：右下角弹出关闭按钮 + 下方圆形子菜单（翻译按钮）
 */

const ICON_Z_INDEX = 2147483646;
let floatingIconEl: HTMLElement | null = null;
let hoverTimer: ReturnType<typeof setTimeout> | null = null;
let leaveTimer: ReturnType<typeof setTimeout> | null = null;

// 拖拽状态 - 防止拖拽中触发 hover 菜单
let isDragging = false;

export interface FloatingIconOptions {
  onFullPageTranslate: () => void;
  onRestore?: () => void;
  onToggleFullPageTranslate?: () => void; // 切换全文翻译
  isTranslating?: boolean; // 是否正在翻译
}

export function createFloatingIcon(options: FloatingIconOptions): HTMLElement {
  if (floatingIconEl) return floatingIconEl;

  const container = document.createElement('div');
  container.className = 'select-ask-floating-icon';
  container.style.zIndex = String(ICON_Z_INDEX);

  // 主按钮 - 使用项目 logo
  const btn = document.createElement('button');
  btn.className = 'select-ask-floating-icon-btn';
  btn.title = 'Select Ask';
  btn.appendChild(buildLogoImg());

  container.appendChild(btn);

  // 关闭按钮（hover 时出现在右下角）
  const closeBtn = document.createElement('button');
  closeBtn.className = 'select-ask-floating-icon-close';
  closeBtn.title = '关闭';
  closeBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  closeBtn.addEventListener('click', () => {
    container.remove();
    floatingIconEl = null;
  });
  container.appendChild(closeBtn);

  // 子菜单容器（在按钮下方）
  const menu = document.createElement('div');
  menu.className = 'select-ask-floating-icon-menu';
  menu.appendChild(buildTranslateMenuItem(options));
  container.appendChild(menu);

  // ========== 拖拽逻辑 ==========
  setupDrag(container, btn);

  // ========== hover 显示/隐藏 ==========
  function showMenu() {
    if (isDragging) return;
    if (leaveTimer) { clearTimeout(leaveTimer); leaveTimer = null; }
    hoverTimer = setTimeout(() => {
      menu.classList.add('visible');
      closeBtn.classList.add('visible');
      btn.classList.add('active');
    }, 200);
  }

  function hideMenu() {
    if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null; }
    leaveTimer = setTimeout(() => {
      menu.classList.remove('visible');
      closeBtn.classList.remove('visible');
      btn.classList.remove('active');
    }, 300);
  }

  // 主按钮 hover
  btn.addEventListener('mouseenter', showMenu);
  btn.addEventListener('mouseleave', hideMenu);

  // 菜单 hover
  menu.addEventListener('mouseenter', () => {
    if (leaveTimer) { clearTimeout(leaveTimer); leaveTimer = null; }
  });
  menu.addEventListener('mouseleave', hideMenu);

  // 关闭按钮 hover
  closeBtn.addEventListener('mouseenter', () => {
    if (leaveTimer) { clearTimeout(leaveTimer); leaveTimer = null; }
  });
  closeBtn.addEventListener('mouseleave', hideMenu);

  // ========== 翻译菜单点击 ==========
  const translateItem = menu.querySelector('.select-ask-floating-icon-menu-item');
  if (translateItem) {
    translateItem.addEventListener('click', () => {
      hideMenu();
      // 更新 options 中的状态，供 refreshMenuState 读取
      options.isTranslating = !options.isTranslating;
      options.onToggleFullPageTranslate?.();
      setTimeout(() => refreshMenuState(), 50);
    });
  }

  // 初始状态
  refreshMenuState();

  function refreshMenuState() {
    if (!translateItem) return;
    const isTranslating = options.isTranslating ?? false;
    translateItem.setAttribute('data-icon', isTranslating ? 'stop-translate' : 'translate');
    translateItem.title = isTranslating ? '停止翻译' : '翻译全文';

    const oldSvg = translateItem.querySelector('svg');
    if (oldSvg) oldSvg.remove();
    const newIcon = buildTranslateIcon(isTranslating ? 'stop-translate' : 'translate');
    if (newIcon) translateItem.insertBefore(newIcon, translateItem.firstChild);
  }

  // 暴露刷新方法
  (container as any).__refreshMenuState = refreshMenuState;

  floatingIconEl = container;
  return container;
}

/**
 * 设置拖拽：支持任意方向拖动，松手后弹性回到右侧垂直居中
 */
function setupDrag(container: HTMLElement, btn: HTMLElement) {
  let offsetX = 0; // 鼠标相对于图标左边缘的偏移
  let offsetY = 0; // 鼠标相对于图标上边缘的偏移
  let isPointerDown = false;

  function onPointerDown(e: PointerEvent) {
    if (e.button !== 0) return;
    isPointerDown = true;

    const rect = container.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;

    btn.style.transition = 'none';
    container.style.transition = 'none';
  }

  function onPointerMove(e: PointerEvent) {
    if (!isPointerDown) return;

    isDragging = true;
    const newLeft = e.clientX - offsetX;
    const newTop = e.clientY - offsetY;

    container.style.left = `${newLeft}px`;
    container.style.top = `${newTop}px`;
    container.style.right = 'auto';
    container.style.transform = 'none';
  }

  function onPointerUp() {
    if (!isPointerDown) return;
    isPointerDown = false;
    isDragging = false;

    // 清除 left/top，恢复 CSS 默认定位
    container.style.left = '';
    container.style.top = '';
    container.style.right = '';
    container.style.transform = '';
    // 然后添加过渡动画
    container.style.transition = 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
    container.style.right = '0';
    container.style.top = '50%';
    container.style.transform = 'translateY(-50%)';
  }

  function onPointerCancel() {
    if (!isPointerDown) return;
    isPointerDown = false;
    isDragging = false;

    container.style.left = '';
    container.style.top = '';
    container.style.right = '';
    container.style.transform = '';
    container.style.transition = 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
    container.style.right = '0';
    container.style.top = '50%';
    container.style.transform = 'translateY(-50%)';
  }

  btn.addEventListener('pointerdown', onPointerDown);
  document.addEventListener('pointermove', onPointerMove);
  document.addEventListener('pointerup', onPointerUp);
  document.addEventListener('pointercancel', onPointerCancel);
}

let currentOffsetX = 0; // deprecated, kept for compatibility

/**
 * 构建 Logo 图片
 */
function buildLogoImg(): HTMLImageElement {
  const img = document.createElement('img');
  img.src = chrome.runtime.getURL('public/icons/icon48.png');
  img.alt = 'Select Ask';
  img.className = 'select-ask-floating-icon-logo';
  img.draggable = false;
  return img;
}

/**
 * 构建翻译菜单项
 */
function buildTranslateMenuItem(options: FloatingIconOptions): HTMLButtonElement {
  const isTranslating = options.isTranslating ?? false;
  const btn = document.createElement('button');
  btn.className = 'select-ask-floating-icon-menu-item';
  btn.setAttribute('data-action', 'full-translate');
  btn.setAttribute('data-icon', isTranslating ? 'stop-translate' : 'translate');
  btn.title = isTranslating ? '停止翻译' : '翻译全文';
  const icon = buildTranslateIcon(isTranslating ? 'stop-translate' : 'translate');
  if (icon) btn.appendChild(icon);
  return btn;
}

/**
 * 构建翻译图标 SVG
 */
function buildTranslateIcon(type: string): SVGSVGElement | null {
  switch (type) {
    case 'translate': {
      const svg = createSvg('20', '20', '0 0 24 24');
      appendSvgPath(svg, 'M5 8l6 6');
      appendSvgPath(svg, 'M4 14l6-6 2-3');
      appendSvgPath(svg, 'M2 5h12');
      appendSvgPath(svg, 'M7 2h1');
      appendSvgPath(svg, 'M22 22l-5-10-5 10');
      appendSvgPath(svg, 'M14 18h6');
      return svg;
    }
    case 'stop-translate': {
      const svg = createSvg('20', '20', '0 0 24 24');
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', '6');
      rect.setAttribute('y', '6');
      rect.setAttribute('width', '12');
      rect.setAttribute('height', '12');
      rect.setAttribute('rx', '1');
      svg.appendChild(rect);
      appendSvgPath(svg, 'M9 9v6');
      appendSvgPath(svg, 'M15 9v6');
      return svg;
    }
    default:
      return null;
  }
}

function createSvg(width: string, height: string, viewBox: string): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', width);
  svg.setAttribute('height', height);
  svg.setAttribute('viewBox', viewBox);
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  return svg;
}

function appendSvgPath(svg: SVGSVGElement, d: string): void {
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', d);
  svg.appendChild(path);
}

/**
 * 更新菜单状态（用于翻译状态切换后刷新图标）
 */
export function updateMenuState(isTranslating: boolean): void {
  if (!floatingIconEl) return;
  const refreshFn = (floatingIconEl as any).__refreshMenuState;
  if (refreshFn) refreshFn();
}

export function destroyFloatingIcon(): void {
  if (floatingIconEl) {
    floatingIconEl.remove();
    floatingIconEl = null;
  }
  if (hoverTimer) clearTimeout(hoverTimer);
  if (leaveTimer) clearTimeout(leaveTimer);
}

export function getFloatingIcon(): HTMLElement | null {
  return floatingIconEl;
}
