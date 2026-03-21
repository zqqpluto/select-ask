import type { Message } from '../../types';

export interface ChatMessageProps {
  message: Message;
  isStreaming?: boolean;
}