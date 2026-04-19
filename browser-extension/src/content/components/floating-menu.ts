/**
 * 悬浮图标二级下拉菜单 DOM 创建
 * 包含翻译、总结、脑图、历史、模型选择器、提问输入框等菜单项
 */

import { createSvg, appendSvgPath } from '../utils/svg-helpers';

export interface FloatingMenuOptions {
  onFullPageTranslate: () => void;
  onRestore?: () => void;
  onToggleFullPageTranslate?: () => void;
  onSummarizePage?: () => void;
  onMindMapPage?: () => void;
  onClickIcon?: () => void;
  isTranslating?: boolean;
  onHideMenu?: () => void;
  onModelSelect?: (modelId: string) => void;
}

/**
 * 构建翻译图标 SVG
 */
export function buildTranslateIcon(type: string): SVGSVGElement | null {
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
 * 构建翻译菜单项
 */
export function buildTranslateMenuItem(options: FloatingMenuOptions): HTMLButtonElement {
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
 * 构建脑图图标 SVG
 */
export function buildMindMapIcon(): SVGSVGElement | null {
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
 * 构建脑图菜单项
 */
export function buildMindMapMenuItem(
  options: FloatingMenuOptions,
  onHideMenu?: () => void
): HTMLButtonElement {
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
 * 构建总结图标 SVG
 */
export function buildSummarizeIcon(): SVGSVGElement | null {
  const svg = createSvg('20', '20', '0 0 1024 1024');
  svg.setAttribute('fill', 'currentColor');
  const p1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p1.setAttribute('d', 'M725.76 9.344H185.770667q-61.994667 0-105.813334 43.818667T36.181333 158.976v706.048q0 61.994667 43.818667 105.813333t105.813333 43.818667h234.154667q17.237333 0 29.44-12.202667 12.202667-12.202667 12.202667-29.44 0-17.237333-12.202667-29.44-12.202667-12.202667-29.44-12.202666H185.813333q-66.346667 0-66.346666-66.346667V158.976q0-66.346667 66.346666-66.346667h539.904q66.346667 0 66.346667 66.346667v329.088q0 17.28 12.202667 29.44 12.202667 12.202667 29.44 12.202667 17.237333 0 29.44-12.16 12.202667-12.202667 12.202666-29.44V158.933333q0-61.994667-43.818666-105.813333T725.717333 9.344z m-37.290667 274.944q0 18.986667-13.44 32.426667-13.397333 13.397333-32.341333 13.397333H268.885333q-18.986667 0-32.426666-13.44-13.354667-13.397333-13.354667-32.384 0-18.944 13.397333-32.384 13.397333-13.397333 32.384-13.397333h373.76q18.986667 0 32.426667 13.397333 13.397333 13.44 13.397333 32.426667z m-207.658666 232.789333q0 18.944-13.397334 32.384-13.44 13.397333-32.426666 13.397334H268.928q-18.986667 0-32.384-13.397334-13.397333-13.44-13.397333-32.426666 0-18.944 13.397333-32.341334 13.397333-13.44 32.384-13.44h166.144q18.944 0 32.384 13.44 13.397333 13.397333 13.397333 32.384z');
  svg.appendChild(p1);
  const p2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p2.setAttribute('d', 'M526.677333 1010.346667h85.973334l29.824-108.885334h136.96l29.866666 108.928h89.386667l-135.850667-424.746666h-100.309333l-135.850667 424.746666z m134.101334-174.805334l12.629333-46.421333c12.629333-44.16 24.661333-92.288 36.096-138.709333h2.304c12.629333 45.269333 24.064 94.549333 37.248 138.666666l12.629333 46.506667h-100.906666z m237.909333 174.848h84.821333v-424.746666h-84.821333v424.746666z');
  svg.appendChild(p2);
  return svg;
}

/**
 * 构建总结页面菜单项
 */
export function buildSummarizeMenuItem(
  options: FloatingMenuOptions,
  onHideMenu?: () => void
): HTMLButtonElement {
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
 * 构建历史记录图标 SVG
 */
export function buildHistoryIcon(): SVGSVGElement | null {
  const svg = createSvg('20', '20', '0 0 24 24');
  appendSvgPath(svg, 'M12 8v4l3 3');
  appendSvgPath(svg, 'M3.05 11a9 9 0 1 1 .6 3');
  appendSvgPath(svg, 'M3 7v4h4');
  return svg;
}

/**
 * 构建历史记录菜单项
 */
export function buildHistoryMenuItem(onHideMenu?: () => void): HTMLButtonElement {
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
 * 构建设置图标 SVG
 */
export function buildSettingsIcon(): SVGSVGElement | null {
  const svg = createSvg('20', '20', '0 0 24 24');
  appendSvgPath(svg, 'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z');
  appendSvgPath(svg, 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z');
  return svg;
}

/**
 * 构建设置菜单项
 */
export function buildSettingsMenuItem(onHideMenu?: () => void): HTMLButtonElement {
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
 * 构建模型选择器菜单项 — 显示当前模型名称，点击弹出模型列表
 */
export function buildModelSelectorMenuItem(
  onHideMenu?: () => void,
  onModelSelect?: (modelId: string) => void
): HTMLElement {
  const container = document.createElement('div');
  container.className = 'select-ask-floating-icon-menu-model-container';

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

  const label = document.createElement('span');
  label.className = 'select-ask-model-selector-label';
  label.textContent = '加载中...';
  btn.appendChild(label);

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

  const subMenu = document.createElement('div');
  subMenu.className = 'select-ask-floating-icon-menu select-ask-model-submenu';

  let currentModelId = '';
  let modelsLoaded = false;

  chrome.storage.sync.get(['app_config']).then((result) => {
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

      const firstModel = modelsToUse[0];
      if (firstModel) {
        label.textContent = firstModel.name;
        currentModelId = firstModel.id;
      } else {
        label.textContent = '未配置模型';
      }

      if (modelsToUse.length > 1) {
        modelsToUse.forEach((model: { id: string; name: string }) => {
          const item = document.createElement('button');
          item.className = 'select-ask-floating-icon-menu-item select-ask-model-option';
          item.setAttribute('data-model-id', model.id);
          if (model.id === (selectedIds[0] || firstModel?.id)) {
            item.classList.add('active');
          }

          const nameLabel = document.createElement('span');
          nameLabel.className = 'select-ask-model-option-label';
          nameLabel.textContent = model.name;
          item.appendChild(nameLabel);

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

            subMenu.querySelectorAll('.select-ask-model-option').forEach((opt) => {
              opt.classList.remove('active');
            });
            item.classList.add('active');
            label.textContent = model.name;
            currentModelId = model.id;

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
 * 构建提问输入框菜单项
 * 点击后隐藏其他菜单项，展开为输入框 + 发送按钮
 */
export function buildAskInputMenuItem(onHideMenu?: () => void): HTMLElement {
  const container = document.createElement('div');
  container.className = 'select-ask-floating-icon-ask-container';

  const triggerBtn = document.createElement('button');
  triggerBtn.className = 'select-ask-floating-icon-menu-item';
  triggerBtn.setAttribute('data-action', 'ask-input');
  triggerBtn.setAttribute('data-tooltip', '提问');

  const svg = createSvg('20', '20', '0 0 24 24');
  appendSvgPath(svg, 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z');
  triggerBtn.appendChild(svg);

  container.appendChild(triggerBtn);

  const inputArea = document.createElement('div');
  inputArea.className = 'select-ask-floating-icon-ask-input-area';
  inputArea.style.display = 'none';

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

  triggerBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const menu = container.closest('.select-ask-floating-icon-menu');
    if (menu) {
      menu.querySelectorAll('.select-ask-floating-icon-menu-item').forEach((item) => {
        if (item !== triggerBtn) {
          (item as HTMLElement).style.display = 'none';
        }
      });
      menu.querySelectorAll('.select-ask-floating-icon-menu-model-container').forEach((el) => {
        (el as HTMLElement).style.display = 'none';
      });
    }
    triggerBtn.style.display = 'none';
    inputArea.style.display = 'flex';
    textarea.focus();
  });

  const MIN_WIDTH = 200;
  const MAX_WIDTH = 400;
  const MAX_HEIGHT = 160;

  textarea.addEventListener('input', () => {
    textarea.style.height = 'auto';

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (context) {
      const computedStyle = window.getComputedStyle(textarea);
      context.font = `${computedStyle.fontSize} ${computedStyle.fontFamily}`;
      const textWidth = context.measureText(textarea.value || textarea.placeholder).width;

      const paddingLeft = 10;
      const paddingRight = 36;
      const padding = paddingLeft + paddingRight;
      let newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, textWidth + padding));

      container.style.minWidth = newWidth + 'px';
      textarea.style.width = (newWidth - padding) + 'px';
    }

    textarea.style.height = 'auto';
    const newHeight = Math.min(MAX_HEIGHT, textarea.scrollHeight);
    textarea.style.height = newHeight + 'px';

    if (newHeight > 40) {
      sendBtn.classList.add('multi-line');
    } else {
      sendBtn.classList.remove('multi-line');
    }
  });

  const doSend = () => {
    const text = textarea.value.trim();
    if (!text) return;

    chrome.runtime.sendMessage({
      type: 'TOGGLE_SIDE_PANEL',
      selectedText: '',
      userMessage: text,
      summaryPrompt: text,
      pageUrl: window.location.href,
      pageTitle: document.title,
    });

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

  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      doSend();
    }
  });

  return container;
}
