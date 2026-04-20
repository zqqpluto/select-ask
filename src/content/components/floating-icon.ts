/**
 * 悬浮图标 DOM 创建、拖拽、显示/隐藏、淡入淡出动画
 */

import { ratioToPixel, pixelToRatio, loadRatio, saveRatio } from '../utils/floating-position';
import { createSvg } from '../utils/svg-helpers';

const ICON_Z_INDEX = 2147483646;

// ========== 拖拽阈值判断 ==========
export const dragThreshold = {
  startX: 0,
  startY: 0,
  threshold: 6,
  startT: 0,
  start(x: number, y: number) {
    this.startX = x;
    this.startY = y;
    this.startT = Date.now();
  },
  isValid(x: number, y: number): boolean {
    const dx = x - this.startX;
    const dy = y - this.startY;
    return Math.sqrt(dx * dx + dy * dy) > this.threshold;
  },
};

/**
 * 设置拖拽：Y 轴拖动
 *
 * 核心思路：
 * - container：CSS position:fixed + right:0 + top:0
 * - 拖拽时：translate3d(X, Y, 0) 控制偏移
 * - Y 为正数 = 向下移动
 * - 松手后：X 回弹到 0（紧贴右侧），Y 持久化保存
 */
export function setupDrag(
  container: HTMLElement,
  btn: HTMLElement,
  logoWrap: HTMLElement,
  closeBtn: HTMLElement,
  onClick?: () => void
) {
  let currentX = 0;
  let currentY = ratioToPixel(loadRatio());
  let isPointerDown = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  function setPos(x: number, y: number, transition?: string) {
    const minX = -(window.innerWidth - 40);
    const maxX = -3;
    const minY = 0;
    const maxY = window.innerHeight - 42;
    const clampedX = Math.max(minX, Math.min(maxX, x));
    const clampedY = Math.max(minY, Math.min(maxY, y));
    container.style.transition = transition ?? 'none';
    container.style.transform = `translate3d(${clampedX}px, ${clampedY}px, 0)`;
    currentX = clampedX;
    currentY = clampedY;
  }

  function onPointerDown(e: PointerEvent) {
    if (e.button !== 0) return;
    // 只允许从 logo 区域触发拖拽，菜单区域不参与拖拽
    const target = e.target as Node;
    if (target !== btn && target !== logoWrap && !logoWrap.contains(target)) return;

    isPointerDown = true;
    dragOffsetX = e.clientX - currentX;
    dragOffsetY = e.clientY - currentY;

    dragThreshold.start(e.clientX, e.clientY);

    // 立即关闭可能弹出的菜单，避免拖拽或点击时被菜单拦截
    btn.classList.remove('active');
    btn.style.overflow = '';
    closeBtn.classList.remove('visible');
  }

  function onPointerMove(e: PointerEvent) {
    if (!isPointerDown) return;

    const newX = e.clientX - dragOffsetX;
    const newY = e.clientY - dragOffsetY;
    setPos(newX, newY);

    if (dragThreshold.isValid(e.clientX, e.clientY)) {
      // Don't use setPointerCapture — it can steal pointer events and break click detection
    }
  }

  function onPointerUp(e: PointerEvent) {
    if (!isPointerDown) return;
    isPointerDown = false;

    const moveX = Math.abs(e.clientX - dragThreshold.startX);
    const moveY = Math.abs(e.clientY - dragThreshold.startY);
    const isClick = moveX <= 4 && moveY <= 4;

    if (isClick) {
      onClick?.();
      return;
    }

    const ratio = pixelToRatio(currentY);
    saveRatio(ratio);

    setPos(-3, currentY, 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)');
  }

  function onPointerCancel() {
    if (!isPointerDown) return;
    isPointerDown = false;
    setPos(currentX, currentY);
  }

  btn.addEventListener('pointerdown', onPointerDown);
  document.addEventListener('pointermove', onPointerMove);
  document.addEventListener('pointerup', onPointerUp);
  document.addEventListener('pointercancel', onPointerCancel);
}

/**
 * 构建 Logo 图片
 */
export function buildLogoImg(): HTMLImageElement {
  const img = document.createElement('img');
  img.src = chrome.runtime.getURL('public/icons/icon48.png');
  img.alt = 'Select Ask';
  img.className = 'select-ask-floating-icon-logo';
  img.draggable = false;
  return img;
}

/** 构建关闭按钮 SVG */
function buildCloseSvg(): SVGSVGElement {
  const closeSvg = createSvg('12', '12', '0 0 24 24');
  closeSvg.setAttribute('stroke', 'currentColor');
  closeSvg.setAttribute('stroke-width', '3');
  const line1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line1.setAttribute('x1', '18'); line1.setAttribute('y1', '6');
  line1.setAttribute('x2', '6'); line1.setAttribute('y2', '18');
  const line2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line2.setAttribute('x1', '6'); line2.setAttribute('y1', '6');
  line2.setAttribute('x2', '18'); line2.setAttribute('y2', '18');
  closeSvg.appendChild(line1);
  closeSvg.appendChild(line2);
  return closeSvg;
}

export interface FloatingIconDOM {
  container: HTMLElement;
  btn: HTMLButtonElement;
  menu: HTMLDivElement;
  closeBtn: HTMLButtonElement;
  logoWrap: HTMLDivElement;
  showMenu: () => void;
  hideMenu: () => void;
}

/**
 * 创建悬浮图标 DOM 结构（container + btn + logo + close button）
 * 返回 DOM 引用和 showMenu/hideMenu 函数
 */
export function createFloatingIconDOM(
  isDraggingRef: { current: boolean },
  hoverTimerRef: { current: ReturnType<typeof setTimeout> | null },
  leaveTimerRef: { current: ReturnType<typeof setTimeout> | null },
  onContainerClose?: () => void,
  onClickIcon?: () => void
): FloatingIconDOM {
  const savedRatio = loadRatio();

  const container = document.createElement('div');
  container.className = 'select-ask-floating-icon';
  container.style.zIndex = String(ICON_Z_INDEX);

  const initY = ratioToPixel(savedRatio);
  container.style.transform = `translate3d(0, ${initY}px, 0)`;

  // ========== 胶囊容器 ==========
  const btn = document.createElement('button');
  btn.className = 'select-ask-floating-icon-btn';

  const logoWrap = document.createElement('div');
  logoWrap.className = 'select-ask-floating-icon-logo-wrap';
  logoWrap.appendChild(buildLogoImg());
  btn.appendChild(logoWrap);

  // ========== 子菜单容器（项目由调用方填充） ==========
  const menu = document.createElement('div');
  menu.className = 'select-ask-floating-icon-menu';
  btn.appendChild(menu);

  // show / hide menu with fade animation
  const hideMenu = () => {
    if (hoverTimerRef.current) { clearTimeout(hoverTimerRef.current); hoverTimerRef.current = null; }
    leaveTimerRef.current = setTimeout(() => {
      btn.classList.remove('active');
      btn.style.overflow = '';
      closeBtn.classList.remove('visible');
    }, 300);
  };

  const showMenu = () => {
    if (isDraggingRef.current) return;
    if (leaveTimerRef.current) { clearTimeout(leaveTimerRef.current); leaveTimerRef.current = null; }
    hoverTimerRef.current = setTimeout(() => {
      btn.classList.add('active');
      btn.style.overflow = 'visible';
      closeBtn.classList.add('visible');
    }, 200);
  };

  container.appendChild(btn);

  // ========== 关闭按钮 ==========
  const closeBtn = document.createElement('button');
  closeBtn.className = 'select-ask-floating-icon-close';
  closeBtn.title = '关闭';
  closeBtn.appendChild(buildCloseSvg());
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    container.remove();
    onContainerClose?.();
  });
  closeBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
  container.appendChild(closeBtn);

  // 拖拽
  setupDrag(container, btn, logoWrap, closeBtn, onClickIcon);

  // 关闭按钮 hover
  closeBtn.addEventListener('mouseenter', () => {
    if (leaveTimerRef.current) { clearTimeout(leaveTimerRef.current); leaveTimerRef.current = null; }
  });
  closeBtn.addEventListener('mouseleave', hideMenu);

  return { container, btn, menu, closeBtn, logoWrap, showMenu, hideMenu };
}
