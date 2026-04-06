import { useEffect, useState, useRef } from 'react';
import { marked } from 'marked';
import type { HistoryMessage, ModelConfig } from '../types';

// 工具函数
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatTime(timestamp: number | Date = Date.now()): string {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}秒`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}分${remainingSeconds}秒`;
}

function renderMarkdown(text: string): string {
  try {
    let processed = marked(text);

    // 表格
    processed = processed.replace(/<table>/g, '<table class="select-ask-table">');

    // 代码块
    processed = processed.replace(/<pre>/g, '<pre class="select-ask-pre">');
    processed = processed.replace(/<code>/g, '<code class="select-ask-code">');

    // 引用
    processed = processed.replace(/<blockquote>/g, '<blockquote class="select-ask-blockquote">');

    // 列表
    processed = processed.replace(/<ul>/g, '<ul class="select-ask-ul">');
    processed = processed.replace(/<ol>/g, '<ol class="select-ask-ol">');
    processed = processed.replace(/<li>/g, '<li class="select-ask-li">');

    // 分割线
    processed = processed.replace(/<hr\s*\/?>/g, '<hr class="select-ask-hr">');

    // 链接 - 添加安全属性
    processed = processed.replace(/<a href="([^"]*)"/g, '<a href="$1" target="_blank" rel="noopener noreferrer"');

    return processed;
  } catch (error) {
    console.error('Markdown render error:', error);
    return text;
  }
}

interface ExtendedHistoryMessage extends HistoryMessage {
  modelName?: string;
  duration?: number;
  startTime?: number;
  reasoning?: string;
  isStopped?: boolean; // 标记是否被中断
}

interface PageInfo {
  selectedText: string;
  pageUrl: string;
  pageTitle: string;
}

export default function App() {
  const [messages, setMessages] = useState<ExtendedHistoryMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedText, setSelectedText] = useState<string>('');
  const [context, setContext] = useState<{ before: string; after: string } | null>(null);
  const [currentModel, setCurrentModel] = useState<ModelConfig | null>(null);
  const [availableModels, setAvailableModels] = useState<ModelConfig[]>([]);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [pageInfo, setPageInfo] = useState<PageInfo | null>(null);
  const [selectedTextExpanded, setSelectedTextExpanded] = useState(false);
  const [selectedTextNeedsExpand, setSelectedTextNeedsExpand] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const currentPortRef = useRef<chrome.runtime.Port | null>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(false);
  const [userHasScrolled, setUserHasScrolled] = useState(false);
  const modelButtonRef = useRef<HTMLButtonElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(null);
  const selectedTextRef = useRef<HTMLQuoteElement>(null);

  // 滚动到底部
  const scrollToBottom = () => {
    if (!userHasScrolled) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 监听容器滚动，用户手动滚动时暂停自动滚动
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      // 检查是否接近底部
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
      setUserHasScrolled(!isNearBottom);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // 检测选中文本是否需要展开/收起按钮（基于是否能在当前宽度下一行显示）
  useEffect(() => {
    if (selectedTextRef.current && pageInfo?.selectedText) {
      const element = selectedTextRef.current;
      // 检查文本是否溢出（scrollHeight > clientHeight 说明需要多行显示）
      const needsExpand = element.scrollHeight > element.clientHeight ||
                          element.scrollWidth > element.clientWidth;
      setSelectedTextNeedsExpand(needsExpand);
    }
  }, [pageInfo?.selectedText, messages.length]);

  // 思考过程默认展开状态
  const [expandedReasoning, setExpandedReasoning] = useState<Record<number, boolean>>({});

  // 切换思考过程展开/折叠
  const toggleReasoning = (index: number) => {
    setExpandedReasoning(prev => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  // 中断生成
  const handleStopGeneration = () => {
    if (currentPortRef.current) {
      currentPortRef.current.disconnect();
      currentPortRef.current = null;
    }
    setIsLoading(false);
    // 标记最后一条 AI 消息为已中断，并设置 duration
    setMessages(prev => {
      const lastAiIndex = prev.map((m, i) => m.role === 'assistant' ? i : -1).filter(i => i !== -1).pop();
      if (lastAiIndex !== undefined && lastAiIndex >= 0) {
        const lastMsg = prev[lastAiIndex];
        return prev.map((msg, index) =>
          index === lastAiIndex ? {
            ...msg,
            isStopped: true,
            duration: msg.startTime ? Date.now() - msg.startTime : undefined
          } : msg
        );
      }
      return prev;
    });
  };

  // 重新生成最后一条 AI 消息
  const handleRegenerate = async () => {
    // 找到最后一条 AI 消息的索引
    const lastAiIndex = messages.map((m, i) => m.role === 'assistant' ? i : -1).filter(i => i !== -1).pop();
    if (lastAiIndex === undefined || lastAiIndex < 0) return;

    // 找到对应的用户消息
    const userMsgIndex = lastAiIndex > 0 ? lastAiIndex - 1 : null;
    if (userMsgIndex === null || messages[userMsgIndex]?.role !== 'user') return;

    const userMessage = messages[userMsgIndex].content;

    // 移除 AI 消息
    setMessages(prev => prev.slice(0, lastAiIndex));

    // 重新生成
    await getAIResponse(userMessage, currentModel);
  };

  // 复制文本
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  // 重新编辑用户消息
  const handleReEdit = (content: string) => {
    setInputValue(content);
    if (textareaRef.current) {
      textareaRef.current.focus();
      handleTextareaChange();
    }
  };

  // 加载模型配置 - 直接从 chrome.storage.sync 读取
  useEffect(() => {
    const loadModels = async () => {
      try {
        // 直接从 storage 读取配置
        const result = await chrome.storage.sync.get(['app_config']);
        const config = result.app_config;

        if (config && config.models) {
          // 获取所有启用且参与问答的模型
          const enabledModels = config.models
            .filter((m: ModelConfig) => m.enabled && (m.enableChat !== false));

          // 获取选中的模型 ID 列表
          const selectedIds = config.selectedChatModelIds || [];

          let modelsToUse: ModelConfig[] = [];

          if (selectedIds.length > 0) {
            // 有选中的模型，按照 selectedIds 的顺序返回选中的模型
            modelsToUse = selectedIds
              .map(id => enabledModels.find(m => m.id === id))
              .filter((m): m is ModelConfig => m !== undefined && m.enabled);
          } else {
            // 没有选中的模型，返回所有启用的
            modelsToUse = enabledModels;
          }

          setAvailableModels(modelsToUse);
          if (modelsToUse.length > 0) {
            setCurrentModel(modelsToUse[0]);
          } else {
            console.warn('No models available!');
          }
        }
      } catch (error) {
        console.error('Failed to load models:', error);
      }
    };
    loadModels();
  }, []);

  // 监听来自 content script 的消息
  useEffect(() => {
    let initMessage: any = null;

    const messageListener = (message: any, sender: chrome.runtime.MessageSender, sendResponse: (response: any) => void) => {
      if (message.type === 'SIDEBAR_INIT') {
        // 初始化侧边栏
        setSelectedText(message.selectedText || '');
        setContext(message.context || null);
        initMessage = message;

        sendResponse({ success: true });
      }

      return true;
    };

    chrome.runtime.onMessage.addListener(messageListener);

    // 通知 background 侧边栏已准备好
    chrome.runtime.sendMessage({ type: 'SIDEBAR_READY' });

    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
    };
  }, []);

  // 当模型加载完成后，处理初始化消息
  useEffect(() => {
    if (currentModel && availableModels.length > 0) {
      // 检查是否有待处理的初始化消息
      const checkInitMessage = async () => {
        // 从 storage 读取选中的文本和消息
        const result = await chrome.storage.local.get(['pending_sidebar_init']);
        if (result.pending_sidebar_init) {
          const { selectedText, context, userMessage, pageUrl, pageTitle } = result.pending_sidebar_init;
          setSelectedText(selectedText || '');
          setContext(context || null);
          setPageInfo({
            selectedText: selectedText || '',
            pageUrl: pageUrl || '',
            pageTitle: pageTitle || '',
          });

          if (userMessage) {
            const userMsg: ExtendedHistoryMessage = {
              role: 'user',
              content: userMessage,
              timestamp: Date.now(),
            };
            setMessages([userMsg]);
            // 清除 pending 状态
            await chrome.storage.local.remove(['pending_sidebar_init']);
            // 启动 AI 响应 - 传入当前模型和选中文本、上下文
            getAIResponse(userMessage, currentModel, selectedText || '', context || null);
          }
        }
      };
      checkInitMessage();
    }
  }, [currentModel?.id, availableModels.length]); // 只依赖 model.id 和 length，避免重复触发

  // 获取 AI 响应
  const getAIResponse = async (question: string, model?: ModelConfig, initSelectedText?: string, initContext?: { before: string; after: string } | null) => {
    // 如果未传入模型，使用当前模型
    const modelToUse = model || currentModel;

    if (!modelToUse) {
      console.warn('No model selected, showing error message');
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: '请先在配置页面添加并启用模型',
          timestamp: Date.now(),
        },
      ]);
      return;
    }

    setIsLoading(true);
    const startTime = Date.now();

    // 思考过程内容
    let hasReasoning = false;
    let reasoningContent = '';
    let answerContent = '';

    try {
      // 创建端口进行流式通信
      const port = chrome.runtime.connect({ name: 'llm-stream' });
      currentPortRef.current = port;

      port.onMessage.addListener((message) => {
        if (message.type === 'LLM_STREAM_CHUNK') {
          const chunk = message.chunk || '';

          // 处理思考过程标签
          if (chunk === '[REASONING]') {
            hasReasoning = true;
            return;
          }
          if (chunk === '[REASONING_DONE]') {
            return;
          }
          if (chunk.startsWith('[REASONING]')) {
            reasoningContent += chunk.slice(11);
            // 更新消息，包含思考过程
            setMessages(prev => {
              const lastMsg = prev[prev.length - 1];
              if (lastMsg && lastMsg.role === 'assistant') {
                return [
                  ...prev.slice(0, -1),
                  {
                    ...lastMsg,
                    content: answerContent,
                    reasoning: reasoningContent,
                    modelName: modelToUse.name,
                    startTime,
                  },
                ];
              } else {
                return [
                  ...prev,
                  {
                    role: 'assistant',
                    content: answerContent,
                    reasoning: reasoningContent,
                    timestamp: Date.now(),
                    modelName: modelToUse.name,
                    startTime,
                  },
                ];
              }
            });
            return;
          }

          // 回答内容
          answerContent += chunk;
          // 更新 AI 消息
          setMessages(prev => {
            const lastMsg = prev[prev.length - 1];
            if (lastMsg && lastMsg.role === 'assistant') {
              return [
                ...prev.slice(0, -1),
                {
                  ...lastMsg,
                  content: answerContent,
                  reasoning: reasoningContent || undefined,
                  modelName: modelToUse.name,
                  startTime,
                },
              ];
            } else {
              return [
                ...prev,
                {
                  role: 'assistant',
                  content: answerContent,
                  reasoning: reasoningContent || undefined,
                  timestamp: Date.now(),
                  modelName: modelToUse.name,
                  startTime,
                },
              ];
            }
          });
        } else if (message.type === 'LLM_STREAM_END') {
          setIsLoading(false);
          currentPortRef.current = null;
          port.disconnect();
          // 设置最终耗时
          setMessages(prev => {
            const lastMsg = prev[prev.length - 1];
            if (lastMsg && lastMsg.role === 'assistant' && lastMsg.startTime) {
              return [
                ...prev.slice(0, -1),
                {
                  ...lastMsg,
                  duration: Date.now() - lastMsg.startTime,
                },
              ];
            }
            return prev;
          });
        } else if (message.type === 'LLM_STREAM_ERROR') {
          setIsLoading(false);
          currentPortRef.current = null;
          setMessages(prev => [
            ...prev,
            {
              role: 'assistant',
              content: `错误：${message.error}`,
              timestamp: Date.now(),
              modelName: modelToUse.name,
            },
          ]);
          port.disconnect();
        }
      });

      port.onDisconnect.addListener(() => {
        setIsLoading(false);
        currentPortRef.current = null;
      });

      // 根据问题内容判断 action 类型
      let actionType: 'explain' | 'translate' | 'question' | 'search' = 'question';
      if (question === '解释' || question === 'explain') {
        actionType = 'explain';
      } else if (question === '翻译' || question === 'translate') {
        actionType = 'translate';
      } else if (question === '搜索' || question === 'search') {
        actionType = 'search';
      }

      // 使用传入的 selectedText 和 context，如果没有则使用 state 中的值
      const textToUse = initSelectedText !== undefined ? initSelectedText : selectedText;
      const contextToUse = initContext !== undefined ? initContext : context;

      // 发送请求
      port.postMessage({
        type: 'LLM_STREAM_START',
        payload: {
          action: actionType,
          text: textToUse,
          question: actionType === 'question' ? question : undefined,
          context: contextToUse || undefined,
          modelId: modelToUse.id,
        },
      });

    } catch (error) {
      setIsLoading(false);
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: `错误：${error instanceof Error ? error.message : String(error)}`,
          timestamp: Date.now(),
        },
      ]);
    }
  };

  // 发送消息
  const handleSend = async () => {
    const message = inputValue.trim();
    if (!message || isLoading) return;

    // 添加用户消息
    const userMsg: ExtendedHistoryMessage = {
      role: 'user',
      content: message,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');

    // 重置输入框高度
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    // 添加 AI 消息占位
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      modelName: currentModel?.name,
      startTime: Date.now(),
    }]);

    // 获取 AI 响应 - 传入当前模型
    await getAIResponse(message, currentModel);
  };

  // 切换模型
  const handleModelSelect = async (modelId: string) => {
    try {
      await chrome.runtime.sendMessage({
        type: 'SET_SELECTED_CHAT_MODEL',
        modelId,
      });

      // 重新加载模型列表
      const result = await chrome.storage.sync.get(['app_config']);
      const config = result.app_config;

      if (config && config.models) {
        const enabledModels = config.models.filter((m: ModelConfig) => m.enabled);
        const selectedIds = config.selectedChatModelIds || [];

        let modelsToUse: ModelConfig[] = [];

        if (selectedIds.length > 0) {
          // 有选中的模型，按照 selectedIds 的顺序返回选中的模型
          modelsToUse = selectedIds
            .map(id => enabledModels.find(m => m.id === id))
            .filter((m): m is ModelConfig => m !== undefined && m.enabled);
        } else {
          // 没有选中的模型，返回所有启用的
          modelsToUse = enabledModels;
        }

        setAvailableModels(modelsToUse);

        // 直接从 modelsToUse 中查找选中的模型
        const model = modelsToUse.find(m => m.id === modelId);
        if (model) {
          setCurrentModel(model);
        }
      } else {
        // 未找到模型，使用第一个可用模型
        const fallbackModel = modelsToUse[0];
        if (fallbackModel) {
          setCurrentModel(fallbackModel);
        }
      }
      }

      setShowModelSelector(false);
      setDropdownPosition(null);
    } catch (error) {
      console.error('Failed to select model:', error);
    }
  };

  // 切换模型选择器下拉菜单
  const toggleModelSelector = () => {
    if (showModelSelector) {
      setShowModelSelector(false);
      setDropdownPosition(null);
    } else {
      // 计算按钮位置，下拉菜单向上弹出
      if (modelButtonRef.current) {
        const rect = modelButtonRef.current.getBoundingClientRect();
        setDropdownPosition({
          bottom: rect.height + 6, // 按钮上方 6px
          left: 0,
        });
        setShowModelSelector(true);
      }
    }
  };

  // 点击外部关闭下拉菜单
  useEffect(() => {
    if (!showModelSelector) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (modelButtonRef.current && !modelButtonRef.current.contains(e.target as Node)) {
        const dropdown = document.querySelector('.side-panel-model-dropdown');
        if (dropdown && !dropdown.contains(e.target as Node)) {
          setShowModelSelector(false);
          setDropdownPosition(null);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showModelSelector]);

  // 输入框自动调整高度
  const handleTextareaChange = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  };

  // Enter 发送
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (inputValue.trim() && !isLoading) {
        handleSend();
      }
    }
  };

  return (
    <div className="side-panel-container">
      {/* 内容区域 */}
      <div className="side-panel-content" ref={messagesContainerRef}>
        {/* 消息列表 */}
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`side-panel-message side-panel-message-${msg.role}`}
          >
            {msg.role === 'user' ? (
              // 用户消息
              <div className="side-panel-message-wrapper side-panel-message-user-wrapper">
                <div className="side-panel-message-content">
                  {/* 第一条用户消息：显示操作类型和选中文本引用 */}
                  {index === 0 && pageInfo && pageInfo.selectedText ? (
                    <>
                      {/* 操作类型标签 + 展开按钮（长文本时） */}
                      {selectedTextNeedsExpand && (
                        <div
                          className="side-panel-selected-text-header"
                          onClick={() => setSelectedTextExpanded(!selectedTextExpanded)}
                        >
                          <span className="side-panel-selected-text-label">{msg.content}</span>
                          <svg
                            className={`side-panel-selected-text-chevron ${selectedTextExpanded ? '' : 'collapsed'}`}
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M6 9l6 6 6-6"/>
                          </svg>
                        </div>
                      )}
                      {/* 短文本直接显示标签 */}
                      {!selectedTextNeedsExpand && (
                        <div className="side-panel-selected-text-short">
                          <span className="side-panel-selected-text-label">{msg.content}</span>
                        </div>
                      )}
                      {/* Markdown 引用格式显示选中的文本 */}
                      <blockquote
                        ref={selectedTextRef}
                        className={`side-panel-selected-text-blockquote ${selectedTextExpanded ? 'expanded' : ''}`}
                      >
                        {pageInfo.selectedText}
                      </blockquote>
                    </>
                  ) : (
                    // 非第一条消息或没有选中文本时，正常显示消息内容
                    escapeHtml(msg.content)
                  )}
                </div>
                {/* 操作按钮 - 始终显示 */}
                <div className="side-panel-message-actions side-panel-message-actions-always">
                  <button
                    className="side-panel-action-btn"
                    onClick={() => copyToClipboard(msg.content)}
                    title="复制"
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                  </button>
                  <button
                    className="side-panel-action-btn"
                    onClick={() => handleReEdit(msg.content)}
                    title="重新编辑"
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                </div>
              </div>
            ) : (
              // AI 消息
              <div className="side-panel-message-wrapper side-panel-message-ai-wrapper">
                <div className="side-panel-message-content side-panel-ai-content-flat">
                  {/* 思考过程 - 支持展开/收起 */}
                  {msg.reasoning && (
                    <div className="side-panel-reasoning-quote">
                      <div
                        className="side-panel-reasoning-header"
                        onClick={() => toggleReasoning(index)}
                      >
                        <div className="side-panel-reasoning-status">
                          {!msg.duration ? (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="12" cy="12" r="10"/>
                              <path d="M12 6v6l4 2"/>
                            </svg>
                          ) : (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                          )}
                          {/* 大模型名称 */}
                          <span className="side-panel-reasoning-model">{msg.modelName || 'AI'}</span>
                          {!msg.duration ? (
                            <span>思考中...</span>
                          ) : (
                            <span>已思考（用时{formatDuration(msg.duration)}）</span>
                          )}
                        </div>
                        <svg
                          className={`side-panel-reasoning-chevron ${expandedReasoning[index] === false ? 'collapsed' : ''}`}
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M6 9l6 6 6-6"/>
                        </svg>
                      </div>
                      <div
                        className={`side-panel-reasoning-content ${expandedReasoning[index] === false ? 'collapsed' : ''}`}
                      >
                        <div
                          className="side-panel-reasoning-quote-text"
                          dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.reasoning) }}
                        />
                      </div>
                    </div>
                  )}
                  {/* 回答正文 */}
                  <div
                    className="side-panel-answer-content"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                  />
                </div>
                {/* 操作按钮 - 回答完成后或中断后显示 */}
                {(msg.duration || msg.isStopped) && (
                  <div className="side-panel-message-actions side-panel-message-actions-always">
                    <button
                      className="side-panel-action-btn"
                      onClick={() => copyToClipboard(msg.content)}
                      title="复制正文"
                    >
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                      </svg>
                    </button>
                    {/* 重新生成按钮 - 只在最后一条 AI 消息时显示 */}
                    {index === messages.length - 1 && (
                      <button
                        className="side-panel-action-btn"
                        onClick={handleRegenerate}
                        title="重新生成"
                      >
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M23 4v6h-6M1 20v-6h6"/>
                          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                        </svg>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* 输入区域 */}
      <div className="side-panel-input">
        <div className="side-panel-input-box">
          {/* 上栏：文本输入 */}
          <div className="side-panel-input-row">
            <textarea
              ref={textareaRef}
              placeholder="追问或提出新问题..."
              rows={2}
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                handleTextareaChange();
              }}
              onKeyDown={handleKeyDown}
            />
          </div>

          {/* 下栏：模型选择 + 发送按钮 */}
          <div className="side-panel-input-controls">
            {/* 模型选择器 - 左侧 */}
            <div className="side-panel-model-selector-left">
              <button
                ref={modelButtonRef}
                className="side-panel-model-btn-left"
                onClick={toggleModelSelector}
                title="切换模型"
              >
                {/* 科技感神经元图标 - 缩小版 */}
                <svg className="model-icon" viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                  <circle cx="12" cy="5" r="2.5"/>
                  <circle cx="6" cy="12" r="2.5"/>
                  <circle cx="18" cy="12" r="2.5"/>
                  <circle cx="12" cy="19" r="2.5"/>
                  <path d="M12 7.5v2M7.5 12h2M14.5 12h2M12 14.5v2" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                  <path d="M7.5 13.5l3 3M13.5 7.5l3-3M16.5 13.5l-3 3M7.5 10.5l3-3" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.6"/>
                </svg>
                <span>{currentModel?.name || '选择模型'}</span>
                <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 9l6 6 6-6"/>
                </svg>
              </button>

              {showModelSelector && dropdownPosition && (
                <div
                  className="side-panel-model-dropdown"
                  style={{
                    bottom: dropdownPosition.bottom,
                    left: dropdownPosition.left,
                  }}
                >
                  {availableModels.map(model => (
                    <button
                      key={model.id}
                      className={`side-panel-model-option ${currentModel?.id === model.id ? 'active' : ''}`}
                      onClick={() => handleModelSelect(model.id)}
                    >
                      {model.name}
                    </button>
                  ))}
                  {availableModels.length === 0 && (
                    <div className="side-panel-model-empty">
                      请先在配置中添加模型
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              className="side-panel-send"
              onClick={isLoading ? handleStopGeneration : handleSend}
              disabled={!inputValue.trim() && !isLoading}
            >
              {isLoading ? (
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <rect x="7" y="7" width="10" height="10" rx="2.5"/>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                  <path d="M3 12l18-9-7 18-2-7-9-2z"/>
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
