import { loadStore, persistStore } from '../store';
import { useAppStore } from '../store/index';
import { handleLLMStream } from './llm-service';
import { LLM_STREAM_PORT_NAME } from '../types/messages';
import { cleanExpiredSessions } from '../utils/history-manager';
import { initAnalytics, trackStartup } from '../utils/analytics';

// 插件安装时初始化
chrome.runtime.onInstalled.addListener(async () => {
  console.log('Select Ask extension installed');

  // 生成设备ID
  const { device_id } = await chrome.storage.sync.get('device_id');
  if (!device_id) {
    const newDeviceId = crypto.randomUUID();
    await chrome.storage.sync.set({ device_id: newDeviceId });
    console.log('Generated device ID:', newDeviceId);
  }

  // 初始化存储
  await loadStore();

  // 清理过期的历史记录
  await cleanExpiredSessions();

  // 初始化统计并上报启动
  await initAnalytics();
  await trackStartup();
});

// 插件启动时加载状态
chrome.runtime.onStartup.addListener(async () => {
  await loadStore();
  // 清理过期的历史记录
  await cleanExpiredSessions();

  // 初始化统计并上报启动
  await initAnalytics();
  await trackStartup();
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
});

// 监听来自content script的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message);

  switch (message.type) {
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

    case 'OPEN_OPTIONS_PAGE':
      // 打开配置页面
      chrome.runtime.openOptionsPage();
      sendResponse({ success: true });
      break;

    default:
      sendResponse({ error: 'Unknown message type' });
  }

  return true; // 保持消息通道开启以支持异步响应
});

// 监听store变化并持久化
useAppStore.subscribe(
  (state) => ({
    selectedModel: state.selectedModel,
    customApiKey: state.customApiKey,
    chatHistory: state.chatHistory,
    currentSessionId: state.currentSessionId,
  }),
  (currentState, previousState) => {
    // 只在相关状态变化时持久化
    if (
      currentState.selectedModel !== previousState.selectedModel ||
      currentState.customApiKey !== previousState.customApiKey
    ) {
      chrome.storage.sync.set({
        selectedModel: currentState.selectedModel,
        customApiKey: currentState.customApiKey,
      });
    }

    if (
      currentState.chatHistory !== previousState.chatHistory ||
      currentState.currentSessionId !== previousState.currentSessionId
    ) {
      chrome.storage.local.set({
        chatHistory: currentState.chatHistory,
        currentSessionId: currentState.currentSessionId,
      });
    }
  }
);