/**
 * 右侧悬浮图标 + 菜单
 * 支持拖拽（左右移动后自动回弹）、hover 弹出图标菜单、翻译全文切换
 */

const ICON_Z_INDEX = 2147483646;
const RIGHT_MARGIN = 12; // 默认右边距 px
let floatingIconEl: HTMLElement | null = null;
let hoverTimer: ReturnType<typeof setTimeout> | null = null;
let leaveTimer: ReturnType<typeof setTimeout> | null = null;

// 拖拽状态
let isDragging = false;
let dragStartX = 0;
let dragStartLeft = 0;
let currentOffsetX = 0; // 相对于默认位置的偏移（负值=向左）

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

  // 主按钮
  const btn = document.createElement('button');
  btn.className = 'select-ask-floating-icon-btn';
  btn.title = 'Select Ask';
  btn.appendChild(buildLogoSvg());

  // 菜单
  const menu = document.createElement('div');
  menu.className = 'select-ask-floating-icon-menu';
  menu.appendChild(buildMenuItem('full-translate', options.isTranslating ?? false ? 'stop-translate' : 'translate'));
  menu.appendChild(buildMenuItem('restore', 'restore'));

  container.appendChild(btn);
  container.appendChild(menu);

  // ========== 拖拽逻辑 ==========
  setupDrag(container, btn);

  // ========== 菜单显示/隐藏 ==========
  function showMenu() {
    if (isDragging) return;
    if (leaveTimer) { clearTimeout(leaveTimer); leaveTimer = null; }
    hoverTimer = setTimeout(() => {
      menu.style.display = 'block';
      btn.classList.add('active');
    }, 200);
  }

  function hideMenu() {
    if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null; }
    leaveTimer = setTimeout(() => {
      menu.style.display = 'none';
      btn.classList.remove('active');
    }, 300);
  }

  btn.addEventListener('mouseenter', showMenu);
  btn.addEventListener('mouseleave', hideMenu);
  menu.addEventListener('mouseenter', () => {
    if (leaveTimer) { clearTimeout(leaveTimer); leaveTimer = null; }
  });
  menu.addEventListener('mouseleave', hideMenu);

  // ========== 菜单点击 ==========
  menu.addEventListener('click', (e) => {
    const item = (e.target as HTMLElement).closest('.select-ask-floating-icon-menu-item');
    if (!item) return;
    const action = item.getAttribute('data-action');
    hideMenu();
    if (action === 'full-translate') {
      options.onToggleFullPageTranslate?.();
    } else if (action === 'restore') {
      options.onRestore?.();
    }
  });

  floatingIconEl = container;
  return container;
}

/**
 * 设置拖拽：只允许水平拖拽，松手后弹性回到右侧
 */
function setupDrag(container: HTMLElement, btn: HTMLElement) {
  let startX = 0;
  let startOffsetX = 0;

  function onPointerDown(e: PointerEvent) {
    if (e.button !== 0) return;
    isDragging = true;
    startX = e.clientX;
    startOffsetX = currentOffsetX;
    container.setPointerCapture(e.pointerId);
    btn.style.transition = 'none';
    container.style.transition = 'none';
    e.preventDefault();
  }

  function onPointerMove(e: PointerEvent) {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    currentOffsetX = startOffsetX + dx;
    const maxLeft = -(window.innerWidth - 60);
    const maxRight = 0;
    currentOffsetX = Math.max(maxLeft, Math.min(maxRight, currentOffsetX));
    container.style.transform = `translateY(-50%) translateX(${currentOffsetX}px)`;
  }

  function onPointerUp() {
    if (!isDragging) return;
    isDragging = false;
    currentOffsetX = 0;
    container.style.transition = 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
    container.style.transform = 'translateY(-50%)';
    btn.style.transition = '';
  }

  btn.addEventListener('pointerdown', onPointerDown);
  btn.addEventListener('pointermove', onPointerMove);
  btn.addEventListener('pointerup', onPointerUp);
  btn.addEventListener('pointercancel', onPointerUp);
}

/**
 * 构建 Logo SVG
 */
function buildLogoSvg(): SVGSVGElement {
  const svg = createSvg('22', '22', '0 0 24 24');
  appendSvgPath(svg, 'M5 8l6 6');
  appendSvgPath(svg, 'M4 14l6-6 2-3');
  appendSvgPath(svg, 'M2 5h12');
  appendSvgPath(svg, 'M7 2h1');
  appendSvgPath(svg, 'M22 22l-5-10-5 10');
  appendSvgPath(svg, 'M14 18h6');
  return svg;
}

/**
 * 构建菜单项
 */
function buildMenuItem(action: string, iconType: string): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.className = 'select-ask-floating-icon-menu-item';
  btn.setAttribute('data-action', action);

  const titleMap: Record<string, string> = {
    'full-translate': '', // 动态设置
    'restore': '恢复原文',
  };
  btn.title = titleMap[action] || '';

  const icon = buildIconSvg(iconType);
  if (icon) {
    btn.appendChild(icon);
  }

  // 设置翻译按钮标题
  if (action === 'full-translate') {
    btn.title = '翻译全文';
  }

  return btn;
}

/**
 * 构建图标 SVG
 */
function buildIconSvg(type: string): SVGSVGElement | null {
  switch (type) {
    case 'translate':
      const tSvg = createSvg('18', '18', '0 0 24 24');
      appendSvgPath(tSvg, 'M5 8l6 6');
      appendSvgPath(tSvg, 'M4 14l6-6 2-3');
      appendSvgPath(tSvg, 'M2 5h12');
      appendSvgPath(tSvg, 'M7 2h1');
      appendSvgPath(tSvg, 'M22 22l-5-10-5 10');
      appendSvgPath(tSvg, 'M14 18h6');
      return tSvg;

    case 'stop-translate':
      const sSvg = createSvg('18', '18', '0 0 24 24');
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', '6');
      rect.setAttribute('y', '6');
      rect.setAttribute('width', '12');
      rect.setAttribute('height', '12');
      rect.setAttribute('rx', '1');
      sSvg.appendChild(rect);
      appendSvgPath(sSvg, 'M9 9v6');
      appendSvgPath(sSvg, 'M15 9v6');
      return sSvg;

    case 'restore':
      const rSvg = createSvg('18', '18', '0 0 24 24');
      appendSvgPath(rSvg, 'M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8');
      appendSvgPath(rSvg, 'M3 3v5h5');
      appendSvgPath(rSvg, 'M12 7v5l4 2');
      return rSvg;

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
  const menu = floatingIconEl.querySelector('.select-ask-floating-icon-menu');
  if (!menu) return;

  const translateItem = menu.querySelector('[data-action="full-translate"]');
  if (!translateItem) return;

  translateItem.title = isTranslating ? '停止翻译' : '翻译全文';

  // 清除旧内容
  while (translateItem.firstChild) {
    translateItem.removeChild(translateItem.firstChild);
  }

  const icon = buildIconSvg(isTranslating ? 'stop-translate' : 'translate');
  if (icon) {
    translateItem.appendChild(icon);
  }
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
