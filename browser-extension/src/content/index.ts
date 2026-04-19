import { getContextData } from './utils/context';
import { isValidSelection, getSelectionPosition, removeIconMenus } from './utils/dom-utils';
import { extractMainContent, truncateContent } from './utils/content-extractor';
import { loadCache } from './utils/response-cache';

// Extracted modules
import { handleMenuAction } from './handlers/menu-handler';
import {
  setSessionState,
  handleMenuActionDelegate,
  setMenuActionDelegateDeps,
} from './utils/session-manager';

// 样式
import styleContent from './styles/base.css?inline';
import chatStyleContent from './chat/style.css?inline';
import translationStyleContent from './translation/style.css?inline';
import mindmapStyleContent from './styles/mindmap.css?inline';
import { handleMindMapFromPage, handleMindMapFromSelection } from './handlers/mindmap-handler';
import { showPageSummary } from './handlers/summary-handler';
import {
  showResponseInSidebar,
} from './components/sidebar';
import {
  createIconMenu,
  showDropdownMenu,
  fadeOutIcon,
  createIconMenuState,
  handleMouseUp as handleIconMouseUp,
} from './components/icon-menu';
import {
  showFloatingTranslation,
  showInPlaceTranslation,
} from './components/translation-ui';
import {
  showHistoryPanel,
  setFullscreenModeDeps,
} from './components/fullscreen-mode';

/**
 * 注入样式到页面（作为 manifest.json CSS 注入的备用方案）
 * 这确保在 Playwright 测试等环境中样式也能正确加载
 */
function injectStyles(): void {
  // 检查是否已经注入过样式
  if (document.querySelector('#select-ask-styles')) {
    return;
  }

  const style = document.createElement('style');
  style.id = 'select-ask-styles';
  style.textContent = styleContent + '\n' + chatStyleContent + '\n' + translationStyleContent + '\n' + mindmapStyleContent;

  // 尝试插入到 head 中，如果 head 不存在则插入到 body
  const target = document.head || document.body || document.documentElement;
  target.appendChild(style);
}

// 立即注入样式
if (typeof document !== 'undefined') {
  // 对于静态页面，立即注入
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => injectStyles());
  } else {
    injectStyles();
  }
}

// 当前会话 ID — managed in utils/session-manager.ts (imported)

// 全屏状态 — managed in components/fullscreen-mode.ts

// 当前功能开关状态获取器

// 工具函数 — now imported from ../utils/shared

// Tool functions — now imported from ./utils/helpers and ./utils/layout

// modelSupportsReasoning — now in helpers.ts

// createModelSelector — now in components/model-selector.ts

// getTargetLanguage — now in config-manager (same name, different signature)

// createCopyButton, createRegenerateButton, addActionButtonsToAnswer — now in components/action-buttons.ts

// setupClickOutsideClose — now in utils/helpers.ts

/**
 * 设置历史记录按钮事件
 */
export function setupHistoryButton(header: HTMLElement, _box: HTMLElement): void {
  const historyBtn = header.querySelector('.select-ask-history-btn');
  if (!historyBtn) return;

  historyBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    // 打开插件的配置页面（历史记录标签）
    chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS_PAGE' });
  });
}

// toggleFullscreen, loadFullscreenHistoryData — now in components/fullscreen-mode.ts

// formatRelativeTime — already exists in utils/helpers.ts

// setupFullscreenButton — in components/fullscreen-mode.ts

// 状态 — icon menu state is now managed by IconMenuState
let iconMenuState = createIconMenuState();

// 缓存函数 — now imported from ./utils/response-cache


// saveSelectionRange, restoreSelectionRange — imported from utils/selection


// adjustBoxPosition — now in utils/layout.ts

// ensureBoxInViewport — now in utils/layout.ts



// processNestedLists, enableFollowUp, handleMenuActionDelegate — moved to utils/session-manager.ts

// normalizeReasoningText, renderReasoningText — now in utils/helpers.ts

// showFloatingTranslation, showInPlaceTranslation, translateMultipleParagraphs — now in components/translation-ui.ts

// showIconMenu, handleMouseUp — now in components/icon-menu.ts

/**
 * 初始化 content script
 */
function init(): void {
  // 加载缓存
  loadCache();

  // 注册 fullscreen-mode 模块的依赖
  setFullscreenModeDeps({
    createChatBoxFromHistory: undefined as any, // TODO: implement createChatBoxFromHistory
    setSessionState,
  });

  // 注册 menu action delegate 的依赖
  setMenuActionDelegateDeps({
    iconMenuState,
    handleMenuAction,
    showResponseInSidebar: showResponseInSidebar as any,
    showFloatingTranslation: showFloatingTranslation as any,
    showInPlaceTranslation: showInPlaceTranslation as any,
    handleMindMapFromSelection: handleMindMapFromSelection as any,
  });

  // 鼠标按下时隐藏已有菜单（除非是点击图标、浮动框或下拉菜单）
  document.addEventListener('mousedown', (e) => {
    const target = e.target as HTMLElement;
    const isClickingMenu = target.closest('.select-ask-icon-menu') ||
                           target.closest('.select-ask-dropdown-menu') ||
                           target.closest('.select-ask-chat-box');

    if (!iconMenuState.isIconClicking && !isClickingMenu) {
      iconMenuState.mouseUpPosition = null;
      iconMenuState.currentSelectionData = null;
      removeIconMenus();
      if (iconMenuState.currentDropdown) {
        iconMenuState.currentDropdown.remove();
        iconMenuState.currentDropdown = null;
      }
      iconMenuState.currentIconMenu = null;
    }
    iconMenuState.isIconClicking = false;
  });

  // 鼠标抬起时显示图标
  document.addEventListener('mouseup', (e) => {
    handleIconMouseUp(e, iconMenuState, {
      createIconMenu,
      fadeOutIcon,
      getContextData,
      isValidSelection,
      getSelectionPosition,
      showDropdownMenu,
      onAction: handleMenuActionDelegate,
    });
  });

  // 滚动时隐藏图标，避免影响阅读
  let scrollTimeout: number | null = null;
  document.addEventListener('scroll', () => {
    if (scrollTimeout) {
      clearTimeout(scrollTimeout);
    }
    scrollTimeout = window.setTimeout(() => {
      scrollTimeout = null;
    }, 150) as unknown as number;

    // 滚动时立即隐藏图标
    if (iconMenuState.currentIconMenu && !iconMenuState.currentDropdown) {
      fadeOutIcon(iconMenuState.currentIconMenu);
      iconMenuState.currentIconMenu = null;
    }
  }, true);
}

// 启动
init();

// ==================== 侧边栏功能 ====================

/**
 * 监听来自 popup 的消息
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'OPEN_SIDEBAR') {
    // 使用 Chrome Side Panel 打开侧边栏
    chrome.runtime.sendMessage({
      type: 'OPEN_SIDE_PANEL',
      selectedText: message.selectedText,
      context: message.context,
      userMessage: message.userMessage,
    }, (response) => {
      sendResponse({ success: response?.success });
    });
  } else if (message.type === 'CONTINUE_SESSION') {
    // 继续会话 - 使用 Side Panel
    chrome.runtime.sendMessage({
      type: 'OPEN_SIDE_PANEL',
      selectedText: message.session?.selectedText,
      context: null,
      userMessage: message.session?.messages[0]?.content,
    }, (response) => {
      sendResponse({ success: response?.success });
    });
  } else if (message.type === 'OPEN_HISTORY_SIDEBAR') {
    // 打开历史记录侧边栏
    showHistorySidebarFromPopup();
    sendResponse({ success: true });
  } else if (message.action === 'toggleFullPageTranslate') {
    // 来自 popup 的翻译全文请求
    startFullPageTranslation();
    sendResponse({ success: true });
  } else if (message.action === 'startPageSummarize') {
    // 来自 popup 的总结页面请求 — 统一使用侧边栏
    showPageSummary({
      showToast: (msg) => console.log('[summary]', msg),
      openSidePanel: (params) => chrome.runtime.sendMessage({ type: 'TOGGLE_SIDE_PANEL', ...params }),
    });
    sendResponse({ success: true });
  } else if (message.action === 'floatingIconToggle') {
    // 来自 popup 的悬浮图标开关请求
    if (message.enabled === false) {
      import('./floating-icon').then(({ destroyFloatingIcon }) => {
        destroyFloatingIcon();
      });
    } else {
      initFloatingIcon();
    }
    sendResponse({ success: true });
  } else if (message.type === 'EXTRACT_PAGE_FOR_MINDMAP') {
    // 提取页面内容用于脑图生成
    try {
      const extractedContent = extractMainContent();
      const truncatedContent = truncateContent(extractedContent.content, 6000);
      sendResponse({
        title: extractedContent.title || document.title,
        content: truncatedContent,
      });
    } catch (error) {
      console.error('[脑图] 页面内容提取失败:', error);
      sendResponse({ error: error instanceof Error ? error.message : String(error) });
    }
  }
  return true;
});

/**
 * 从 popup 打开历史记录侧边栏 — 委托给 fullscreen-mode
 */
async function showHistorySidebarFromPopup(): Promise<void> {
  // Reuse showHistoryPanel with a dummy box (popup sidebar doesn't need resume-in-place)
  const dummyBox = document.createElement('div');
  await showHistoryPanel(dummyBox, document.body);
}


// ============= 初始化全局翻译交互监听 =============
// 在 DOM 加载完成后初始化全局 ESC 键监听器和悬浮图标
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async () => {
      const { initGlobalInteractions } = await import('./translation/interaction');
      initGlobalInteractions();
      initFloatingIcon();
    });
  } else {
    (async () => {
      const { initGlobalInteractions } = await import('./translation/interaction');
      initGlobalInteractions();
      initFloatingIcon();
    })();
  }
}

/**
 * 初始化右侧悬浮图标
 */
function initFloatingIcon(): void {
  // 延迟初始化，确保页面完全加载
  setTimeout(async () => {
    try {
      // 检查配置是否允许显示悬浮图标（默认开启，兼容旧配置）
      const { getAppConfig } = await import('../utils/config-manager');
      const config = await getAppConfig();
      if (config.showFloatingIcon === false) return;

      const { createFloatingIcon, updateMenuState } = await import('./floating-icon');
      const { restoreAllTranslations } = await import('./translation/fullpage');

      // 检查是否已经存在
      if (document.querySelector('.select-ask-floating-icon')) return;

      let isTranslating = false;

      const icon = createFloatingIcon({
        onFullPageTranslate: () => {
          isTranslating = true;
          updateMenuState();
          startFullPageTranslation();
        },
        onRestore: () => {
          restoreAllTranslations();
          isTranslating = false;
          updateMenuState();
        },
        onToggleFullPageTranslate: () => {
          if (isTranslating) {
            // 停止翻译：恢复原文
            restoreAllTranslations();
            isTranslating = false;
            updateMenuState();
          } else {
            // 开始翻译 - 先更新UI，再启动翻译（fire-and-forget）
            isTranslating = true;
            updateMenuState();
            startFullPageTranslation();
          }
        },
        onSummarizePage: () => {
          showPageSummary({
            showToast: (msg) => console.log('[summary]', msg),
            openSidePanel: (params) => chrome.runtime.sendMessage({ type: 'TOGGLE_SIDE_PANEL', ...params }),
          });
        },
        onMindMapPage: () => {
          handleMindMapFromPage({
            showToast: (msg: string) => console.log('[mindmap]', msg),
          } as any);
        },
        onClickIcon: () => {
          // 点击图标：切换侧边栏（未打开则打开，已打开则关闭）
          chrome.runtime.sendMessage({ type: 'TOGGLE_SIDE_PANEL', selectedText: '', context: null, userMessage: '', pageUrl: window.location.href, pageTitle: document.title });
        },
        isTranslating: false,
      });

      document.body.appendChild(icon);
    } catch (error) {
      console.error('[悬浮图标] 初始化失败:', error);
    }
  }, 500);
}

/**
 * 启动全文翻译
 */
async function startFullPageTranslation(): Promise<void> {
  try {
    const { createFullPageTranslationController, restoreAllTranslations } = await import('./translation/fullpage');
    const { getTargetLanguage } = await import('../utils/config-manager');
    const { streamTranslate } = await import('../services/content-llm');

    const targetLang = await getTargetLanguage();

    // 如果已有翻译在进行，先恢复
    const existingTranslation = document.querySelector('[data-sa-translation]');
    if (existingTranslation) {
      restoreAllTranslations();
      return;
    }

    const controller = createFullPageTranslationController({
      targetLanguage: targetLang,
      streamTranslate,
      onProgress: (status) => {
        console.log(`[全文翻译] 进度: ${status.completed}/${status.total}`);
      },
      onDone: () => {
        console.log('[全文翻译] 完成');
      },
      onError: (error) => {
        console.error('[全文翻译] 错误:', error.message);
      },
    });

    await controller.start();
  } catch (error) {
    console.error('[全文翻译] 启动失败:', error);
  }
}

/**
 * 监听配置变更 - 实时更新悬浮图标显示/隐藏
 */
if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
  chrome.storage.onChanged.addListener((changes: any, namespace) => {
    if (namespace !== 'sync' || !changes.appConfig) return;

    const newValue = changes.newValue;
    const oldValue = changes.oldValue;
    const wasVisible = oldValue?.showFloatingIcon !== false;
    const nowVisible = newValue?.showFloatingIcon !== false;

    if (wasVisible && !nowVisible) {
      // 配置关闭：销毁悬浮图标
      import('./floating-icon').then(({ destroyFloatingIcon }) => {
        destroyFloatingIcon();
        console.log('[悬浮图标] 已因配置关闭而销毁');
      });
    } else if (!wasVisible && nowVisible) {
      // 配置开启：重新创建
      initFloatingIcon();
      console.log('[悬浮图标] 已因配置开启而重建');
    }
  });
}