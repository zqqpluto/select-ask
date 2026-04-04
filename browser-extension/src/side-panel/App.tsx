<<<<<<< HEAD
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
  return marked(text);
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

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const currentPortRef = useRef<chrome.runtime.Port | null>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(false);
  const [userHasScrolled, setUserHasScrolled] = useState(false);
  const modelButtonRef = useRef<HTMLButtonElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(null);

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
    // 标记最后一条 AI 消息为已中断
    setMessages(prev => {
      const lastAiIndex = prev.map((m, i) => m.role === 'assistant' ? i : -1).filter(i => i !== -1).pop();
      if (lastAiIndex !== undefined && lastAiIndex >= 0) {
        return prev.map((msg, index) =>
          index === lastAiIndex ? { ...msg, isStopped: true } : msg
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

        console.log('Side Panel loaded config:', config);
        console.log('Models in config:', config?.models);
        console.log('selectedChatModelIds:', config?.selectedChatModelIds);

        if (config && config.models) {
          // 获取所有启用且参与问答的模型
          const enabledModels = config.models
            .filter((m: ModelConfig) => {
              console.log(`Model ${m.name}: enabled=${m.enabled}, enableChat=${m.enableChat}`);
              return m.enabled && (m.enableChat !== false);
            })
            .map((m: ModelConfig) => ({
              id: m.id,
              name: m.name,
              provider: m.provider,
              modelId: m.modelId,
            }));

          // 获取选中的模型 ID 列表
          const selectedIds = config.selectedChatModelIds || [];

          console.log('Enabled models count:', enabledModels.length);
          console.log('Enabled models:', enabledModels);
          console.log('Selected IDs:', selectedIds);

          let modelsToUse: ModelConfig[] = [];

          if (selectedIds.length > 0) {
            // 有选中的模型，只返回选中的（且启用的）
            modelsToUse = enabledModels.filter(
              (m: ModelConfig) => selectedIds.includes(m.id)
            );
            console.log('Selected models:', modelsToUse);
          } else {
            // 没有选中的模型，返回所有启用的
            modelsToUse = enabledModels;
            console.log('Using all enabled models:', modelsToUse);
          }

          setAvailableModels(modelsToUse);
          if (modelsToUse.length > 0) {
            setCurrentModel(modelsToUse[0]);
          } else {
            console.warn('No models available!');
          }
        }
=======
import React, { useEffect, useState } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { useSidePanelStore } from './store';
import FileUpload from '../components/FileUpload';
import './style.css';

// Import highlight.js themes
import 'highlight.js/styles/github.css'; // Light theme
import 'highlight.js/styles/github-dark.css'; // Dark theme (will be toggled via CSS)

// Configure marked options with code highlighting
marked.setOptions({
  breaks: true,
  gfm: true,
  highlight: function(code: string, lang: string) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(code, { language: lang }).value;
      } catch (err) {
        console.error('Highlight.js error:', err);
      }
    }
    // Auto-detect language if not specified
    return hljs.highlightAuto(code).value;
  }
});

const SidePanelApp: React.FC = () => {
  const {
    currentConversation,
    conversations,
    isLoading,
    error,
    theme,
    createConversation,
    addMessage,
    setCurrentConversation,
    deleteConversation,
    clearAllConversations,
    setLoading,
    setError,
    updateLastMessage,
    setTheme
  } = useSidePanelStore();

  const [inputValue, setInputValue] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState<string>('');
  const [enabledModels, setEnabledModels] = useState<any[]>([]);

  // 加载模型配置
  useEffect(() => {
    const loadModels = async () => {
      try {
        const result = await chrome.storage.sync.get('app_config');
        const config = result?.app_config;
        const models = config?.models?.filter((m: any) => m.enabled) || [];
        const selectedId = config?.selectedChatModelIds?.[0] || '';
        setEnabledModels(models);
        setSelectedModelId(selectedId);
>>>>>>> 336296e16762d442fbf2cafa7d870fd6cd2a780e
      } catch (error) {
        console.error('Failed to load models:', error);
      }
    };
    loadModels();
  }, []);

<<<<<<< HEAD
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
          console.log('Processing pending init message:', userMessage);
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
            console.log('Starting AI response with loaded model:', currentModel.id, currentModel.name);
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

    console.log('getAIResponse called, modelToUse:', modelToUse, 'currentModel:', currentModel);
    console.log('initSelectedText:', initSelectedText, 'selectedText state:', selectedText);

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

    console.log('Starting LLM request with model:', modelToUse.id, modelToUse.name);
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
=======
  // 暴露 store 到 window 对象以便测试访问
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__ZUSTAND_STORE__ = useSidePanelStore;
    }
  }, []);

  // Apply theme to root element
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
  }, [theme]);

  // 监听来自 content script 的消息
  useEffect(() => {
    const handleMessage = (message: any, sender: any, sendResponse: any) => {
      if (message.type === 'START_CHAT') {
        handleNewChat(message.payload);
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);

    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, []);

  const handleNewChat = async (payload: { action: string; selectedText: string; context?: any }) => {
    try {
      // 创建新对话
      createConversation(payload);

      // 等待状态更新后发送消息
      setTimeout(() => {
        sendAIMessage();
      }, 100);
    } catch (error: any) {
      setError(error.message || 'Failed to start conversation');
    }
  };

  const sendAIMessage = async () => {
    try {
      setLoading(true);
      setError(null);

      const conversation = useSidePanelStore.getState().currentConversation;
      if (!conversation) return;

      // 从 chrome.storage.sync 读取模型配置
      const result = await chrome.storage.sync.get('app_config');
      const config = result?.app_config;
      const selectedModelId = config?.selectedChatModelIds?.[0];

      if (!selectedModelId) {
        setError('请先在设置中配置模型');
        setLoading(false);
        return;
      }

      // 获取模型配置（包含 API Key 等）
      const models = config?.models || [];
      const selectedModel = models.find((m: any) => m.id === selectedModelId);
      if (!selectedModel) {
        setError('模型配置不存在，请在设置中重新配置');
        setLoading(false);
        return;
      }

      // Call LLM via background
      const port = chrome.runtime.connect({ name: 'sidepanel-llm-stream' });
      let responseText = '';

      console.log('=== Side Panel: Connected to LLM stream port ===');

      port.onMessage.addListener((message) => {
        console.log('=== Side Panel: Received message ===', message.type);
        if (message.type === 'LLM_STREAM_CHUNK') {
          responseText += message.chunk;
          useSidePanelStore.getState().updateLastMessage(responseText);
        } else if (message.type === 'LLM_STREAM_END') {
          console.log('=== Side Panel: LLM stream ended ===');
          setLoading(false);
          port.disconnect();
        } else if (message.type === 'LLM_STREAM_ERROR') {
          console.error('=== Side Panel: LLM stream error ===', message.error);
          setError(message.error);
          setLoading(false);
>>>>>>> 336296e16762d442fbf2cafa7d870fd6cd2a780e
          port.disconnect();
        }
      });

      port.onDisconnect.addListener(() => {
<<<<<<< HEAD
        setIsLoading(false);
        currentPortRef.current = null;
      });

      // 根据问题内容判断 action 类型
      let actionType: 'explain' | 'translate' | 'question' = 'question';
      if (question === '解释' || question === 'explain') {
        actionType = 'explain';
      } else if (question === '翻译' || question === 'translate') {
        actionType = 'translate';
      }

      // 使用传入的 selectedText 和 context，如果没有则使用 state 中的值
      const textToUse = initSelectedText !== undefined ? initSelectedText : selectedText;
      const contextToUse = initContext !== undefined ? initContext : context;

      console.log('Sending to LLM:', {
        action: actionType,
        text: textToUse,
        question: actionType === 'question' ? question : undefined,
        context: contextToUse,
      });

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

        if (selectedIds.length > 0) {
          const selectedModels = enabledModels.filter(
            (m: ModelConfig) => selectedIds.includes(m.id)
          );
          setAvailableModels(selectedModels);
          if (selectedModels.length > 0) {
            setCurrentModel(selectedModels[0]);
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
      // 计算按钮位置
      if (modelButtonRef.current) {
        const rect = modelButtonRef.current.getBoundingClientRect();
        setDropdownPosition({
          top: rect.top - 8, // 按钮上方 8px
          left: rect.left,
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
=======
        console.log('=== Side Panel: Port disconnected ===');
      });

      port.postMessage({
        type: 'LLM_REQUEST',
        payload: {
          messages: conversation.messages.map((m) => ({
            role: m.role,
            content: m.content
          })),
          modelId: selectedModelId
        }
      });

      console.log('=== Side Panel: Sent LLM REQUEST ===', {
        modelId: selectedModelId,
        messagesCount: conversation.messages.length
      });
    } catch (error: any) {
      setError(error.message || 'Failed to get response');
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    const content = inputValue.trim();
    setInputValue('');

    // Add user message
    addMessage(content, 'user');

    // Add empty assistant message
    addMessage('', 'assistant');

    // Wait for state update
    setTimeout(() => {
      sendAIMessage();
    }, 100);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  /**
   * 处理文件上传
   * 将提取的文本添加到输入框
   */
  const handleFileSelect = (text: string, imageData?: string) => {
    // 将提取的文本添加到输入框
    setInputValue(prev => {
      if (prev.trim()) {
        return prev + '\n\n' + text;
      }
      return text;
    });

    // TODO: 如果有图片数据且当前模型支持 Vision，可以显示图片预览
    // 并在发送消息时包含图片数据
    if (imageData) {
      console.log('Image data received, Vision support can be added later');
    }
  };

  /**
   * 渲染数学公式
   * 支持块级公式 $$...$$ 和行内公式 $...$
   */
  const renderMath = (text: string): string => {
    // 先处理块级公式 $$...$$
    text = text.replace(/\$\$([^$]+)\$\$/g, (match, formula) => {
      try {
        return `<div class="katex-block">${katex.renderToString(formula.trim(), {
          displayMode: true,
          throwOnError: false,
          errorColor: '#cc0000'
        })}</div>`;
      } catch (error) {
        console.error('KaTeX rendering error:', error);
        return `<div class="katex-error">公式语法错误: ${formula}</div>`;
      }
    });

    // 再处理行内公式 $...$
    text = text.replace(/\$([^$]+)\$/g, (match, formula) => {
      try {
        return katex.renderToString(formula.trim(), {
          displayMode: false,
          throwOnError: false,
          errorColor: '#cc0000'
        });
      } catch (error) {
        console.error('KaTeX rendering error:', error);
        return `<span class="katex-error">公式语法错误: ${formula}</span>`;
      }
    });

    return text;
  };

  /**
   * 为代码块添加复制按钮
   */
  useEffect(() => {
    if (!currentConversation) return;

    // 为所有代码块添加复制按钮
    const codeBlocks = document.querySelectorAll('.markdown-body pre');
    codeBlocks.forEach((block) => {
      // 避免重复添加
      if (block.querySelector('.copy-code-btn')) return;

      const button = document.createElement('button');
      button.className = 'copy-code-btn';
      button.textContent = '复制';
      button.onclick = async () => {
        const code = block.querySelector('code')?.textContent || '';
        try {
          await navigator.clipboard.writeText(code);
          button.textContent = '已复制!';
          setTimeout(() => {
            button.textContent = '复制';
          }, 2000);
        } catch (err) {
          console.error('Failed to copy code:', err);
          button.textContent = '复制失败';
          setTimeout(() => {
            button.textContent = '复制';
          }, 2000);
        }
      };

      // 设置代码块的相对定位
      (block as HTMLElement).style.position = 'relative';
      block.appendChild(button);
    });
  }, [currentConversation?.messages]);

  const renderMarkdown = (content: string) => {
    if (!content) return '';
    try {
      // 先渲染数学公式，再渲染 Markdown
      const mathRendered = renderMath(content);
      const rawHtml = marked(mathRendered) as string;
      const cleanHtml = DOMPurify.sanitize(rawHtml);
      return { __html: cleanHtml };
    } catch (error) {
      console.error('Markdown render error:', error);
      return { __html: DOMPurify.sanitize(content) };
>>>>>>> 336296e16762d442fbf2cafa7d870fd6cd2a780e
    }
  };

  return (
<<<<<<< HEAD
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
                  {escapeHtml(msg.content)}
                  {/* 第一条用户消息气泡内显示选中文本引用 */}
                  {index === 0 && pageInfo && pageInfo.selectedText && (
                    <div className="side-panel-selected-text-quote">
                      <div className="side-panel-selected-text-quote-header">
                        <span>Selected Text</span>
                        {pageInfo.selectedText.length > 100 && (
                          <button
                            className="side-panel-quote-toggle-btn"
                            onClick={() => setSelectedTextExpanded(!selectedTextExpanded)}
                            title={selectedTextExpanded ? '收起' : '展开'}
                          >
                            {selectedTextExpanded ? (
                              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M6 9l6-6 6 6"/>
                              </svg>
                            ) : (
                              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M6 9l6 6 6-6"/>
                              </svg>
                            )}
                          </button>
                        )}
                      </div>
                      <blockquote className={`side-panel-selected-text-blockquote ${selectedTextExpanded ? 'expanded' : ''}`}>
                        {pageInfo.selectedText}
                      </blockquote>
                    </div>
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
                          <span className="side-panel-reasoning-model">{msg.modelName}</span>
                          {!msg.duration ? (
                            <span>思考中</span>
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
            {/* 模型选择器 */}
            <div className="side-panel-model-selector">
              <button
                ref={modelButtonRef}
                className="side-panel-model-btn"
                onClick={toggleModelSelector}
                title="切换模型"
              >
                {/* 科技感神经元图标 - 缩小版 */}
                <svg className="model-icon" viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                  <circle cx="12" cy="5" r="2.5"/>
                  <circle cx="6" cy="12" r="2.5"/>
                  <circle cx="18" cy="12" r="2.5"/>
                  <circle cx="12" cy="19" r="2.5"/>
                  <path d="M12 7.5v2M7.5 12h2M14.5 12h2M12 14.5v2" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                  <path d="M7.5 13.5l3 3M13.5 7.5l3-3M16.5 13.5l-3 3M7.5 10.5l3-3" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.6"/>
                </svg>
                <span>{currentModel?.name || '选择模型'}</span>
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 9l6 6 6-6"/>
                </svg>
              </button>

              {showModelSelector && dropdownPosition && (
                <div
                  className="side-panel-model-dropdown"
                  style={{
                    top: dropdownPosition.top,
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
                  <path d="M12 3L4 19h5v2h6v-2h5L12 3z"/>
                </svg>
              )}
            </button>
          </div>
=======
    <div className="side-panel select-ask-chat-box">
      {/* 顶部标题栏 */}
      <div className="header select-ask-chat-header">
        <div className="select-ask-chat-header-title">
          <svg className="select-ask-chat-header-logo" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1v-1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"/>
          </svg>
          <span className="select-ask-chat-header-name">select ask</span>
          <span className="select-ask-chat-header-divider">·</span>
          <span className="select-ask-chat-header-slogan">选中即问，知识自来</span>
        </div>
        <div className="select-ask-chat-header-actions">
          <button
            className="select-ask-fullscreen-btn"
            onClick={() => {/* TODO: 实现全屏功能 */}}
            title="全屏"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
            </svg>
          </button>
          <button
            className="select-ask-history-btn"
            onClick={() => setShowHistory(!showHistory)}
            title="历史记录"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </button>
          {/* 主题切换按钮 - 保留的改进功能 */}
          <button
            className="icon-btn"
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            title={theme === 'light' ? '切换到暗色主题' : '切换到亮色主题'}
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
          {/* 设置按钮 - 保留的改进功能 */}
          <button
            className="icon-btn"
            onClick={() => chrome.runtime.openOptionsPage()}
            title="设置"
          >
            ⚙️
          </button>
        </div>
      </div>

      {/* 主内容区 */}
      <div className="main-content">
        {/* 历史记录侧边栏 */}
        {showHistory && (
          <div className="history-sidebar">
            <div className="history-header">
              <h2>历史记录</h2>
              <button onClick={clearAllConversations} className="clear-btn">
                清空
              </button>
            </div>
            <div className="history-list">
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  className={`history-item ${currentConversation?.id === conv.id ? 'active' : ''}`}
                  onClick={() => setCurrentConversation(conv)}
                >
                  <div className="history-title">{conv.title}</div>
                  <div className="history-date">
                    {new Date(conv.createdAt).toLocaleDateString()}
                  </div>
                  <button
                    className="delete-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteConversation(conv.id);
                    }}
                  >
                    🗑️
                  </button>
                </div>
              ))}
              {conversations.length === 0 && (
                <div className="empty-history">暂无历史记录</div>
              )}
            </div>
          </div>
        )}

        {/* 对话区域 */}
        <div className="chat-area">
          {currentConversation ? (
            <>
              {/* 消息列表 */}
              <div className="messages select-ask-chat-container">
                {currentConversation.messages.map((msg, index) => (
                  <div key={msg.id} className={`message select-ask-message ${msg.role === 'user' ? 'select-ask-message-user' : 'select-ask-message-ai'}`}>
                    {msg.role === 'user' ? (
                      <>
                        <div className="avatar avatar-user select-ask-message-avatar select-ask-avatar-user">
                          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                          </svg>
                        </div>
                        <div className="message-content user-content select-ask-message-content">
                          <div className="message-time select-ask-message-time">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                          <div className="user-content-wrapper select-ask-message-body">
                            <div className="user-content-text select-ask-message-text">
                              {msg.content}
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="avatar avatar-ai select-ask-message-avatar select-ask-avatar-ai">
                          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                            <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1v-1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2zM7.5 13A2.5 2.5 0 0 0 5 15.5 2.5 2.5 0 0 0 7.5 18 2.5 2.5 0 0 0 10 15.5 2.5 2.5 0 0 0 7.5 13zm9 0a2.5 2.5 0 0 0-2.5 2.5 2.5 2.5 0 0 0 2.5 2.5 2.5 2.5 0 0 0 2.5-2.5 2.5 2.5 0 0 0-2.5-2.5z"/>
                          </svg>
                        </div>
                        <div className="message-content assistant-content select-ask-message-content select-ask-ai-content">
                          <div className="assistant-header select-ask-ai-header">
                            <span className="message-time select-ask-message-time">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            <span className="ai-divider select-ask-ai-divider">·</span>
                            <span className="model-name select-ask-ai-model-name">AI</span>
                            <span className="ai-divider select-ask-ai-divider">·</span>
                            <span className="ai-time select-ask-ai-time"></span>
                          </div>
                          <div
                            className="markdown-body select-ask-answer-text"
                            dangerouslySetInnerHTML={renderMarkdown(msg.content)}
                          />
                        </div>
                      </>
                    )}
                  </div>
                ))}
                {isLoading && currentConversation.messages[currentConversation.messages.length - 1]?.role === 'assistant' && (
                  <div className="loading-indicator">
                    <div className="typing-dots">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </div>
                )}
              </div>

              {/* 文件上传区域 */}
              <FileUpload
                onFileSelect={handleFileSelect}
                onError={setError}
                disabled={isLoading}
              />

              {/* 输入框 */}
              <div className="input-area select-ask-input-area">
                <div className="input-box select-ask-input-box">
                  <div className="controls-row select-ask-controls-row">
                    {/* 模型选择器 */}
                    <div className="select-ask-model-selector-wrapper">
                      <select
                        className="select-ask-model-selector"
                        value={selectedModelId}
                        onChange={async (e) => {
                          const newModelId = e.target.value;
                          setSelectedModelId(newModelId);
                          // 保存到配置
                          const result = await chrome.storage.sync.get('app_config');
                          const config = result?.app_config;
                          if (config) {
                            config.selectedChatModelIds = [newModelId];
                            await chrome.storage.sync.set({ app_config: config });
                          }
                        }}
                      >
                        {enabledModels.length === 0 ? (
                          <option value="">暂无可用模型</option>
                        ) : (
                          enabledModels.map(model => (
                            <option key={model.id} value={model.id}>{model.name}</option>
                          ))
                        )}
                      </select>
                      <span className="select-ask-model-selector-arrow">▼</span>
                    </div>
                    <button
                      onClick={handleSend}
                      disabled={!inputValue.trim() || isLoading}
                      className="send-btn select-ask-send-icon"
                    >
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 19V5M5 12l7-7 7 7"/>
                      </svg>
                    </button>
                  </div>
                  <div className="input-row select-ask-input-row">
                    <textarea
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={handleKeyPress}
                      placeholder="追问或提出新问题..."
                      disabled={isLoading}
                      rows={1}
                      className="select-ask-textarea"
                    />
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">🤖</div>
              <h2>Select Ask</h2>
              <p>选择网页文本即可开始对话</p>
              <p className="hint">支持：</p>
              <ul>
                <li>🔍 AI搜索</li>
                <li>💡 解释说明</li>
                <li>🌐 智能翻译</li>
                <li>📄 内容总结</li>
              </ul>
            </div>
          )}

          {/* 错误提示 */}
          {error && (
            <div className="error-banner">
              <span>{error}</span>
              <button onClick={() => setError(null)}>✕</button>
            </div>
          )}
>>>>>>> 336296e16762d442fbf2cafa7d870fd6cd2a780e
        </div>
      </div>
    </div>
  );
<<<<<<< HEAD
}
=======
};

export default SidePanelApp;
>>>>>>> 336296e16762d442fbf2cafa7d870fd6cd2a780e
