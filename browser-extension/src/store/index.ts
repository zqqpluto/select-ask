import { create } from 'zustand';
import { AppState, AppActions } from '../types';

type AppStore = AppState & AppActions;

export const useAppStore = create<AppStore>((set) => ({
  // 初始状态
  selectedModel: '',
  customApiKey: undefined,
  chatHistory: [],
  currentSessionId: '',
  isStreaming: false,
  questions: [],
  isGeneratingQuestions: false,
  selectedText: undefined,
  selectedContext: undefined,

  // Actions
  setSelectedModel: (model) => set({ selectedModel: model }),

  setCustomApiKey: (key) => set({ customApiKey: key }),

  addMessage: (message) => set((state) => ({
    chatHistory: [...state.chatHistory, message],
  })),

  clearHistory: () => set({ chatHistory: [], currentSessionId: '' }),

  setStreaming: (streaming) => set({ isStreaming: streaming }),

  setQuestions: (questions) => set({ questions }),

  setGeneratingQuestions: (generating) => set({ isGeneratingQuestions: generating }),
}));

// 持久化到 chrome.storage
export const persistStore = () => {
  const state = useAppStore.getState();

  // 保存用户设置
  chrome.storage.sync.set({
    selectedModel: state.selectedModel,
    customApiKey: state.customApiKey,
  });

  // 保存聊天历史到 local storage
  chrome.storage.local.set({
    chatHistory: state.chatHistory,
    currentSessionId: state.currentSessionId,
  });
};

// 从存储加载状态
export const loadStore = async () => {
  const [syncData, localData] = await Promise.all([
    chrome.storage.sync.get(['selectedModel', 'customApiKey']),
    chrome.storage.local.get(['chatHistory', 'currentSessionId']),
  ]);

  useAppStore.setState({
    selectedModel: syncData.selectedModel || '',
    customApiKey: syncData.customApiKey,
    chatHistory: localData.chatHistory || [],
    currentSessionId: localData.currentSessionId || '',
  });
};
