/**
 * 右侧悬浮图标 + 菜单
 * 支持拖拽（上下移动）、hover 弹出子菜单、翻译全文切换
 *
 * 设计：
 * - 胶囊容器：btn 即胶囊，overflow:hidden + border-radius:19px
 * - 收起时：高度38px，overflow 隐藏菜单，只显示圆形 logo
 * - 展开时：高度自适应，菜单在 logo 下方露出，整体是完整胶囊
 * - 锚点：top:0 + transform:translateY 实现向下展开
 * - 主按钮：项目 Logo
 * - 关闭按钮：胶囊左上角外侧，不受 overflow 裁切
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
  onClickIcon?: () => void; // 点击图标（打开侧边栏）
  isTranslating?: boolean; // 是否正在翻译
  onHideMenu?: () => void; // 隐藏菜单回调
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

/** 比例 → 像素 Y 偏移（正数 = 向下，相对于屏幕顶部） */
function ratioToPixel(ratio: number): number {
  return ratio * (window.innerHeight - 42);
}

/** 像素 Y 偏移 → 比例 */
function pixelToRatio(px: number): number {
  return px / (window.innerHeight - 42);
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

  // ========== 胶囊容器 - btn 即胶囊 ==========
  const btn = document.createElement('button');
  btn.className = 'select-ask-floating-icon-btn';

  // Logo 区域（固定 38x38，在胶囊顶部）
  const logoWrap = document.createElement('div');
  logoWrap.className = 'select-ask-floating-icon-logo-wrap';
  logoWrap.appendChild(buildLogoImg());
  btn.appendChild(logoWrap);

  // 子菜单 - 放在 btn 内部，收起时被 overflow:hidden 隐藏
  const menu = document.createElement('div');
  menu.className = 'select-ask-floating-icon-menu';

  const hideMenu = () => {
    if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null; }
    leaveTimer = setTimeout(() => {
      btn.classList.remove('active');
      btn.style.overflow = '';
      closeBtn.classList.remove('visible');
    }, 300);
  };

  const showMenu = () => {
    if (isDragging) return;
    if (leaveTimer) { clearTimeout(leaveTimer); leaveTimer = null; }
    hoverTimer = setTimeout(() => {
      btn.classList.add('active');
      btn.style.overflow = 'visible';
      closeBtn.classList.add('visible');
    }, 200);
  };

  const historyItem = buildHistoryMenuItem(hideMenu);
  const settingsItem = buildSettingsMenuItem(hideMenu);
  menu.appendChild(buildTranslateMenuItem(options));
  menu.appendChild(buildSummarizeMenuItem(options, hideMenu));
  menu.appendChild(historyItem);
  menu.appendChild(settingsItem);
  btn.appendChild(menu);

  container.appendChild(btn);

  // ========== 点击图标打开侧边栏 ==========
  // 在 onPointerUp 中判断 isClick，避免与拖拽冲突
  btn.addEventListener('click', (e) => {
    if (isDragging) {
      e.stopPropagation();
      return;
    }
    // 延迟执行，让拖拽的 setPointerCapture 先释放
    setTimeout(() => {
      if (!isDragging) {
        options.onClickIcon?.();
      }
    }, 50);
  });

  // 关闭按钮 - 胶囊外部（与 btn 同级），不受 overflow 裁切
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
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    container.remove();
    floatingIconEl = null;
  });
  closeBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
  container.appendChild(closeBtn);

  // ========== 拖拽逻辑 ==========
  setupDrag(container, btn);

  // btn hover
  btn.addEventListener('mouseenter', showMenu);
  btn.addEventListener('mouseleave', hideMenu);

  // 菜单 hover
  menu.addEventListener('mouseenter', () => {
    if (leaveTimer) { clearTimeout(leaveTimer); leaveTimer = null; }
  });
  menu.addEventListener('mouseleave', hideMenu);

  // 阻止菜单区域的 pointerdown 冒泡到 btn，避免触发拖拽逻辑
  menu.addEventListener('pointerdown', (e) => e.stopPropagation());

  // 关闭按钮 hover
  closeBtn.addEventListener('mouseenter', () => {
    if (leaveTimer) { clearTimeout(leaveTimer); leaveTimer = null; }
  });
  closeBtn.addEventListener('mouseleave', hideMenu);

  // ========== 翻译菜单点击 ==========
  const translateItem = menu.querySelector('.select-ask-floating-icon-menu-item');
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

  // 暴露刷新方法
  (container as any).__refreshMenuState = refreshMenuState;

  floatingIconEl = container;
  return container;
}

// ========== 拖拽阈值判断 ==========
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
    return Math.sqrt(dx * dx + dy * dy) > this.threshold && Date.now() - this.startT > 300;
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
function setupDrag(container: HTMLElement, btn: HTMLElement) {
  let currentX = 0;
  let currentY = ratioToPixel(savedRatio);
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
    if (e.target !== btn && !btn.contains(e.target as Node)) return;
    // 菜单展开时禁止拖拽，避免与菜单点击冲突
    if (btn.classList.contains('active')) return;

    isPointerDown = true;
    dragOffsetX = e.clientX - currentX;
    dragOffsetY = e.clientY - currentY;

    dragThreshold.start(e.clientX, e.clientY);
  }

  function onPointerMove(e: PointerEvent) {
    if (!isPointerDown) return;
    // 菜单展开时停止拖拽
    if (btn.classList.contains('active')) { isPointerDown = false; return; }

    const newX = e.clientX - dragOffsetX;
    const newY = e.clientY - dragOffsetY;
    setPos(newX, newY);

    if (dragThreshold.isValid(e.clientX, e.clientY)) {
      isDragging = true;
      btn.setPointerCapture(e.pointerId); // 只在真正拖拽时捕获，避免拦截菜单点击
    }
  }

  function onPointerUp(e: PointerEvent) {
    if (!isPointerDown) return;
    isPointerDown = false;

    const moveX = Math.abs(e.clientX - dragThreshold.startX);
    const moveY = Math.abs(e.clientY - dragThreshold.startY);
    const isClick = moveX <= 4 && moveY <= 4;

    if (isClick) {
      isDragging = false;
      return;
    }

    const ratio = pixelToRatio(currentY);
    savedRatio = ratio;
    saveRatio(savedRatio);

    setPos(-3, currentY, 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)');

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
  btn.setAttribute('data-tooltip', isTranslating ? '停止翻译' : '翻译全文');

  const icon = buildTranslateIcon(isTranslating ? 'stop-translate' : 'translate');
  if (icon) btn.appendChild(icon);

  return btn;
}

/**
 * 构建总结页面菜单项 - 纯图标按钮
 */
function buildSummarizeMenuItem(options: FloatingIconOptions, onHideMenu?: () => void): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.className = 'select-ask-floating-icon-menu-item';
  btn.setAttribute('data-action', 'summarize-page');
  btn.setAttribute('data-tooltip', '总结页面');

  const icon = buildSummarizeIcon();
  if (icon) btn.appendChild(icon);

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    onHideMenu?.();
    options.onSummarizePage?.();
  });

  return btn;
}

/**
 * 构建历史记录菜单项 - 纯图标按钮
 */
function buildHistoryMenuItem(onHideMenu?: () => void): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.className = 'select-ask-floating-icon-menu-item';
  btn.setAttribute('data-action', 'history');
  btn.setAttribute('data-tooltip', '历史记录');

  const icon = buildHistoryIcon();
  if (icon) btn.appendChild(icon);

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    onHideMenu?.();
    chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS_PAGE', tab: 'history' });
  });

  return btn;
}

/**
 * 构建设置菜单项 - 纯图标按钮
 */
function buildSettingsMenuItem(onHideMenu?: () => void): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.className = 'select-ask-floating-icon-menu-item';
  btn.setAttribute('data-action', 'settings');
  btn.setAttribute('data-tooltip', '设置');

  const icon = buildSettingsIcon();
  if (icon) btn.appendChild(icon);

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    onHideMenu?.();
    chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS_PAGE', tab: 'settings' });
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

/**
 * 构建历史记录图标 SVG
 */
function buildHistoryIcon(): SVGSVGElement | null {
  const svg = createSvg('20', '20', '0 0 24 24');
  appendSvgPath(svg, 'M12 8v4l3 3');
  appendSvgPath(svg, 'M3.05 11a9 9 0 1 1 .6 3');
  appendSvgPath(svg, 'M3 7v4h4');
  return svg;
}

/**
 * 构建设置图标 SVG
 */
function buildSettingsIcon(): SVGSVGElement | null {
  const svg = createSvg('20', '20', '0 0 24 24');
  appendSvgPath(svg, 'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z');
  appendSvgPath(svg, 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z');
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
