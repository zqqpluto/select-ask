import type { ChatMessageProps } from './types';
import './style.css';

export function ChatMessage({ message, isStreaming = false }: ChatMessageProps) {

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div
      className={`select-ask-chat-message select-ask-chat-message-${message.role}`}
    >
      <div className="select-ask-chat-message-content">
        {message.content}
        {isStreaming && <span className="animate-pulse">|</span>}
      </div>
      <div className="select-ask-chat-message-timestamp">
        {formatTimestamp(message.timestamp)}
      </div>
    </div>
  );
}