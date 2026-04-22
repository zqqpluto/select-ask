import { escapeHtml, formatUrlForDisplay, formatDuration, copyToClipboard } from '../../utils/shared';
import { renderMarkdown } from '../../utils/markdown';
import { MindMap } from '../../components/MindMap';
import type { ExtendedHistoryMessage, PageInfo } from '../hooks/useChatStream';

interface Props {
  messages: ExtendedHistoryMessage[];
  pageInfo: PageInfo | null;
  selectedTextExpanded: boolean;
  selectedTextNeedsExpand: boolean;
  onToggleSelectedTextExpand: () => void;
  mindMapLoading: boolean;
  mindMapInline: string | null;
  expandedReasoning: Record<number, boolean>;
  toggleReasoning: (index: number) => void;
  onReEdit: (content: string) => void;
  onRegenerate: (messageIndex?: number) => void;
  onConvertToMindMap: (content: string) => void;
  onQuestionClick: (question: string) => void;
  onSetMindMapMarkdown: (value: string | null) => void;
  selectedTextRef: React.RefObject<HTMLQuoteElement>;
}

export default function ChatMessageList({
  messages, pageInfo,
  selectedTextExpanded, selectedTextNeedsExpand, onToggleSelectedTextExpand,
  mindMapLoading, mindMapInline,
  expandedReasoning, toggleReasoning,
  onReEdit, onRegenerate, onConvertToMindMap,
  onQuestionClick, onSetMindMapMarkdown,
  selectedTextRef,
}: Props) {

  if (messages.length === 0) {
    return (
      <div className="side-panel-empty-state">
        <div className="side-panel-empty-icon">
          <svg viewBox="0 0 64 64" width="64" height="64" fill="none">
            <circle cx="32" cy="32" r="28" fill="url(#emptyGrad)" opacity="0.12" />
            <path d="M22 20c0-5.523 4.477-10 10-10s10 4.477 10 10v8c0 5.523-4.477 10-10 10l-6 6v-6H22c-5.523 0-10-4.477-10-10V20z" stroke="url(#emptyGrad)" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <text x="32" y="38" textAnchor="middle" fill="url(#emptyGrad)" fontSize="16" fontWeight="700" fontFamily="system-ui">AI</text>
            <defs>
              <linearGradient id="emptyGrad" x1="0" y1="0" x2="64" y2="64">
                <stop offset="0%" stopColor="#6366f1" />
                <stop offset="100%" stopColor="#8b5cf6" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <h3 className="side-panel-empty-title">欢迎使用 Select Ask</h3>
        <p className="side-panel-empty-desc">在网页中选中文本即可开始提问、翻译或解释</p>
        <div className="side-panel-empty-tips">
          <div className="side-panel-empty-tip">
            <span className="side-panel-empty-tip-icon">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
            </span>
            <span>选中文字，点击弹出菜单提问</span>
          </div>
          <div className="side-panel-empty-tip">
            <span className="side-panel-empty-tip-icon">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 8l6 6" /><path d="M4 14l6-6 2-3" /><path d="M2 5h12" /><path d="M22 22l-5-10-5 10" /><path d="M14 18h6" />
              </svg>
            </span>
            <span>点击右侧悬浮图标翻译全文或总结页面</span>
          </div>
          <div className="side-panel-empty-tip">
            <span className="side-panel-empty-tip-icon">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" />
              </svg>
            </span>
            <span>在下方输入框直接提问</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {messages.map((msg, index) => (
        <div key={index} className={`side-panel-message side-panel-message-${msg.role}`}>
          {msg.role === 'user' ? (
            <div className="side-panel-message-wrapper side-panel-message-user-wrapper">
              <div className="side-panel-message-content">
                {index === 0 && pageInfo?.selectedText ? (
                  <>
                    {selectedTextNeedsExpand && (
                      <div className="side-panel-selected-text-header" onClick={onToggleSelectedTextExpand}>
                        <span className="side-panel-selected-text-label">{msg.content}</span>
                        <svg className={`side-panel-selected-text-chevron ${selectedTextExpanded ? '' : 'collapsed'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                      </div>
                    )}
                    {!selectedTextNeedsExpand && (
                      <div className="side-panel-selected-text-short">
                        <span className="side-panel-selected-text-label">{msg.content}</span>
                      </div>
                    )}
                    <blockquote
                      ref={selectedTextRef}
                      className={`side-panel-selected-text-blockquote ${selectedTextExpanded ? 'expanded' : ''}`}
                    >
                      {pageInfo.selectedText}
                    </blockquote>
                  </>
                ) : (
                  <>
                    {escapeHtml(msg.content)}
                    {index === 0 && pageInfo?.pageUrl && (() => {
                      const { displayText, faviconUrl } = formatUrlForDisplay(pageInfo.pageUrl);
                      return (
                        <a href={pageInfo.pageUrl} target="_blank" rel="noopener noreferrer" className="side-panel-page-url" title={pageInfo.pageUrl}>
                          {faviconUrl && (
                            <img src={faviconUrl} alt="" className="side-panel-page-url-favicon" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          )}
                          <span>{displayText}</span>
                        </a>
                      );
                    })()}
                  </>
                )}
              </div>
              <div className="side-panel-message-actions side-panel-message-actions-always">
                <button className="side-panel-action-btn" data-tooltip="复制" onClick={() => copyToClipboard(msg.content)}>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                </button>
                <button className="side-panel-action-btn" data-tooltip="重新编辑" onClick={() => onReEdit(msg.content)}>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
              </div>
            </div>
          ) : (
            <div className="side-panel-message-wrapper side-panel-message-ai-wrapper">
              <div className="side-panel-message-content side-panel-ai-content-flat">
                {msg.reasoning && (
                  <div className="side-panel-reasoning-quote">
                    <div className="side-panel-reasoning-header" onClick={() => toggleReasoning(index)}>
                      <div className="side-panel-reasoning-status">
                        {!msg.duration ? (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                        <span className="side-panel-reasoning-model">{msg.modelName || 'AI'}</span>
                        {!msg.duration ? <span>思考中...</span> : <span>已思考（用时{formatDuration(msg.duration)}）</span>}
                      </div>
                      <svg className={`side-panel-reasoning-chevron ${expandedReasoning[index] === false ? 'collapsed' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </div>
                    <div className={`side-panel-reasoning-content ${expandedReasoning[index] === false ? 'collapsed' : ''}`}>
                      <div className="side-panel-reasoning-quote-text" dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.reasoning) }} />
                    </div>
                  </div>
                )}

                {!msg.reasoning && msg.modelName && !mindMapLoading && !mindMapInline && (
                  <div className="side-panel-ai-info">
                    <span className="side-panel-ai-info-model">{msg.modelName}</span>
                    {msg.duration && <span className="side-panel-ai-info-duration">耗时 {formatDuration(msg.duration)}</span>}
                  </div>
                )}

                {mindMapLoading && !msg.duration ? (
                  <div className="side-panel-mindmap-loading">
                    <svg className="side-panel-spin-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
                    </svg>
                    <span>正在生成脑图...</span>
                    {msg.modelName && <span className="side-panel-mindmap-loading-model">{msg.modelName}</span>}
                  </div>
                ) : mindMapInline ? (
                  <div className="side-panel-mindmap-inline">
                    <MindMap markdown={mindMapInline} />
                    <button className="side-panel-mindmap-expand-btn" onClick={() => onSetMindMapMarkdown(mindMapInline)}>
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                      </svg>
                      打开全屏
                    </button>
                  </div>
                ) : (
                  <div dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
                )}

                {msg.questions && msg.questions.length > 0 && (
                  <div className="side-panel-recommended-questions">
                    <div className="side-panel-recommended-list">
                      {msg.questions.map((q, idx) => (
                        <div key={idx} className="side-panel-recommended-item">
                          <span className="side-panel-recommended-text">{q}</span>
                          <button className="side-panel-recommended-arrow" onClick={() => onQuestionClick(q)} title="快速追问">
                            →
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {(msg.duration || msg.isStopped) && (
                <div className="side-panel-message-actions side-panel-message-actions-always">
                  <button className="side-panel-action-btn" data-tooltip="复制正文" onClick={() => copyToClipboard(msg.content)}>
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  </button>
                  <button className="side-panel-action-btn" data-tooltip="重新生成" onClick={() => onRegenerate(index)}>
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M23 4v6h-6M1 20v-6h6" />
                      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                    </svg>
                  </button>
                  {msg.role === 'assistant' && msg.content && (
                    <button className="side-panel-action-btn" data-tooltip="生成脑图" onClick={() => onConvertToMindMap(msg.content)}>
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
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </>
  );
}
