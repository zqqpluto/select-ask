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
  onMindMapPage?: () => void; // 生成脑图
  onClickIcon?: () => void; // 点击图标（打开侧边栏）
  isTranslating?: boolean; // 是否正在翻译
  onHideMenu?: () => void; // 隐藏菜单回调
  onModelSelect?: (modelId: string) => void; // 选择模型回调
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

  const translateItem = buildTranslateMenuItem(options);
  const summarizeItem = buildSummarizeMenuItem(options, hideMenu);
  const mindMapItem = buildMindMapMenuItem(options, hideMenu);
  const historyItem = buildHistoryMenuItem(hideMenu);
  menu.appendChild(translateItem);
  menu.appendChild(summarizeItem);
  menu.appendChild(mindMapItem);
  menu.appendChild(historyItem);
  btn.appendChild(menu);

  container.appendChild(btn);

  // ========== 点击图标打开侧边栏 ==========
  // 在 setupDrag 的 onPointerUp 中通过回调触发，避免与拖拽冲突

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
  setupDrag(container, btn, logoWrap, () => options.onClickIcon?.());

  // btn hover
  btn.addEventListener('mouseenter', showMenu);
  btn.addEventListener('mouseleave', hideMenu);

  // 菜单 hover
  menu.addEventListener('mouseenter', () => {
    if (leaveTimer) { clearTimeout(leaveTimer); leaveTimer = null; }
  });
  menu.addEventListener('mouseleave', hideMenu);

  // 阻止菜单展开时 pointerdown 冒泡到 btn，避免触发拖拽逻辑
  menu.addEventListener('pointerdown', (e) => {
    if (btn.classList.contains('active')) e.stopPropagation();
  });

  // 关闭按钮 hover
  closeBtn.addEventListener('mouseenter', () => {
    if (leaveTimer) { clearTimeout(leaveTimer); leaveTimer = null; }
  });
  closeBtn.addEventListener('mouseleave', hideMenu);

  // ========== 翻译菜单点击 ==========
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
function setupDrag(container: HTMLElement, btn: HTMLElement, logoWrap: HTMLElement, onClick?: () => void) {
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
    if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null; }
    if (leaveTimer) { clearTimeout(leaveTimer); leaveTimer = null; }
  }

  function onPointerMove(e: PointerEvent) {
    if (!isPointerDown) return;

    const newX = e.clientX - dragOffsetX;
    const newY = e.clientY - dragOffsetY;
    setPos(newX, newY);

    if (dragThreshold.isValid(e.clientX, e.clientY)) {
      isDragging = true;
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
      isDragging = false;
      onClick?.();
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
 * 构建脑图图标 SVG — 与上下文菜单的脑图图标保持一致
 */
function buildMindMapIcon(): SVGSVGElement | null {
  const svg = createSvg('20', '20', '0 0 24 24');
  appendSvgPath(svg, 'M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0');
  appendSvgPath(svg, 'M4 6m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0');
  appendSvgPath(svg, 'M20 6m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0');
  appendSvgPath(svg, 'M4 18m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0');
  appendSvgPath(svg, 'M20 18m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0');
  appendSvgPath(svg, 'M9.5 10.5L5.5 7.5');
  appendSvgPath(svg, 'M14.5 10.5L18.5 7.5');
  appendSvgPath(svg, 'M9.5 13.5L5.5 16.5');
  appendSvgPath(svg, 'M14.5 13.5L18.5 16.5');
  return svg;
}

/**
 * 构建搜索菜单项 - 纯图标按钮
 */
function _buildSearchMenuItem(onHideMenu?: () => void): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.className = 'select-ask-floating-icon-menu-item';
  btn.setAttribute('data-action', 'search');
  btn.setAttribute('data-tooltip', '搜索');

  const svg = createSvg('20', '20', '0 0 24 24');
  appendSvgPath(svg, 'M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z');
  appendSvgPath(svg, 'M19 10v2a7 7 0 0 1-14 0v-2');
  appendSvgPath(svg, 'M12 19v4');
  appendSvgPath(svg, 'M8 23h8');
  btn.appendChild(svg);

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    onHideMenu?.();
    chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS_PAGE' });
  });

  return btn;
}

/**
 * 构建解释菜单项 - 纯图标按钮
 */
function _buildExplainMenuItem(onHideMenu?: () => void): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.className = 'select-ask-floating-icon-menu-item';
  btn.setAttribute('data-action', 'explain');
  btn.setAttribute('data-tooltip', '解释');

  const svg = createSvg('20', '20', '0 0 24 24');
  appendSvgPath(svg, 'M9 18h6');
  appendSvgPath(svg, 'M10 22h4');
  appendSvgPath(svg, 'M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14');
  btn.appendChild(svg);

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    onHideMenu?.();
    // 触发解释功能 — 通过 content script 的主流程
    chrome.runtime.sendMessage({ type: 'TOGGLE_SIDE_PANEL', action: 'explain' });
  });

  return btn;
}

/**
 * 构建模型选择器菜单项 — 显示当前模型名称，点击弹出模型列表
 */
function buildModelSelectorMenuItem(
  onHideMenu?: () => void,
  onModelSelect?: (modelId: string) => void
): HTMLElement {
  const container = document.createElement('div');
  container.className = 'select-ask-floating-icon-menu-model-container';

  // 主按钮 — 显示当前模型名称
  const btn = document.createElement('button');
  btn.className = 'select-ask-floating-icon-menu-item select-ask-model-selector-btn';
  btn.setAttribute('data-action', 'model-selector');
  btn.setAttribute('data-tooltip', '切换模型');

  // 加载图标
  const loadingSvg = createSvg('20', '20', '0 0 24 24');
  loadingSvg.classList.add('select-ask-menu-item-loading');
  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle.setAttribute('cx', '12'); circle.setAttribute('cy', '12'); circle.setAttribute('r', '10');
  circle.setAttribute('stroke-dasharray', '60'); circle.setAttribute('stroke-dashoffset', '20');
  circle.setAttribute('stroke', 'currentColor'); circle.setAttribute('fill', 'none');
  circle.setAttribute('stroke-width', '2');
  loadingSvg.appendChild(circle);
  btn.appendChild(loadingSvg);

  // 模型名称标签
  const label = document.createElement('span');
  label.className = 'select-ask-model-selector-label';
  label.textContent = '加载中...';
  btn.appendChild(label);

  // 箭头图标
  const arrowSvg = createSvg('16', '16', '0 0 24 24');
  arrowSvg.classList.add('select-ask-model-selector-arrow');
  appendSvgPath(arrowSvg, 'M6 9l6 6 6-6');
  arrowSvg.setAttribute('fill', 'none');
  arrowSvg.setAttribute('stroke', 'currentColor');
  arrowSvg.setAttribute('stroke-width', '2');
  arrowSvg.setAttribute('stroke-linecap', 'round');
  arrowSvg.setAttribute('stroke-linejoin', 'round');
  btn.appendChild(arrowSvg);

  container.appendChild(btn);

  // 子菜单 — 模型列表
  const subMenu = document.createElement('div');
  subMenu.className = 'select-ask-floating-icon-menu select-ask-model-submenu';

  // 异步加载模型
  let currentModelId = '';
  let modelsLoaded = false;

  chrome.storage.sync.get(['app_config']).then((result) => {
    // 移除加载中的旋转图标
    loadingSvg.remove();

    const config = result.app_config;
    if (config && config.models) {
      const enabledModels = config.models
        .filter((m: { enabled: boolean; enableChat?: boolean }) => m.enabled && m.enableChat !== false);
      const selectedIds: string[] = config.selectedChatModelIds || [];

      const modelsToUse = selectedIds.length > 0
        ? selectedIds
            .map((id: string) => enabledModels.find((m: { id: string }) => m.id === id))
            .filter((m: { enabled: boolean } | undefined): m is { enabled: boolean; id: string; name: string } => m !== undefined && m.enabled)
        : enabledModels;

      // 更新主按钮显示
      const firstModel = modelsToUse[0];
      if (firstModel) {
        label.textContent = firstModel.name;
        currentModelId = firstModel.id;
      } else {
        label.textContent = '未配置模型';
      }

      // 构建子菜单
      if (modelsToUse.length > 1) {
        modelsToUse.forEach((model: { id: string; name: string }) => {
          const item = document.createElement('button');
          item.className = 'select-ask-floating-icon-menu-item select-ask-model-option';
          item.setAttribute('data-model-id', model.id);
          if (model.id === (selectedIds[0] || firstModel?.id)) {
            item.classList.add('active');
          }

          // 模型名称
          const nameLabel = document.createElement('span');
          nameLabel.className = 'select-ask-model-option-label';
          nameLabel.textContent = model.name;
          item.appendChild(nameLabel);

          // 选中标记
          const checkSvg = createSvg('16', '16', '0 0 24 24');
          checkSvg.classList.add('select-ask-model-option-check');
          appendSvgPath(checkSvg, 'M20 6L9 17l-5-5');
          checkSvg.setAttribute('fill', 'none');
          checkSvg.setAttribute('stroke', 'currentColor');
          checkSvg.setAttribute('stroke-width', '2');
          checkSvg.setAttribute('stroke-linecap', 'round');
          checkSvg.setAttribute('stroke-linejoin', 'round');
          item.appendChild(checkSvg);

          item.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            // 更新选中状态
            subMenu.querySelectorAll('.select-ask-model-option').forEach((opt) => {
              opt.classList.remove('active');
            });
            item.classList.add('active');
            label.textContent = model.name;
            currentModelId = model.id;

            // 发送消息到 background 更新选中模型
            chrome.runtime.sendMessage({
              type: 'SET_SELECTED_CHAT_MODEL',
              modelId: model.id,
            });

            onHideMenu?.();
            onModelSelect?.(model.id);
          });

          subMenu.appendChild(item);
        });
      }
    } else {
      label.textContent = '未配置模型';
    }
    modelsLoaded = true;
  }).catch(() => {
    loadingSvg.remove();
    label.textContent = '加载失败';
  });

  // 点击主按钮切换子菜单
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (modelsLoaded && subMenu.children.length > 1) {
      btn.classList.toggle('active');
      subMenu.classList.toggle('open');
    }
  });

  container.appendChild(subMenu);

  return container;
}

/**
 * 构建总结页面菜单项 - 纯图标按钮
 */
function buildSummarizeMenuItem(options: FloatingIconOptions, onHideMenu?: () => void): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.className = 'select-ask-floating-icon-menu-item';
  btn.setAttribute('data-action', 'summarize-page');
  btn.setAttribute('data-tooltip', '总结网页');

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
 * 构建脑图菜单项 - 纯图标按钮
 */
function buildMindMapMenuItem(options: FloatingIconOptions, onHideMenu?: () => void): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.className = 'select-ask-floating-icon-menu-item';
  btn.setAttribute('data-action', 'mindmap-page');
  btn.setAttribute('data-tooltip', '生成脑图');

  const icon = buildMindMapIcon();
  if (icon) btn.appendChild(icon);

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    onHideMenu?.();
    options.onMindMapPage?.();
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
 * 构建提问输入框菜单项
 * 点击后隐藏其他菜单项，展开为输入框 + 发送按钮
 */
function buildAskInputMenuItem(onHideMenu?: () => void): HTMLElement {
  const container = document.createElement('div');
  container.className = 'select-ask-floating-icon-ask-container';

  // 初始状态：显示为带输入图标的菜单项
  const triggerBtn = document.createElement('button');
  triggerBtn.className = 'select-ask-floating-icon-menu-item';
  triggerBtn.setAttribute('data-action', 'ask-input');
  triggerBtn.setAttribute('data-tooltip', '提问');

  const svg = createSvg('20', '20', '0 0 24 24');
  appendSvgPath(svg, 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z');
  triggerBtn.appendChild(svg);

  container.appendChild(triggerBtn);

  // 输入框区域（初始隐藏）— 发送按钮在输入框内部
  const inputArea = document.createElement('div');
  inputArea.className = 'select-ask-floating-icon-ask-input-area';
  inputArea.style.display = 'none';

  // 包裹层：textarea + 发送按钮（按钮绝对定位在输入框内部右侧）
  const textareaWrapper = document.createElement('div');
  textareaWrapper.className = 'select-ask-floating-icon-ask-textarea-wrapper';

  const textarea = document.createElement('textarea');
  textarea.className = 'select-ask-floating-icon-ask-textarea';
  textarea.placeholder = '输入你的问题…';
  textarea.rows = 1;

  const sendBtn = document.createElement('button');
  sendBtn.className = 'select-ask-floating-icon-ask-send';
  sendBtn.title = '发送';
  const sendSvg = createSvg('16', '16', '0 0 1024 1024');
  sendSvg.setAttribute('fill', 'currentColor');
  appendSvgPath(sendSvg, 'M512 236.308a39.385 39.385 0 0 1 39.385 39.384v551.385a39.385 39.385 0 1 1-78.77 0V275.692a39.385 39.385 0 0 1 39.385-39.384z');
  appendSvgPath(sendSvg, 'M533.268 220.16a39.385 39.385 0 0 1 0 55.532L310.35 498.61a39.385 39.385 0 1 1-55.533-55.532l222.918-222.918a39.385 39.385 0 0 1 55.533 0z');
  appendSvgPath(sendSvg, 'M490.732 220.16a39.385 39.385 0 0 1 55.533 0l222.917 222.918a39.385 39.385 0 1 1-55.532 55.532L490.732 275.692a39.385 39.385 0 0 1 0-55.532z');
  sendBtn.appendChild(sendSvg);

  textareaWrapper.appendChild(textarea);
  textareaWrapper.appendChild(sendBtn);
  inputArea.appendChild(textareaWrapper);
  container.appendChild(inputArea);

  // 点击触发按钮 → 展开输入框
  triggerBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    // 隐藏同级菜单项
    const menu = container.closest('.select-ask-floating-icon-menu');
    if (menu) {
      menu.querySelectorAll('.select-ask-floating-icon-menu-item').forEach((item) => {
        if (item !== triggerBtn) {
          (item as HTMLElement).style.display = 'none';
        }
      });
      // 隐藏模型选择器等容器
      menu.querySelectorAll('.select-ask-floating-icon-menu-model-container').forEach((el) => {
        (el as HTMLElement).style.display = 'none';
      });
    }
    triggerBtn.style.display = 'none';
    inputArea.style.display = 'flex';
    textarea.focus();
  });

  // 输入框自适应大小：先向右扩展宽度，达到最大宽度后向下扩展高度
  const MIN_WIDTH = 200;
  const MAX_WIDTH = 400;
  const MAX_HEIGHT = 160;

  textarea.addEventListener('input', () => {
    // 临时设为单行以测量文本宽度
    textarea.style.height = 'auto';

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (context) {
      const computedStyle = window.getComputedStyle(textarea);
      context.font = `${computedStyle.fontSize} ${computedStyle.fontFamily}`;
      const textWidth = context.measureText(textarea.value || textarea.placeholder).width;

      // 计算新宽度（内容宽度 + padding + 按钮空间）
      const paddingLeft = 10;
      const paddingRight = 36; // 留给发送按钮的空间
      const padding = paddingLeft + paddingRight;
      let newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, textWidth + padding));

      container.style.minWidth = newWidth + 'px';
      textarea.style.width = (newWidth - padding) + 'px';
    }

    // 计算高度
    textarea.style.height = 'auto';
    const newHeight = Math.min(MAX_HEIGHT, textarea.scrollHeight);
    textarea.style.height = newHeight + 'px';

    // 多行时发送按钮移到底部
    if (newHeight > 40) {
      sendBtn.classList.add('multi-line');
    } else {
      sendBtn.classList.remove('multi-line');
    }
  });

  // 发送
  const doSend = () => {
    const text = textarea.value.trim();
    if (!text) return;

    // 通过 side panel 发送提问
    chrome.runtime.sendMessage({
      type: 'TOGGLE_SIDE_PANEL',
      selectedText: '',
      userMessage: text,
      summaryPrompt: text,
      pageUrl: window.location.href,
      pageTitle: document.title,
    });

    // 收起输入框
    inputArea.style.display = 'none';
    triggerBtn.style.display = '';
    const menu = container.closest('.select-ask-floating-icon-menu');
    if (menu) {
      menu.querySelectorAll('.select-ask-floating-icon-menu-item').forEach((item) => {
        (item as HTMLElement).style.display = '';
      });
      menu.querySelectorAll('.select-ask-floating-icon-menu-model-container').forEach((el) => {
        (el as HTMLElement).style.display = '';
      });
    }
    textarea.value = '';
    textarea.style.height = 'auto';
    textarea.style.width = 'auto';
    container.style.minWidth = '';
    onHideMenu?.();
  };

  sendBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    doSend();
  });

  // Enter 发送，Shift+Enter 换行
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      doSend();
    }
  });

  return container;
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
 * 构建总结图标 SVG — 与上下文菜单的 AI 总结图标保持一致
 */
function buildSummarizeIcon(): SVGSVGElement | null {
  const svg = createSvg('20', '20', '0 0 1024 1024');
  svg.setAttribute('fill', 'currentColor');
  // 第一个 path：文档形状
  const p1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p1.setAttribute('d', 'M725.76 9.344H185.770667q-61.994667 0-105.813334 43.818667T36.181333 158.976v706.048q0 61.994667 43.818667 105.813333t105.813333 43.818667h234.154667q17.237333 0 29.44-12.202667 12.202667-12.202667 12.202667-29.44 0-17.237333-12.202667-29.44-12.202667-12.202667-29.44-12.202666H185.813333q-66.346667 0-66.346666-66.346667V158.976q0-66.346667 66.346666-66.346667h539.904q66.346667 0 66.346667 66.346667v329.088q0 17.28 12.202667 29.44 12.202667 12.202667 29.44 12.202667 17.237333 0 29.44-12.16 12.202667-12.202667 12.202666-29.44V158.933333q0-61.994667-43.818666-105.813333T725.717333 9.344z m-37.290667 274.944q0 18.986667-13.44 32.426667-13.397333 13.397333-32.341333 13.397333H268.885333q-18.986667 0-32.426666-13.44-13.354667-13.397333-13.354667-32.384 0-18.944 13.397333-32.384 13.397333-13.397333 32.384-13.397333h373.76q18.986667 0 32.426667 13.397333 13.397333 13.44 13.397333 32.426667z m-207.658666 232.789333q0 18.944-13.397334 32.384-13.44 13.397333-32.426666 13.397334H268.928q-18.986667 0-32.384-13.397334-13.397333-13.44-13.397333-32.426666 0-18.944 13.397333-32.341334 13.397333-13.44 32.384-13.44h166.144q18.944 0 32.384 13.44 13.397333 13.397333 13.397333 32.384z');
  svg.appendChild(p1);
  // 第二个 path：闪电形状
  const p2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p2.setAttribute('d', 'M526.677333 1010.346667h85.973334l29.824-108.885334h136.96l29.866666 108.928h89.386667l-135.850667-424.746666h-100.309333l-135.850667 424.746666z m134.101334-174.805334l12.629333-46.421333c12.629333-44.16 24.661333-92.288 36.096-138.709333h2.304c12.629333 45.269333 24.064 94.549333 37.248 138.666666l12.629333 46.506667h-100.906666z m237.909333 174.848h84.821333v-424.746666h-84.821333v424.746666z');
  svg.appendChild(p2);
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
  if (hoverTimer) clearTimeout(hoverTimer);
  if (leaveTimer) clearTimeout(leaveTimer);
}

export function getFloatingIcon(): HTMLElement | null {
  return floatingIconEl;
}
