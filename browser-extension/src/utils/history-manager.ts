/**
 * 历史对话记录管理
 */

import type { HistorySession, HistoryMessage, HistoryStorage } from '../types/history';

const STORAGE_KEY = 'select_ask_history';
const MAX_SESSIONS = 100;
const MAX_DAYS = 30; // 历史记录保留天数

/**
 * 清理过期记录（超过30天）
 */
export async function cleanExpiredSessions(): Promise<void> {
  const sessions = await getHistory();
  const now = Date.now();
  const expireTime = MAX_DAYS * 24 * 60 * 60 * 1000; // 30天的毫秒数
  const validSessions = sessions.filter(s => (now - s.updatedAt) < expireTime);
  if (validSessions.length !== sessions.length) {
    await saveHistory(validSessions);
    console.log(`Cleaned ${sessions.length - validSessions.length} expired sessions`);
  }
}

/**
 * 获取所有历史记录
 */
export async function getHistory(): Promise<HistorySession[]> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const storage: HistoryStorage = result[STORAGE_KEY] || { sessions: [], maxSessions: MAX_SESSIONS };
  return storage.sessions;
}

/**
 * 保存历史记录
 */
export async function saveHistory(sessions: HistorySession[]): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEY]: {
      sessions: sessions.slice(0, MAX_SESSIONS),
      maxSessions: MAX_SESSIONS,
    },
  });
}

/**
 * 添加新会话
 */
export async function addSession(session: HistorySession): Promise<void> {
  const sessions = await getHistory();
  sessions.unshift(session);
  await saveHistory(sessions);
}

/**
 * 更新会话
 */
export async function updateSession(sessionId: string, updates: Partial<HistorySession>): Promise<void> {
  const sessions = await getHistory();
  const index = sessions.findIndex(s => s.id === sessionId);
  if (index !== -1) {
    sessions[index] = { ...sessions[index], ...updates, updatedAt: Date.now() };
    await saveHistory(sessions);
  }
}

/**
 * 添加消息到会话
 */
export async function addMessageToSession(sessionId: string, message: HistoryMessage): Promise<void> {
  const sessions = await getHistory();
  const session = sessions.find(s => s.id === sessionId);
  if (session) {
    session.messages.push(message);
    session.updatedAt = Date.now();
    await saveHistory(sessions);
  }
}

/**
 * 删除会话
 */
export async function deleteSession(sessionId: string): Promise<void> {
  const sessions = await getHistory();
  const filtered = sessions.filter(s => s.id !== sessionId);
  await saveHistory(filtered);
}

/**
 * 清空所有历史记录
 */
export async function clearHistory(): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEY]: { sessions: [], maxSessions: MAX_SESSIONS },
  });
}

/**
 * 生成会话 ID
 */
export function generateSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 根据内容生成标题
 */
export function generateTitle(selectedText: string, type: string): string {
  const truncated = selectedText.length > 30 ? selectedText.slice(0, 30) + '...' : selectedText;
  const typeNames: Record<string, string> = {
    explain: '解释',
    translate: '翻译',
    question: '问答',
    custom: '自定义',
  };
  return `${typeNames[type] || type}：${truncated}`;
}