/**
 * 右侧悬浮图标 + 菜单
 * 支持拖拽（上下移动）、hover 弹出子菜单、翻译全文切换
 *
 * 设计（参照豆包）：
 * - 外层：position:fixed + right:0 + bottom:0，始终固定到屏幕右下角
 * - 垂直位置：用 transform: translate3d(0, Y, 0) 控制，Y 为负值向上移动
 * - 拖拽只影响 Y 轴，松手后 Y 值持久化（比例值存到 localStorage）
 * - 主按钮：项目 Logo
 * - hover 时：右下角弹出关闭按钮 + 下方子菜单（图标按钮）
 */

const ICON_Z_INDEX = 2147483646;
let floatingIconEl: HTMLElement | null = null;
let hoverTimer: ReturnType<typeof setTimeout> | null = null;
let leaveTimer: ReturnType<typeof setTimeout> | null = null;

// 拖拽状态 - 防止拖拽中触发 hover 菜单
let isDragging = false;

// 持久化位置：0~1 的比例值，0 = 屏幕顶部，1 = 屏幕底部
const STORAGE_KEY = 'floatingIconTopRatio';
let savedRatio: number = 0.5; // 默认居中

export interface FloatingIconOptions {
  onFullPageTranslate: () => void;
  onRestore?: () => void;
  onToggleFullPageTranslate?: () => void; // 切换全文翻译
  onSummarizePage?: () => void; // 总结页面
  isTranslating?: boolean; // 是否正在翻译
}

/** 读取持久化比例 */
function loadRatio(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const v = parseFloat(raw);
      if (!isNaN(v) && v >= 0 && v <= 1) return v;
    }
  } catch { /* ignore */ }
  return 0.5;
}

/** 保存比例到 localStorage */
function saveRatio(ratio: number) {
  try {
    localStorage.setItem(STORAGE_KEY, String(ratio));
  } catch { /* ignore */ }
}

/** 比例 → 像素 Y 偏移（负值 = 向上） */
function ratioToPixel(ratio: number): number {
  return -(ratio * window.innerHeight);
}

/** 像素 Y 偏移 → 比例 */
function pixelToRatio(px: number): number {
  return -px / window.innerHeight;
}

export function createFloatingIcon(options: FloatingIconOptions): HTMLElement {
  if (floatingIconEl) return floatingIconEl;

  savedRatio = loadRatio();

  const container = document.createElement('div');
  container.className = 'select-ask-floating-icon';
  container.style.zIndex = String(ICON_Z_INDEX);

  // 初始垂直位置：从持久化比例计算
  const initY = ratioToPixel(savedRatio);
  container.style.transform = `translate3d(0, ${initY}px, 0)`;

  // 统一卡片容器（iOS 风格）
  const card = document.createElement('div');
  card.className = 'select-ask-floating-icon-card';

  // 主按钮 - 使用项目 logo
  const btn = document.createElement('button');
  btn.className = 'select-ask-floating-icon-btn';
  btn.title = 'Select Ask';
  btn.appendChild(buildLogoImg());
  card.appendChild(btn);

  // 关闭按钮（logo 按钮内部左上角）
  const closeBtn = document.createElement('button');
  closeBtn.className = 'select-ask-floating-icon-close';
  closeBtn.title = '关闭';
  const closeSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  closeSvg.setAttribute('width', '12');
  closeSvg.setAttribute('height', '12');
  closeSvg.setAttribute('viewBox', '0 0 24 24');
  closeSvg.setAttribute('fill', 'none');
  closeSvg.setAttribute('stroke', 'currentColor');
  closeSvg.setAttribute('stroke-width', '3');
  closeSvg.setAttribute('stroke-linecap', 'round');
  closeSvg.setAttribute('stroke-linejoin', 'round');
  const line1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line1.setAttribute('x1', '18'); line1.setAttribute('y1', '6');
  line1.setAttribute('x2', '6'); line1.setAttribute('y2', '18');
  const line2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line2.setAttribute('x1', '6'); line2.setAttribute('y1', '6');
  line2.setAttribute('x2', '18'); line2.setAttribute('y2', '18');
  closeSvg.appendChild(line1);
  closeSvg.appendChild(line2);
  closeBtn.appendChild(closeSvg);
  closeBtn.addEventListener('click', () => {
    container.remove();
    floatingIconEl = null;
  });
  btn.appendChild(closeBtn);

  // 分隔线
  const divider = document.createElement('div');
  divider.className = 'select-ask-floating-icon-divider';
  card.appendChild(divider);

  // 子菜单容器
  const menu = document.createElement('div');
  menu.className = 'select-ask-floating-icon-menu';
  menu.appendChild(buildTranslateMenuItem(options));
  menu.appendChild(buildSummarizeMenuItem(options));
  card.appendChild(menu);

  container.appendChild(card);

  // ========== 拖拽逻辑（参照豆包：只拖 Y 轴） ==========
  setupDrag(container, btn);

  // ========== hover 显示/隐藏 ==========
  function showMenu() {
    if (isDragging) return;
    if (leaveTimer) { clearTimeout(leaveTimer); leaveTimer = null; }
    hoverTimer = setTimeout(() => {
      menu.classList.add('visible');
      closeBtn.classList.add('visible');
      divider.classList.add('visible');
      btn.classList.add('active');
    }, 200);
  }

  function hideMenu() {
    if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null; }
    leaveTimer = setTimeout(() => {
      menu.classList.remove('visible');
      closeBtn.classList.remove('visible');
      divider.classList.remove('visible');
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

    // 更新图标
    const oldSvg = translateItem.querySelector('svg');
    if (oldSvg) oldSvg.remove();
    const newIcon = buildTranslateIcon(isTranslating ? 'stop-translate' : 'translate');
    if (newIcon) translateItem.appendChild(newIcon);
  }

  // 暴露刷新方法
  (container as any).__refreshMenuState = refreshMenuState;

  floatingIconEl = container;
  return container;
}

// ========== 拖拽阈值判断（参照豆包 aB 对象） ==========
const dragThreshold = {
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
    // 移动距离 > 6px 且时间 > 300ms 才算拖拽
    return Math.sqrt(dx * dx + dy * dy) > this.threshold && Date.now() - this.startT > 300;
  },
};

/**
 * 设置拖拽：支持任意方向（XY 双向）拖动
 *
 * 核心思路：
 * - container：CSS position:fixed + right:0 + bottom:0
 * - 拖拽时：用 translate3d(X, Y, 0) 控制偏移
 * - Y 为负值 = 向上移动，X 为负值 = 向左移动
 * - 松手后：X 回弹到 0（紧贴右侧），Y 持久化保存
 */
function setupDrag(container: HTMLElement, btn: HTMLElement) {
  let currentX = 0; // 当前 X 偏移
  let currentY = ratioToPixel(savedRatio); // 当前 Y 偏移
  let isPointerDown = false;
  let dragOffsetX = 0; // pointer 与 currentX 的差值
  let dragOffsetY = 0; // pointer 与 currentY 的差值

  function setPos(x: number, y: number, transition?: string) {
    // X 轴范围：-(window.innerWidth - 38) ~ 0
    const minX = -(window.innerWidth - 38);
    const maxX = 0;
    // Y 轴范围：-(window.innerHeight) + 42 ~ 0
    const minY = -window.innerHeight + 42;
    const maxY = 0;
    const clampedX = Math.max(minX, Math.min(maxX, x));
    const clampedY = Math.max(minY, Math.min(maxY, y));
    container.style.transition = transition ?? 'none';
    container.style.transform = `translate3d(${clampedX}px, ${clampedY}px, 0)`;
    currentX = clampedX;
    currentY = clampedY;
  }

  function onPointerDown(e: PointerEvent) {
    if (e.button !== 0) return;
    if (e.target !== btn) return;

    isPointerDown = true;
    dragOffsetX = e.clientX - currentX;
    dragOffsetY = e.clientY - currentY;

    // 记录拖拽阈值起点
    dragThreshold.start(e.clientX, e.clientY);

    btn.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent) {
    if (!isPointerDown) return;

    const newX = e.clientX - dragOffsetX;
    const newY = e.clientY - dragOffsetY;
    setPos(newX, newY);

    // 判断是否超过拖拽阈值
    const isValidDrag = dragThreshold.isValid(e.clientX, e.clientY);
    if (isValidDrag) {
      isDragging = true;
    }
  }

  function onPointerUp(e: PointerEvent) {
    if (!isPointerDown) return;
    isPointerDown = false;

    // 判断是点击还是拖拽（移动 < 4px = 点击）
    const moveX = Math.abs(e.clientX - dragThreshold.startX);
    const moveY = Math.abs(e.clientY - dragThreshold.startY);
    const isClick = moveX <= 4 && moveY <= 4;

    if (isClick) {
      isDragging = false;
      return;
    }

    // 拖拽结束：保存 Y 比例值
    const ratio = pixelToRatio(currentY);
    savedRatio = ratio;
    saveRatio(savedRatio);

    // X 回弹到 0（紧贴右侧），Y 保持当前位置
    // 添加平滑回弹动画
    setPos(0, currentY, 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)');

    requestAnimationFrame(() => {
      isDragging = false;
    });
  }

  function onPointerCancel() {
    if (!isPointerDown) return;
    isPointerDown = false;
    isDragging = false;
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
function buildLogoImg(): HTMLImageElement {
  const img = document.createElement('img');
  img.src = chrome.runtime.getURL('public/icons/icon48.png');
  img.alt = 'Select Ask';
  img.className = 'select-ask-floating-icon-logo';
  img.draggable = false;
  return img;
}

/**
 * 构建翻译菜单项 - 纯图标按钮
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
 * 构建总结页面菜单项 - 纯图标按钮
 */
function buildSummarizeMenuItem(options: FloatingIconOptions): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.className = 'select-ask-floating-icon-menu-item';
  btn.setAttribute('data-action', 'summarize-page');
  btn.title = '总结页面';

  const icon = buildSummarizeIcon();
  if (icon) btn.appendChild(icon);

  btn.addEventListener('click', () => {
    hideMenu();
    options.onSummarizePage?.();
  });

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

/**
 * 构建总结图标 SVG
 */
function buildSummarizeIcon(): SVGSVGElement | null {
  const svg = createSvg('20', '20', '0 0 24 24');
  appendSvgPath(svg, 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z');
  appendSvgPath(svg, 'M14 2v6h6');
  appendSvgPath(svg, 'M16 13H8');
  appendSvgPath(svg, 'M16 17H8');
  appendSvgPath(svg, 'M10 9H8');
  return svg;
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
