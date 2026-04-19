export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface ChatSession {
  sessionId: string;
  messages: Message[];
  createdAt: number;
  lastActiveAt: number;
}