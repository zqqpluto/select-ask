import { loadStore, persistStore } from '../store';
import { useAppStore } from '../store/index';
import { handleLLMStream } from './llm-service';
import { LLM_STREAM_PORT_NAME } from '../types/messages';
import { cleanExpiredSessions } from '../utils/history-manager';

let sidePanelInitialized = false;

// 初始化 Side Panel
async function initializeSidePanel() {
  if (sidePanelInitialized) return;

  try {
    await chrome.sidePanel.setOptions({
      enabled: true,
      path: 'src/side-panel/index.html',
    });
    sidePanelInitialized = true;
  } catch (error) {
    console.error('Failed to initialize Side Panel:', error);
  }
}

// 插件安装时初始化
chrome.runtime.onInstalled.addListener(async () => {
  // 生成设备 ID
  const { device_id } = await chrome.storage.sync.get('device_id');
  if (!device_id) {
    const newDeviceId = crypto.randomUUID();
    await chrome.storage.sync.set({ device_id: newDeviceId });
  }

  // 初始化存储
  await loadStore();

  // 初始化 Side Panel
  await initializeSidePanel();

  // 清理过期的历史记录
  await cleanExpiredSessions();
});

// 插件启动时加载状态
chrome.runtime.onStartup.addListener(async () => {
  await loadStore();
  // 初始化 Side Panel
  await initializeSidePanel();
  // 清理过期的历史记录
  await cleanExpiredSessions();
});

// 处理 LLM 流式请求端口连接
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === LLM_STREAM_PORT_NAME) {
    port.onMessage.addListener(async (message) => {
      if (message.type === 'LLM_STREAM_START') {
        await handleLLMStream(port, message.payload);
      }
    });
  }

  // Handle side panel toggle via port (preserves user gesture context)
  if (port.name === 'sidepanel-toggle') {
    port.onMessage.addListener((payload) => {
      const tabId = port.sender?.tab?.id;
      const windowId = port.sender?.tab?.windowId;

      // Check if side panel is open and toggle
      chrome.storage.local.get(['side_panel_open'], (result) => {
        const isOpen = result.side_panel_open;
        if (isOpen) {
          // Close side panel
          chrome.runtime.sendMessage({ type: 'CLOSE_SIDE_PANEL' }).catch(() => {});
          chrome.storage.local.set({ side_panel_open: false }).catch(() => {});
        } else {
          // Open side panel - call synchronously to preserve gesture context
          if (tabId && windowId) {
            chrome.sidePanel.open({ tabId }).then(() => {
              chrome.storage.local.set({ side_panel_open: true }).catch(() => {});
            }).catch(console.error);
          }
        }
      });

      // Write pending data regardless of open/close
      chrome.storage.local.set({
        pending_sidebar_init: {
          selectedText: payload.selectedText,
          context: payload.context,
          userMessage: payload.userMessage,
          summaryPrompt: payload.summaryPrompt,
          pageUrl: payload.pageUrl,
          pageTitle: payload.pageTitle,
        },
      }).catch(console.error);
    });
  }
});

// 监听来自content script的消息
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const msgType = message.type || message.action;
  switch (msgType) {
    case 'GET_STATE':
      // 返回当前状态
      sendResponse({
        selectedModel: useAppStore.getState().selectedModel,
        customApiKey: useAppStore.getState().customApiKey,
      });
      break;

    case 'UPDATE_STATE':
      // 更新状态
      if (message.selectedModel) {
        useAppStore.getState().setSelectedModel(message.selectedModel);
      }
      if (message.customApiKey !== undefined) {
        useAppStore.getState().setCustomApiKey(message.customApiKey);
      }
      persistStore();
      sendResponse({ success: true });
      break;

    case 'SHOW_FLOATING_BOX':
      // 显示浮动框（由 content script 处理）
      sendResponse({ success: true });
      break;

    case 'TOGGLE_SIDE_PANEL': {
      // 切换 Side Panel（已打开则关闭，未打开则打开）
      chrome.storage.local.get(['side_panel_open'], async (result) => {
        const isOpen = result.side_panel_open;

        if (isOpen) {
          // 侧边栏已打开 → 关闭，记录关闭时间
          chrome.storage.local.set({ side_panel_closed_at: Date.now() }).catch(() => {});
          chrome.runtime.sendMessage({ type: 'CLOSE_SIDE_PANEL' }).catch(() => {});
          sendResponse({ success: true, action: 'closed' });
        } else {
          // 侧边栏未打开 → 打开
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs[0];
            if (!tab?.windowId || !tab.id) {
              sendResponse({ success: false, error: 'No active tab found' });
              return;
            }

            chrome.sidePanel.open({ windowId: tab.windowId })
              .then(() => {
                chrome.storage.local.set({ side_panel_open: true }).catch(() => {});
                sendResponse({ success: true, action: 'opened' });
              })
              .catch((error) => {
                console.error('Failed to open Side Panel:', error);
                sendResponse({ success: false, error: error.message });
              });

            // 写入 pending 数据，供侧边栏读取
            chrome.storage.local.set({
              pending_sidebar_init: {
                selectedText: message.selectedText,
                context: message.context,
                userMessage: message.userMessage,
                summaryPrompt: message.summaryPrompt,
                pageUrl: message.pageUrl,
                pageTitle: message.pageTitle,
              },
            }).catch(console.error);
          });
        }
      });
      return true; // 异步响应
    }

    case 'OPEN_SIDE_PANEL': {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        if (!tab?.windowId || !tab.id) {
          sendResponse({ success: false, error: 'No active tab found' });
          return;
        }

        chrome.sidePanel.open({ windowId: tab.windowId })
          .then(() => {
            sendResponse({ success: true });
          })
          .catch((error) => {
            console.error('Failed to open Side Panel:', error);
            sendResponse({ success: false, error: error.message });
          });

        // 写入 pending 数据，供侧边栏读取
        chrome.storage.local.set({
          pending_sidebar_init: {
            selectedText: message.selectedText,
            context: message.context,
            userMessage: message.userMessage,
            summaryPrompt: message.summaryPrompt,
            pageUrl: message.pageUrl,
            pageTitle: message.pageTitle,
          },
        }).catch(console.error);

        // 尝试通知已打开的侧边栏（如果侧边栏未打开会失败，忽略）
        chrome.runtime.sendMessage({
          type: 'SIDEBAR_INIT',
          selectedText: message.selectedText,
          context: message.context,
          userMessage: message.userMessage,
          summaryPrompt: message.summaryPrompt,
          pageUrl: message.pageUrl,
          pageTitle: message.pageTitle,
        }).catch(() => {});
      });
      return true; // 异步响应
    }

    case 'SET_SELECTED_CHAT_MODEL':
      // 直接更新 storage 中的 selectedChatModelIds，避免动态 import 触发 window 引用
      (async () => {
        try {
          const result = await chrome.storage.sync.get(['app_config']);
          const config = result.app_config;
          if (config && config.selectedChatModelIds && message.modelId) {
            const ids = config.selectedChatModelIds.filter((id: string) => id !== message.modelId);
            ids.unshift(message.modelId);
            config.selectedChatModelIds = ids;
            await chrome.storage.sync.set({ app_config: config });
          }
          useAppStore.getState().setSelectedModel(message.modelId);
          chrome.runtime.sendMessage({ type: 'MODEL_CHANGED', modelId: message.modelId }).catch(() => {});
          sendResponse({ success: true });
        } catch (error) {
          console.error('[SET_SELECTED_CHAT_MODEL] FAILED:', error);
          sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) });
        }
      })();
      return true; // 异步响应

    case 'OPEN_OPTIONS_PAGE':
      // 打开配置页面（支持指定 tab）— 同时关闭已打开的侧边栏
      if (message.tab === 'history') {
        chrome.tabs.create({ url: chrome.runtime.getURL('src/options/index.html') + '?tab=history' });
      } else if (message.tab === 'settings') {
        chrome.tabs.create({ url: chrome.runtime.getURL('src/options/index.html') + '?tab=settings' });
      } else {
        chrome.runtime.openOptionsPage();
      }
      // 通知已打开的侧边栏关闭自身
      chrome.runtime.sendMessage({ type: 'CLOSE_SIDE_PANEL' }).catch(() => {});
      sendResponse({ success: true });
      break;

    default:
      sendResponse({ error: 'Unknown message type' });
  }

  return true; // 保持消息通道开启以支持异步响应
});

// 监听store变化并持久化
let _prevSelectedModel = useAppStore.getState().selectedModel;
let _prevApiKey = useAppStore.getState().customApiKey;
let _prevChatHistory = useAppStore.getState().chatHistory;
let _prevSessionId = useAppStore.getState().currentSessionId;
useAppStore.subscribe((state) => {
  if (state.selectedModel !== _prevSelectedModel || state.customApiKey !== _prevApiKey) {
    chrome.storage.sync.set({
      selectedModel: state.selectedModel,
      customApiKey: state.customApiKey,
    });
    _prevSelectedModel = state.selectedModel;
    _prevApiKey = state.customApiKey;
  }
  if (state.chatHistory !== _prevChatHistory || state.currentSessionId !== _prevSessionId) {
    chrome.storage.local.set({
      chatHistory: state.chatHistory,
      currentSessionId: state.currentSessionId,
    });
    _prevChatHistory = state.chatHistory;
    _prevSessionId = state.currentSessionId;
  }
});