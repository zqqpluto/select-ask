/**
 * 历史对话记录类型定义
 */

export interface HistoryMessage {
  role: 'user' | 'assistant';
  content: string;
  reasoning?: string;
  timestamp: number;
  modelName?: string;
  duration?: number;
  startTime?: number;
}

export interface HistorySession {
  id: string;
  title: string;
  type: 'explain' | 'translate' | 'question' | 'search' | 'summarize' | 'custom';
  selectedText: string;
  messages: HistoryMessage[];
  modelId: string;
  modelName: string;
  createdAt: number;
  updatedAt: number;
  pageUrl?: string;
  pageTitle?: string;
}

export interface HistoryStorage {
  sessions: HistorySession[];
  maxSessions: number;
}