import { useCallback } from 'react';
import type { PageInfo } from '../hooks/useChatStream';

interface Props {
  inputValue: string;
  isLoading: boolean;
  pageInfo: PageInfo | null;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  onTextareaChange?: () => void;
  onSummary: () => void;
  onMindMap: () => void;
  onNewChat: () => void;
}

export default function ChatInput({
  inputValue, isLoading, pageInfo, textareaRef,
  onInputChange, onSend, onStop, onTextareaChange,
  onSummary, onMindMap, onNewChat,
}: Props) {
  const handleTextareaChange = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
    onTextareaChange?.();
  }, [textareaRef, onTextareaChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (inputValue.trim() && !isLoading) onSend();
    }
  }, [inputValue, isLoading, onSend]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onInputChange(e.target.value);
    handleTextareaChange();
  }, [onInputChange, handleTextareaChange]);

  return (
    <div className="side-panel-input">
      <div className="side-panel-action-bar">
        <div className="side-panel-action-left">
          {pageInfo?.pageUrl && (
            <button className="side-panel-summarize-btn" data-tooltip="总结当前网页" onClick={onSummary}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6" />
                <path d="M16 13H8" />
                <path d="M16 17H8" />
                <path d="M10 9H8" />
              </svg>
              <span>总结</span>
            </button>
          )}
          {pageInfo?.pageUrl && (
            <button className="side-panel-mindmap-btn" data-tooltip="基于当前页面内容生成脑图" onClick={onMindMap}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0" />
                <path d="M4 6m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0" />
                <path d="M20 6m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0" />
                <path d="M4 18m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0" />
                <path d="M20 18m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0" />
                <path d="M9.5 10.5L5.5 7.5" />
                <path d="M14.5 10.5L18.5 7.5" />
                <path d="M9.5 13.5L5.5 16.5" />
                <path d="M14.5 13.5L18.5 16.5" />
              </svg>
              <span>脑图</span>
            </button>
          )}
        </div>

        <button className="side-panel-new-chat-btn" data-tooltip="新建会话" onClick={onNewChat}>
          <svg viewBox="0 0 1024 1024" width="24" height="24" fill="currentColor">
            <path d="M594.4832 148.48a30.72 30.72 0 0 0-30.72-30.72h-343.552a153.6 153.6 0 0 0-153.6 153.6v379.392a153.6 153.6 0 0 0 153.6 153.6h14.336v75.264a51.2 51.2 0 0 0 83.1488 40.0384l144.7424-115.3024h341.5552a153.6 153.6 0 0 0 153.6-153.6V486.144a30.72 30.72 0 0 0-61.44 0v164.608a92.16 92.16 0 0 1-92.16 92.16h-363.008l-144.9472 115.456V742.912H220.16a92.16 92.16 0 0 1-92.16-92.16V271.36a92.16 92.16 0 0 1 92.16-92.16h343.552a30.72 30.72 0 0 0 30.72-30.72z" />
            <path d="M791.296 106.5984a35.84 35.84 0 0 1 35.5328 31.0272l0.3072 4.864v85.0944h87.04a35.84 35.84 0 0 1 4.864 71.3728l-4.864 0.3072h-87.04v85.0944a35.84 35.84 0 0 1-71.3728 4.864l-0.3072-4.864V299.264h-87.04a35.84 35.84 0 0 1-4.864-71.3728l4.864-0.3072h87.04V142.4896a35.84 35.84 0 0 1 35.84-35.84v-0.0512zM538.5216 455.68a35.84 35.84 0 0 1 4.9152 71.3728l-4.864 0.3072h-245.76a35.84 35.84 0 0 1-4.864-71.3728l4.8128-0.3072h245.76z m-122.88-142.2848a35.84 35.84 0 0 1 4.9152 71.3728l-4.864 0.3072h-122.88a35.84 35.84 0 0 1-4.864-71.3216l4.864-0.3584h122.88z" />
          </svg>
        </button>
      </div>

      <div className="side-panel-input-box">
        <div className="side-panel-input-row">
          <textarea
            ref={textareaRef}
            placeholder="追问或提出新问题..."
            rows={3}
            value={inputValue}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
          />
          <button
            className="side-panel-send"
            onClick={isLoading ? onStop : onSend}
            disabled={!inputValue.trim() && !isLoading}
          >
            {isLoading ? (
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <rect x="7" y="7" width="10" height="10" rx="2.5" />
              </svg>
            ) : (
              <svg viewBox="0 0 1024 1024" width="16" height="16" fill="currentColor">
                <path d="M512 236.308a39.385 39.385 0 0 1 39.385 39.384v551.385A39.385 39.385 0 0 1 512 866.462a39.385 39.385 0 0 1-39.385-39.385V275.692A39.385 39.385 0 0 1 512 236.308z" />
                <path d="M533.268 220.16a39.385 39.385 0 0 1 0 55.532L310.35 498.61a39.385 39.385 0 0 1-55.533 0 39.385 39.385 0 0 1 0-55.532L477.735 220.16a39.385 39.385 0 0 1 55.533 0z" />
                <path d="M490.732 220.16a39.385 39.385 0 0 1 55.533 0l222.917 222.917a39.385 39.385 0 0 1 0 55.532 39.385 39.385 0 0 1-55.533 0L490.732 275.692a39.385 39.385 0 0 1 0-55.532z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
