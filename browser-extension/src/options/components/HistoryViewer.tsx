import { useRef, useState } from 'react';
import type { ModelConfig, ProviderType } from '../../types';
import type { HistorySession, HistoryMessage } from '../../types/history';
import { escapeHtml, formatTime, formatDuration, formatUrlForDisplay, copyToClipboard } from '../../utils/shared';
import { renderMarkdown } from '../../utils/markdown';
import { generateRecommendedQuestions } from '../hooks/useGenerateQuestions';
import { getAppConfig } from '../../utils/config-manager';
import { addMessageToSession, getHistory } from '../../utils/history-manager';
import { LLM_STREAM_PORT_NAME } from '../../types/messages';

interface HistoryViewerProps {
  historySessions: HistorySession[];
  selectedSessionId: string | null;
  models: ModelConfig[];
  currentChatModel: ModelConfig | null;
  // Handlers
  onSelectSession: (sessionId: string) => void;
  onSessionsRefresh: () => void;
}

export default function HistoryViewer({
  historySessions,
  selectedSessionId,
  models,
  currentChatModel,
  onSelectSession,
  onSessionsRefresh,
}: HistoryViewerProps) {
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [chatInput, setChatInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingReasoning, setStreamingReasoning] = useState('');
  const [recommendedQuestions, setRecommendedQuestions] = useState<string[]>([]);
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [expandedHistoryReasoning, setExpandedHistoryReasoning] = useState<Record<number, boolean>>({});

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  };

  const handleSendFollowUp = async () => {
    if (!chatInput.trim() || isStreaming || !selectedSessionId) return;

    setRecommendedQuestions([]);

    const session = historySessions.find(s => s.id === selectedSessionId);
    if (!session) return;

    const userMessage: HistoryMessage = {
      role: 'user',
      content: chatInput.trim(),
      timestamp: Date.now(),
    };

    await addMessageToSession(selectedSessionId, userMessage);
    onSessionsRefresh();

    setChatInput('');
    setIsStreaming(true);
    setStreamingContent('');
    setStreamingReasoning('');

    setTimeout(scrollToBottom, 50);

    try {
      const enabledModels = models.filter(m => m.enabled);
      if (enabledModels.length === 0) {
        throw new Error('请先在模型管理中启用至少一个模型');
      }

      const model = enabledModels[0];

      const port = chrome.runtime.connect({ name: LLM_STREAM_PORT_NAME });

      let fullContent = '';
      let fullReasoning = '';
      let isReasoning = false;

      port.onMessage.addListener((message) => {
        if (message.type === 'LLM_STREAM_CHUNK') {
          const chunk = message.chunk || '';

          if (chunk.includes('[REASONING]')) {
            isReasoning = true;
          }
          if (chunk.includes('[REASONING_DONE]')) {
            isReasoning = false;
          }

          const cleanChunk = chunk
            .replace(/\[REASONING\]/g, '')
            .replace(/\[REASONING_DONE\]/g, '');

          if (isReasoning) {
            fullReasoning += cleanChunk;
            setStreamingReasoning(fullReasoning);
          } else {
            fullContent += cleanChunk;
            setStreamingContent(fullContent);
          }

          setTimeout(scrollToBottom, 50);
        } else if (message.type === 'LLM_STREAM_ERROR') {
          setIsStreaming(false);
          alert(`发送失败: ${message.error}`);
          port.disconnect();
        } else if (message.type === 'LLM_STREAM_END') {
          setIsStreaming(false);
          port.disconnect();

          const assistantMessage: HistoryMessage = {
            role: 'assistant',
            content: fullContent,
            reasoning: fullReasoning || undefined,
            timestamp: Date.now(),
          };
          addMessageToSession(selectedSessionId, assistantMessage).then(() => onSessionsRefresh());

          // Auto-generate follow-up questions
          (async () => {
            const config = await getAppConfig();
            if (config.preferences?.autoGenerateQuestions !== false && session.selectedText) {
              setIsGeneratingQuestions(true);
              try {
                const questions = await generateRecommendedQuestions(
                  session.selectedText,
                  chatInput.trim(),
                  fullContent
                );
                setRecommendedQuestions(questions);
              } catch (error) {
                console.error('Failed to generate questions:', error);
              } finally {
                setIsGeneratingQuestions(false);
              }
            }
          })();
        }
      });

      port.onDisconnect.addListener(() => {
        setIsStreaming(false);
      });

      port.postMessage({
        type: 'LLM_STREAM_START',
        payload: {
          action: 'question',
          text: session.selectedText,
          question: chatInput.trim(),
          modelId: model.id,
        },
      });
    } catch (error) {
      setIsStreaming(false);
      alert(`发送失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  // Filter sessions by search
  const filteredSessions = historySearchQuery.trim()
    ? historySessions.filter(session => {
        const query = historySearchQuery.toLowerCase();
        const matchTitle = session.title?.toLowerCase().includes(query);
        const matchSelectedText = session.selectedText?.toLowerCase().includes(query);
        const matchMessages = session.messages.some(msg =>
          msg.content.toLowerCase().includes(query)
        );
        return matchTitle || matchSelectedText || matchMessages;
      })
    : historySessions;

  return (
    <section className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm h-[calc(100vh-120px)] min-h-[500px]">
      <div className="flex h-full">
        {/* 左侧历史列表 */}
        <div className="w-[280px] min-w-[280px] h-full bg-[#fafbfc] border-r border-[rgba(59,130,246,0.08)] flex flex-col flex-shrink-0">
          {/* 搜索框 */}
          <div className="p-3 border-b border-[rgba(59,130,246,0.08)]">
            <div className="relative">
              <input
                type="text"
                placeholder="搜索历史记录..."
                value={historySearchQuery}
                onChange={(e) => setHistorySearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-[13px] border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
              <svg className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {filteredSessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[200px] text-[#c9cdd4]">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-3 opacity-50">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                <p className="m-0 text-sm">{historySearchQuery.trim() ? '未找到匹配的记录' : '暂无历史记录'}</p>
              </div>
            ) : (
              filteredSessions.map((session) => {
                const firstUserMessage = session.messages.find(m => m.role === 'user');
                const displayContent = firstUserMessage?.content || session.selectedText;
                const truncatedContent = displayContent.length > 50
                  ? displayContent.slice(0, 50) + '...'
                  : displayContent;

                return (
                  <div
                    key={session.id}
                    onClick={() => onSelectSession(session.id)}
                    className={`py-3 px-[14px] rounded-[10px] mb-2 cursor-pointer transition-all duration-150 ${
                      selectedSessionId === session.id
                        ? 'bg-[#f7f8fa] border border-[rgba(59,130,246,0.15)]'
                        : 'bg-white border border-[rgba(59,130,246,0.06)] hover:bg-[#f7f8fa] hover:border-[rgba(59,130,246,0.15)] hover:translate-x-[2px]'
                    }`}
                  >
                    <div className="flex items-center mb-[6px]">
                      <span className="text-[11px] text-[#86909c] font-normal">
                        {formatTime(session.createdAt)}
                      </span>
                    </div>
                    <div className="text-[13px] font-medium text-[#1d2129] leading-[1.5] overflow-hidden text-ellipsis whitespace-nowrap">
                      {truncatedContent}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 右侧对话区域 */}
        <div className="flex-1 flex flex-col min-w-0 bg-gradient-to-b from-white to-[#f8fafc]">
          {selectedSessionId ? (() => {
            const session = historySessions.find(s => s.id === selectedSessionId);
            if (!session) return null;

            return (
              <>
                {/* 消息列表 */}
                <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-[16px]">
                  {session.messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`history-message history-message-${msg.role}`}
                    >
                      {msg.role === 'user' ? (
                        <div className="history-message-wrapper history-message-user-wrapper">
                          <div className="history-message-content">
                            {idx === 0 && session.selectedText ? (
                              <>
                                <span className="history-action-type-label">{msg.content}</span>
                                <blockquote className="history-selected-text-quote">
                                  {escapeHtml(session.selectedText)}
                                </blockquote>
                                {session.pageUrl && (() => {
                                  const { displayText, faviconUrl } = formatUrlForDisplay(session.pageUrl);
                                  return (
                                    <a
                                      href={session.pageUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="history-page-url"
                                      title={session.pageUrl}
                                    >
                                      {faviconUrl && (
                                        <img
                                          src={faviconUrl}
                                          alt=""
                                          className="history-page-url-favicon"
                                          onError={(e) => {
                                            (e.target as HTMLImageElement).style.display = 'none';
                                          }}
                                        />
                                      )}
                                      <span>{displayText}</span>
                                    </a>
                                  );
                                })()}
                              </>
                            ) : (
                              escapeHtml(msg.content)
                            )}
                          </div>
                          <div className="history-message-actions">
                            <button
                              className="history-action-btn"
                              onClick={() => copyToClipboard(msg.content)}
                              title="复制"
                            >
                              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                              </svg>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="history-message-wrapper history-message-ai-wrapper">
                          <div className="history-ai-content-flat">
                            {msg.reasoning && (
                              <div className="history-reasoning-quote">
                                <div
                                  className="history-reasoning-header"
                                  onClick={() => {
                                    setExpandedHistoryReasoning(prev => ({
                                      ...prev,
                                      [idx]: prev[idx] === false ? true : false,
                                    }));
                                  }}
                                >
                                  <div className="history-reasoning-status">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <polyline points="20 6 9 17 4 12"/>
                                    </svg>
                                    <span className="history-reasoning-model">{msg.modelName || 'AI'}</span>
                                    {msg.duration ? (
                                      <span>已思考（用时{formatDuration(msg.duration)}）</span>
                                    ) : (
                                      <span>思考过程</span>
                                    )}
                                  </div>
                                  <svg
                                    className={`history-reasoning-chevron ${expandedHistoryReasoning[idx] === false ? 'collapsed' : ''}`}
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                  >
                                    <path d="M6 9l6 6 6-6"/>
                                  </svg>
                                </div>
                                <div
                                  className={`history-reasoning-content ${expandedHistoryReasoning[idx] === false ? 'collapsed' : ''}`}
                                  style={expandedHistoryReasoning[idx] !== false ? { maxHeight: '2000px', opacity: 1 } : {}}
                                >
                                  <div
                                    className="history-reasoning-quote-text"
                                    dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.reasoning) }}
                                  />
                                </div>
                              </div>
                            )}
                            <div
                              dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                            />
                          </div>
                          <div className="history-message-actions">
                            <button
                              className="history-action-btn"
                              onClick={() => copyToClipboard(msg.content)}
                              title="复制正文"
                            >
                              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                              </svg>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* 流式输出 */}
                  {isStreaming && (
                    <div className="history-message history-message-assistant">
                      <div className="history-message-wrapper history-message-ai-wrapper">
                        <div className="history-ai-content-flat">
                          {streamingReasoning && (
                            <div className="history-reasoning-quote">
                              <div className="history-reasoning-header">
                                <div className="history-reasoning-status">
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="12" r="10"/>
                                    <path d="M12 6v6l4 2"/>
                                  </svg>
                                  <span className="history-reasoning-model">{currentChatModel?.name || 'AI'}</span>
                                  <span>思考中...</span>
                                </div>
                              </div>
                              <div className="history-reasoning-content" style={{ maxHeight: '2000px', opacity: 1 }}>
                                <div
                                  className="history-reasoning-quote-text"
                                  dangerouslySetInnerHTML={{ __html: renderMarkdown(streamingReasoning) }}
                                />
                              </div>
                            </div>
                          )}
                          <div dangerouslySetInnerHTML={{ __html: renderMarkdown(streamingContent) }} />
                          <span className="inline-block w-1.5 h-4 bg-[#165dff] animate-pulse ml-0.5"></span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 推荐问题 */}
                {!isStreaming && recommendedQuestions.length > 0 && (
                  <div className="px-4 py-3 border-t border-gray-100">
                    <div className="text-[12px] text-gray-500 mb-2 flex items-center gap-1">
                      <span>💡</span>
                      <span>推荐问题</span>
                    </div>
                    <div className="space-y-2">
                      {recommendedQuestions.map((question, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            setChatInput(question);
                            setRecommendedQuestions([]);
                          }}
                          className="w-full text-left px-3 py-2 text-[13px] text-gray-700 bg-gray-50 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors border border-gray-200 hover:border-blue-200"
                        >
                          {question}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 生成问题中提示 */}
                {isGeneratingQuestions && (
                  <div className="px-4 py-3 border-t border-gray-100">
                    <div className="flex items-center gap-2 text-[12px] text-gray-400">
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>正在生成推荐问题...</span>
                    </div>
                  </div>
                )}

                {/* 输入区域 */}
                <div className="px-4 py-3 pt-3 pb-4 bg-gradient-to-b from-[#fafbfc] to-white border-t border-[rgba(59,130,246,0.06)]">
                  <div className="flex flex-col bg-[#f8fafc] border border-[rgba(59,130,246,0.12)] rounded-[20px] overflow-hidden transition-all focus-within:border-[rgba(59,130,246,0.35)] focus-within:bg-white focus-within:shadow-[0_0_0_3px_rgba(59,130,246,0.08),0_4px_12px_rgba(59,130,246,0.1)]">
                    <div className="flex gap-2 items-end p-2 pb-0">
                      <textarea
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={async (e) => {
                          if (e.key === 'Enter') {
                            const config = await getAppConfig();
                            const sendWithEnter = config.preferences?.sendWithEnter ?? false;
                            if (sendWithEnter) {
                              if (!e.shiftKey) {
                                e.preventDefault();
                                handleSendFollowUp();
                              }
                            } else {
                              if (e.ctrlKey) {
                                e.preventDefault();
                                handleSendFollowUp();
                              }
                            }
                          }
                        }}
                        placeholder="追问或提出新问题..."
                        disabled={isStreaming}
                        rows={1}
                        className="flex-1 px-0 py-2 border-none rounded-none bg-transparent text-[14px] text-[#1d2129] placeholder-[#c9cdd4] resize-none outline-none min-h-[24px] max-h-[120px] disabled:cursor-not-allowed disabled:text-[#c9cdd4]"
                      />
                    </div>
                    <div className="flex items-center justify-end px-3 pb-2">
                      <button
                        onClick={handleSendFollowUp}
                        disabled={isStreaming || !chatInput.trim()}
                        className="history-send-btn"
                      >
                        {isStreaming ? (
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                            <rect x="7" y="7" width="10" height="10" rx="2.5"/>
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                            <path d="M12 4L4 14h5v6h6v-6h5L12 4z"/>
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </>
            );
          })() : (
            <div className="flex-1 flex flex-col items-center justify-center text-[#86909c]">
              <span className="text-6xl mb-4">💬</span>
              <p className="text-[16px]">选择一个历史对话</p>
              <p className="text-[13px] mt-2 text-[#c9cdd4]">或开始新的对话</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
