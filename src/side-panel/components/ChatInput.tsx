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
                <path d="M770.4576 51.2a144.1792 144.1792 0 0 1 144.128 143.6672l0.768 291.4304a35.328 35.328 0 1 1-70.7072 0.2048l-0.7168-291.4304a73.4208 73.4208 0 0 0-73.472-73.1648l-472.6784 1.1264A73.4208 73.4208 0 0 0 224.256 196.4544v582.0928c0 40.5504 32.8704 73.4208 73.472 73.4208l182.0672-1.0752a35.3792 35.3792 0 0 1 0.1024 70.656H297.7792A143.2576 143.2576 0 0 1 153.6 778.5984l0.0512-582.144a144.1792 144.1792 0 0 1 144.1792-144.128L770.5088 51.2h-0.0512z m-24.5248 530.0736l31.2832 89.3952a40.2432 40.2432 0 0 0 26.8288 26.8288l89.4464 31.3344c8.9088 4.4544 8.9088 13.4144 0 17.8688l-89.4464 31.2832a40.3456 40.3456 0 0 0-26.8288 26.8288l-31.2832 89.3952c-4.5056 8.96-13.4144 8.96-17.8688 0l-31.3344-89.3952a40.3456 40.3456 0 0 0-26.8288-26.8288l-89.4464-31.2832c-8.9088-4.4544-8.9088-13.4144 0-17.92l89.4464-31.232a40.2432 40.2432 0 0 0 26.8288-26.88l31.3344-89.3952c4.4544-8.96 13.3632-8.96 17.8176 0h0.1024z m-192.512-21.4528a35.328 35.328 0 0 1 0 70.7584h-146.944a35.328 35.328 0 0 1 0-70.7584h146.944z m108.7488-163.1744a35.328 35.328 0 0 1 0 70.7072H406.528a35.328 35.328 0 1 1 0-70.7072h255.6416z m0-163.2256a35.328 35.328 0 0 1 0 70.7584H406.528a35.328 35.328 0 1 1 0-70.7584h255.6416z"/>
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
