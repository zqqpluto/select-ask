import { Message } from './message';

export interface AppState {
  // 用户设置
  selectedModel: string;
  customApiKey?: string;

  // 聊天状态
  chatHistory: Message[];
  currentSessionId: string;
  isStreaming: boolean;

  // 问题生成状态
  questions: string[];
  isGeneratingQuestions: boolean;

  // UI状态
  selectedText?: string;
  selectedContext?: import('./selection').ContextData;
}

export interface AppActions {
  setSelectedModel: (model: string) => void;
  setCustomApiKey: (key?: string) => void;
  addMessage: (message: Message) => void;
  clearHistory: () => void;
  setStreaming: (streaming: boolean) => void;
  setQuestions: (questions: string[]) => void;
  setGeneratingQuestions: (generating: boolean) => void;
}