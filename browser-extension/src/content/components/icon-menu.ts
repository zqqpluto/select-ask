import { removeIconMenus } from '../utils/dom-utils';
import { saveSelectionRange, restoreSelectionRange } from '../utils/selection';

/**
 * 二级菜单相关状态
 */
export interface IconMenuState {
  currentIconMenu: HTMLElement | null;
  currentDropdown: HTMLElement | null;
  mouseUpPosition: { x: number; y: number } | null;
  currentSelectionData: {
    text: string;
    position: { x: number; y: number; width: number; height: number };
    context: any;
  } | null;
  selectionTimeout: number | null;
  isIconClicking: boolean;
}

export interface IconMenuCallbacks {
  onAction?: (action: string) => Promise<void>;
  onDropdownClose?: () => void;
  getContextData: (selection: Selection) => any;
  isValidSelection: (selection: Selection) => boolean;
  getSelectionPosition: (selection: Selection) => { x: number; y: number; width: number; height: number };
  createIconMenu: (x: number, y: number, onClick?: (e: MouseEvent, menu: HTMLElement) => void) => HTMLElement;
  fadeOutIcon: (menu: HTMLElement) => void;
  showDropdownMenu: (
    x: number,
    y: number,
    selectionText: string,
    onAction: (action: string) => Promise<void>,
    onDropdownClose?: () => void
  ) => HTMLElement;
}

/**
 * 图标渐变消失
 */
export function fadeOutIcon(menu: HTMLElement): void {
  menu.classList.add('fade-out');
  setTimeout(() => {
    // caller manages cleanup
  }, 300);
}

/**
 * 创建图标菜单
 */
export function createIconMenu(
  x: number,
  y: number,
  onClick?: (e: MouseEvent, menu: HTMLElement) => void
): HTMLElement {
  const menu = document.createElement('div');
  menu.className = 'select-ask-icon-menu';
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;

  let mouseEnterTimer: number | null = null;
  let hasClicked = false;

  const img = document.createElement('img');
  img.src = chrome.runtime.getURL('public/icons/search.png');
  img.alt = 'Ask AI';
  img.className = 'select-ask-icon-img';
  menu.appendChild(img);

  menu.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    e.preventDefault();
    hasClicked = true;
    if (mouseEnterTimer) {
      clearTimeout(mouseEnterTimer);
      mouseEnterTimer = null;
    }
  });

  menu.addEventListener('mouseup', (e) => {
    e.stopPropagation();
    e.preventDefault();
  });

  menu.addEventListener('mouseenter', () => {
    hasClicked = false;
    mouseEnterTimer = window.setTimeout(() => {
      if (!hasClicked && menu.matches(':hover')) {
        fadeOutIcon(menu);
      }
    }, 800) as unknown as number;
  });

  menu.addEventListener('mouseleave', () => {
    if (mouseEnterTimer) {
      clearTimeout(mouseEnterTimer);
      mouseEnterTimer = null;
    }
    if (!hasClicked) {
      fadeOutIcon(menu);
    }
  });

  menu.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    onClick?.(e, menu);
  });

  return menu;
}

/**
 * 显示二级菜单
 */
export function showDropdownMenu(
  x: number,
  y: number,
  selectionText: string,
  onAction: (action: string) => Promise<void>,
  onDropdownClose?: () => void
): HTMLElement {
  const dropdown = document.createElement('div');
  dropdown.className = 'select-ask-dropdown-menu';
  dropdown.style.left = `${x}px`;
  dropdown.style.top = `${y}px`;

  const menuItems = [
    { key: 'search', label: '搜索', svg: '<svg viewBox="0 0 1293 1024" fill="currentColor"><path d="M646.736842 0l281.222737 1024h-253.305263l-62.356211-227.220211L253.305263 1024H0L281.222737 0z m365.568 0l281.222737 1024H1040.168421L758.945684 0zM463.925895 256l-106.819369 389.389474 182.218106-115.280842-75.452632-274.162527z"/></svg>' },
    { key: 'explain', label: '解释', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"></path><path d="M10 22h4"></path><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"></path></svg>' },
    { key: 'translate', label: '翻译', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 8 6 6"></path><path d="m4 14 6-6 2-3"></path><path d="M2 5h12"></path><path d="M7 2h1"></path><path d="m22 22-5-10-5 10"></path><path d="M14 18h6"></path></svg>' },
    { key: 'summarize', label: '总结', svg: '<svg viewBox="0 0 1024 1024" fill="currentColor"><path d="M725.76 9.344H185.770667q-61.994667 0-105.813334 43.818667T36.181333 158.976v706.048q0 61.994667 43.818667 105.813333t105.813333 43.818667h234.154667q17.237333 0 29.44-12.202667 12.202667-12.202667 12.202667-29.44 0-17.237333-12.202667-29.44-12.202667-12.202666H185.813333q-66.346667 0-66.346666-66.346667V158.976q0-66.346667 66.346666-66.346667h539.904q66.346667 0 66.346667 66.346667v329.088q0 17.28 12.202667 29.44 12.202667 12.202667 29.44 12.202667 17.237333 0 29.44-12.16 12.202667-12.202667 12.202666-29.44V158.933333q0-61.994667-43.818666-105.813333T725.717333 9.344z m-37.290667 274.944q0 18.986667-13.44 32.426667-13.397333 13.397333-32.341333 13.397333H268.885333q-18.986667 0-32.426666-13.44-13.354667-13.397333-13.354667-32.384 0-18.944 13.397333-32.384 13.397333-13.397333 32.384-13.397333h373.76q18.986667 0 32.426667 13.397333 13.397333 13.44 13.397333 32.426667z m-207.658666 232.789333q0 18.944-13.397334 32.384-13.44 13.397333-32.426666 13.397334H268.928q-18.986667 0-32.384-13.397334-13.397333-13.44-13.397333-32.426666 0-18.944 13.397333-32.341334 13.397333-13.44 32.384-13.44h166.144q18.944 0 32.384 13.44 13.397333 13.397333 13.397333 32.384z"/><path d="M526.677333 1010.346667h85.973334l29.824-108.885334h136.96l29.866666 108.928h89.386667l-135.850667-424.746666h-100.309333l-135.850667 424.746666z m134.101334-174.805334l12.629333-46.421333c12.629333-44.16 24.661333-92.288 36.096-138.709333h2.304c12.629333 45.269333 24.064 94.549333 37.248 138.666666l12.629333 46.506667h-100.906666z m237.909333 174.848h84.821333v-424.746666h-84.821333v424.746666z"/></svg>' },
  ];

  if (selectionText.length > 100) {
    menuItems.push({
      key: 'mindmap',
      label: '脑图',
      svg: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><circle cx="4" cy="6" r="2"/><circle cx="20" cy="6" r="2"/><circle cx="4" cy="18" r="2"/><circle cx="20" cy="18" r="2"/><line x1="9.5" y1="10.5" x2="5.5" y2="7.5"/><line x1="14.5" y1="10.5" x2="18.5" y2="7.5"/><line x1="9.5" y1="13.5" x2="5.5" y2="16.5"/><line x1="14.5" y1="13.5" x2="18.5" y2="16.5"/></svg>',
    });
  }

  menuItems.forEach((item) => {
    const button = document.createElement('button');
    button.className = 'select-ask-dropdown-item';
    button.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });

    const iconSpan = document.createElement('span');
    iconSpan.className = 'select-ask-dropdown-icon';
    iconSpan.innerHTML = item.svg;

    const labelSpan = document.createElement('span');
    labelSpan.className = 'select-ask-dropdown-label';
    labelSpan.textContent = item.label;

    button.appendChild(iconSpan);
    button.appendChild(labelSpan);

    button.addEventListener('click', async (e) => {
      e.stopPropagation();
      e.preventDefault();
      dropdown.remove();
      await onAction(item.key);
    });
    dropdown.appendChild(button);
  });

  // 分割线
  const divider = document.createElement('div');
  divider.className = 'select-ask-dropdown-divider';
  dropdown.appendChild(divider);

  // 提问输入框
  const textarea = document.createElement('textarea');
  textarea.className = 'select-ask-dropdown-ask-textarea';
  textarea.placeholder = '针对选中文本提问…';
  textarea.rows = 1;

  const textareaWrapper = document.createElement('div');
  textareaWrapper.className = 'select-ask-dropdown-ask-textarea-wrapper';

  const sendBtn = document.createElement('button');
  sendBtn.className = 'select-ask-dropdown-ask-send';
  sendBtn.title = '发送';
  const sendSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  sendSvg.setAttribute('viewBox', '0 0 1024 1024');
  sendSvg.setAttribute('fill', 'currentColor');
  sendSvg.setAttribute('width', '16');
  sendSvg.setAttribute('height', '16');
  ['M512 236.308a39.385 39.385 0 0 1 39.385 39.384v551.385a39.385 39.385 0 1 1-78.77 0V275.692a39.385 39.385 0 0 1 39.385-39.384z', 'M533.268 220.16a39.385 39.385 0 0 1 0 55.532L310.35 498.61a39.385 39.385 0 1 1-55.533-55.532l222.918-222.918a39.385 39.385 0 0 1 55.533 0z', 'M490.732 220.16a39.385 39.385 0 0 1 55.533 0l222.917 222.918a39.385 39.385 0 1 1-55.532 55.532L490.732 275.692a39.385 39.385 0 0 1 0-55.532z'].forEach(d => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    sendSvg.appendChild(path);
  });
  sendBtn.appendChild(sendSvg);

  textareaWrapper.appendChild(textarea);
  textareaWrapper.appendChild(sendBtn);

  const askContainer = document.createElement('div');
  askContainer.className = 'select-ask-dropdown-ask-container';
  askContainer.appendChild(textareaWrapper);
  dropdown.appendChild(askContainer);

  // 自适应高度
  const MAX_HEIGHT = 120;
  textarea.addEventListener('input', () => {
    textarea.style.height = 'auto';
    const newHeight = Math.min(MAX_HEIGHT, textarea.scrollHeight);
    textarea.style.height = newHeight + 'px';
    if (newHeight > 40) {
      sendBtn.classList.add('multi-line');
    } else {
      sendBtn.classList.remove('multi-line');
    }
  });

  function handleAskSubmit() {
    const question = textarea.value.trim();
    if (!question) return;
    dropdown.remove();
    removeIconMenus();
    const selectedText = window.getSelection()?.toString().trim() || '';
    chrome.runtime.sendMessage({
      type: 'TOGGLE_SIDE_PANEL',
      selectedText: selectedText,
      context: null,
      userMessage: question,
      summaryPrompt: null,
      pageUrl: window.location.href,
      pageTitle: document.title,
    });
  }

  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAskSubmit();
    }
  });

  sendBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    handleAskSubmit();
  });

  // 点击外部关闭
  setTimeout(() => {
    const closeHandler = (e: MouseEvent) => {
      if (!dropdown.contains(e.target as Node)) {
        dropdown.remove();
        onDropdownClose?.();
        document.removeEventListener('click', closeHandler);
      }
    };
    document.addEventListener('click', closeHandler);
  }, 0);

  document.body.appendChild(dropdown);
  return dropdown;
}

/**
 * 创建图标菜单状态
 */
export function createIconMenuState(): IconMenuState {
  return {
    currentIconMenu: null,
    currentDropdown: null,
    mouseUpPosition: null,
    currentSelectionData: null,
    selectionTimeout: null,
    isIconClicking: false,
  };
}

/**
 * 处理图标点击 - 显示下拉菜单
 */
export function handleMenuClick(
  e: MouseEvent,
  iconMenu: HTMLElement,
  state: IconMenuState,
  selectionText: string,
  showDropdown: IconMenuCallbacks['showDropdownMenu'],
  onAction: (action: string) => Promise<void>,
  onDropdownClose?: () => void
): void {
  state.isIconClicking = false;

  // 获取图标位置
  const rect = iconMenu.getBoundingClientRect();
  const dropdownX = rect.left + window.scrollX;
  const dropdownY = rect.bottom + window.scrollY + 4;

  // 渐变隐藏图标（不删除，保持选中文本状态）
  iconMenu.classList.add('fade-out');

  // 立即恢复选区高亮
  restoreSelectionRange();

  // 显示下拉菜单
  const dropdown = showDropdown(
    dropdownX,
    dropdownY,
    selectionText,
    onAction,
    onDropdownClose
  );
  state.currentDropdown = dropdown;

  // 点击外部关闭
  setTimeout(() => {
    document.addEventListener('click', function closeDropdown(e: MouseEvent) {
      if (!dropdown.contains(e.target as Node)) {
        dropdown.remove();
        state.currentDropdown = null;
        // 恢复图标显示
        if (state.currentIconMenu && state.currentIconMenu.parentElement) {
          state.currentIconMenu.classList.remove('fade-out');
          state.currentIconMenu.style.display = 'flex';
        }
        // 恢复选中文本
        restoreSelectionRange();
        document.removeEventListener('click', closeDropdown);
      }
    });
  }, 0);
}

/**
 * 显示图标菜单
 */
export function showIconMenu(
  state: IconMenuState,
  options: {
    getContextData: (selection: Selection) => any;
    isValidSelection: (selection: Selection) => boolean;
    getSelectionPosition: (selection: Selection) => { x: number; y: number; width: number; height: number };
    createIconMenu: (x: number, y: number, onClick?: (e: MouseEvent, menu: HTMLElement) => void) => HTMLElement;
    fadeOutIcon: (menu: HTMLElement) => void;
    showDropdownMenu: IconMenuCallbacks['showDropdownMenu'];
    onAction: (action: string) => Promise<void>;
    onDropdownClose?: () => void;
  }
): void {
  const selection = window.getSelection();
  // 检查选择有效性：非空、非折叠、非纯空白
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed || !options.isValidSelection(selection)) {
    return;
  }

  // 立即保存选区
  saveSelectionRange();

  // 获取选中文本信息
  const text = selection.toString();
  const position = options.getSelectionPosition(selection);
  const contextData = options.getContextData(selection);
  state.currentSelectionData = { text, position, context: contextData };

  // 使用鼠标抬起位置显示图标
  if (state.mouseUpPosition) {
    const iconSize = 36;
    const padding = 8;

    // 图标显示在鼠标位置的右侧，距离很近
    let x = state.mouseUpPosition.x + padding;
    let y = state.mouseUpPosition.y - iconSize / 2;

    // 检查右边界，超出则显示在左侧
    if (x + iconSize > window.innerWidth + window.scrollX) {
      x = state.mouseUpPosition.x - iconSize - padding;
    }

    // 检查上边界
    if (y < window.scrollY) {
      y = window.scrollY + padding;
    }

    // 如果已有图标，先移除
    if (state.currentIconMenu) {
      state.currentIconMenu.remove();
      state.currentIconMenu = null;
    }

    const onClick = (e: MouseEvent, menu: HTMLElement) => {
      handleMenuClick(e, menu, state, text, options.showDropdownMenu, options.onAction, options.onDropdownClose);
    };

    const menu = options.createIconMenu(state.mouseUpPosition.x + padding, state.mouseUpPosition.y - iconSize / 2, onClick);
    // 重新计算边界
    const newX = x + iconSize > window.innerWidth + window.scrollX
      ? state.mouseUpPosition.x - iconSize - padding
      : x;
    const newY = y < window.scrollY ? window.scrollY + padding : y;
    menu.style.left = `${newX}px`;
    menu.style.top = `${newY}px`;

    document.body.appendChild(menu);
    state.currentIconMenu = menu;

    // 2 秒后自动隐藏图标（如果还没有被点击）
    state.selectionTimeout = window.setTimeout(() => {
      if (state.currentIconMenu && !state.currentDropdown) {
        options.fadeOutIcon(state.currentIconMenu);
      }
    }, 2000) as unknown as number;
  }

  // 清除鼠标位置记录
  state.mouseUpPosition = null;
}

/**
 * 处理鼠标抬起（选择完成）
 */
export function handleMouseUp(
  e: MouseEvent,
  state: IconMenuState,
  options: {
    createIconMenu: (x: number, y: number, onClick?: (e: MouseEvent, menu: HTMLElement) => void) => HTMLElement;
    fadeOutIcon: (menu: HTMLElement) => void;
    getContextData: (selection: Selection) => any;
    isValidSelection: (selection: Selection) => boolean;
    getSelectionPosition: (selection: Selection) => { x: number; y: number; width: number; height: number };
    showDropdownMenu: IconMenuCallbacks['showDropdownMenu'];
    onAction: (action: string) => Promise<void>;
    onDropdownClose?: () => void;
  }
): void {
  // 检查是否点击了菜单或对话框
  if ((e.target as HTMLElement).closest('.select-ask-icon-menu') ||
      (e.target as HTMLElement).closest('.select-ask-dropdown-menu') ||
      (e.target as HTMLElement).closest('.select-ask-chat-box') ||
      (e.target as HTMLElement).closest('.select-ask-sidebar')) {
    return;
  }

  // 记录鼠标抬起位置（考虑滚动偏移）
  state.mouseUpPosition = {
    x: e.clientX + window.scrollX,
    y: e.clientY + window.scrollY,
  };

  // 清除之前的定时器
  if (state.selectionTimeout) {
    clearTimeout(state.selectionTimeout);
  }

  // 50ms 延迟后显示图标
  state.selectionTimeout = window.setTimeout(() => {
    showIconMenu(state, options);
  }, 50) as unknown as number;
}
