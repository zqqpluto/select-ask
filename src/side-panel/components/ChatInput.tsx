import { useCallback } from 'react';
import type { PageInfo } from '../hooks/useChatStream';

interface Props {
  inputValue: string;
  isLoading: boolean;
  pageInfo: PageInfo | null;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
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
              <svg viewBox="0 0 1024 1024" width="14" height="14" fill="currentColor">
                <path d="M725.76 9.344H185.770667q-61.994667 0-105.813334 43.818667T36.181333 158.976v706.048q0 61.994667 43.818667 105.813333t105.813333 43.818667h234.154667q17.237333 0 29.44-12.202667 12.202667-12.202667 12.202667-29.44 0-17.237333-12.202667-29.44-12.202667-12.202666H185.813333q-66.346667 0-66.346666-66.346667V158.976q0-66.346667 66.346666-66.346667h539.904q66.346667 0 66.346667 66.346667v329.088q0 17.28 12.202667 29.44 12.202667 12.202667 29.44 12.202667 17.237333 0 29.44-12.16 12.202667-12.202667 12.202666-29.44V158.933333q0-61.994667-43.818666-105.813333T725.717333 9.344z m-37.290667 274.944q0 18.986667-13.44 32.426667-13.397333 13.397333-32.341333 13.397333H268.885333q-18.986667 0-32.426666-13.44-13.354667-13.397333-13.354667-32.384 0-18.944 13.397333-32.384 13.397333-13.397333 32.384-13.397333h373.76q18.986667 0 32.426667 13.397333 13.397333 13.44 13.397333 32.426667z m-207.658666 232.789333q0 18.944-13.397334 32.384-13.44 13.397333-32.426666 13.397334H268.928q-18.986667 0-32.384-13.397334-13.397333-13.44-13.397333-32.426666 0-18.944 13.397333-32.341334 13.397333-13.44 32.384-13.44h166.144q18.944 0 32.384 13.44 13.397333 13.397333 13.397333 32.384z"/>
                <path d="M526.677333 1010.346667h85.973334l29.824-108.885334h136.96l29.866666 108.928h89.386667l-135.850667-424.746666h-100.309333l-135.850667 424.746666z m134.101334-174.805334l12.629333-46.421333c12.629333-44.16 24.661333-92.288 36.096-138.709333h2.304c12.629333 45.269333 24.064 94.549333 37.248 138.666666l12.629333 46.506667h-100.906666z m237.909333 174.848h84.821333v-424.746666h-84.821333v424.746666z"/>
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
