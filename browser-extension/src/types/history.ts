/**
 * 历史对话记录类型定义
 */

export interface HistoryMessage {
  role: 'user' | 'assistant';
  content: string;
  reasoning?: string;
  timestamp: number;
}

export interface HistorySession {
  id: string;
  title: string;
  type: 'explain' | 'translate' | 'question' | 'custom';
  selectedText: string;
  messages: HistoryMessage[];
  modelId: string;
  modelName: string;
  createdAt: number;
  updatedAt: number;
}

export interface HistoryStorage {
  sessions: HistorySession[];
  maxSessions: number;
}