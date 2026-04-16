import { useEffect, useState, useRef } from 'react';
import { marked } from 'marked';
import type { HistoryMessage, ModelConfig } from '../types';
import { generateSessionId, generateTitle } from '../utils/history-manager';

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

// 格式化 URL 显示：域名 + 精简路径
function formatUrlForDisplay(url: string): { displayText: string; faviconUrl: string } {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.replace(/^www\./, '');
    const path = parsed.pathname;
    const pathShort = path.length > 30 ? path.slice(0, 27) + '...' : path;
    const displayText = pathShort ? `${hostname}${pathShort}` : hostname;
    const faviconUrl = `${parsed.origin}/favicon.ico`;
    return { displayText, faviconUrl };
  } catch {
    return { displayText: url, faviconUrl: '' };
  }
}

interface ExtendedHistoryMessage extends HistoryMessage {
  modelName?: string;
  duration?: number;
  startTime?: number;
  reasoning?: string;
  isStopped?: boolean; // 标记是否被中断
  questions?: string[]; // 推荐问题列表（用于独立消息展示）
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

  // 追问气泡相关状态
  const [recommendedQuestions, setRecommendedQuestions] = useState<string[]>([]);
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [autoGenerateEnabled, setAutoGenerateEnabled] = useState(true); // 默认开启
  const [hasGeneratedQuestions, setHasGeneratedQuestions] = useState(false); // 是否已生成过推荐问题
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null); // 当前会话 ID，用于保存历史

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const currentPortRef = useRef<chrome.runtime.Port | null>(null);
  const messagesCountRef = useRef(0); // 跟踪实时消息数，用于判断用户是否已发送新消息
  const [shouldAutoScroll, setShouldAutoScroll] = useState(false);
  const [userHasScrolled, setUserHasScrolled] = useState(false);
  const modelButtonRef = useRef<HTMLButtonElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(null);
  const selectedTextRef = useRef<HTMLQuoteElement>(null);

  // 保持 messagesCountRef 与实时消息数同步
  useEffect(() => {
    messagesCountRef.current = messages.length;
  }, [messages]);

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

  // 重新生成指定索引的 AI 消息
  const handleRegenerate = async (messageIndex?: number) => {
    // 如果传入了索引，重新生成该条消息；否则重新生成最后一条
    const targetIndex = messageIndex ?? messages.map((m, i) => m.role === 'assistant' ? i : -1).filter(i => i !== -1).pop();
    if (targetIndex === undefined || targetIndex < 0) return;

    // 找到对应的用户消息
    const userMsgIndex = targetIndex > 0 ? targetIndex - 1 : null;
    if (userMsgIndex === null || messages[userMsgIndex]?.role !== 'user') return;

    const userMessage = messages[userMsgIndex].content;

    // 移除 AI 消息（包括可能跟在后面的推荐问题消息）
    setMessages(prev => {
      // 如果下一条是推荐问题消息，也一起移除
      const nextMsg = prev[targetIndex + 1];
      if (nextMsg && nextMsg.questions) {
        return prev.slice(0, targetIndex);
      }
      return prev.slice(0, targetIndex);
    });

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
              .map((id: string) => enabledModels.find((m: ModelConfig) => m.id === id))
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

        // 读取用户偏好设置，获取自动推荐问题开关状态
        if (config && config.preferences) {
          setAutoGenerateEnabled(config.preferences.autoGenerateQuestions !== false);
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

    // 建立长连接，让 background 跟踪 side panel 是否打开
    const port = chrome.runtime.connect({ name: 'sidepanel' });
    port.onDisconnect.addListener(() => {
      chrome.storage.local.remove('pending_sidebar_init').catch(() => {});
    });

    const messageListener = (message: any, sender: chrome.runtime.MessageSender, sendResponse: (response: any) => void) => {
      if (message.type === 'SIDEBAR_INIT') {
        // 已打开的侧边栏收到新的初始化请求——写入 storage 后触发 storage onChanged 监听器
        chrome.storage.local.set({
          pending_sidebar_init: {
            selectedText: message.selectedText,
            context: message.context,
            userMessage: message.userMessage,
            summaryPrompt: message.summaryPrompt,
            pageUrl: message.pageUrl,
            pageTitle: message.pageTitle,
          },
        }).catch(console.error);
        sendResponse({ success: true });
      } else if (message.type === 'CLOSE_SIDE_PANEL') {
        window.close();
        sendResponse({ success: true });
      }

      return true;
    };

    chrome.runtime.onMessage.addListener(messageListener);

    chrome.runtime.sendMessage({ type: 'SIDEBAR_READY' });

    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
      port.disconnect();
    };
  }, []);

  // 监听 storage 变化（处理已打开侧边栏收到新页面总结请求的场景）
  useEffect(() => {
    const storageListener = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
      if (areaName === 'local' && changes.pending_sidebar_init?.newValue) {
        const { selectedText, context, userMessage, summaryPrompt, pageUrl, pageTitle } = changes.pending_sidebar_init.newValue;
        setSelectedText(selectedText || '');
        setContext(context || null);
        setPageInfo({
          selectedText: selectedText || '',
          pageUrl: pageUrl || '',
          pageTitle: pageTitle || '',
        });
        if (userMessage && currentModel) {
          const userMsg: ExtendedHistoryMessage = {
            role: 'user',
            content: userMessage,
            timestamp: Date.now(),
          };
          if (summaryPrompt) {
            // 页面总结：替换当前对话
            setMessages([userMsg]);
            getAIResponseWithMessages(summaryPrompt, currentModel);
          } else {
            // 普通请求：追加到现有对话
            setMessages(prev => [...prev, userMsg]);
            getAIResponse(userMessage, currentModel, selectedText || '', context || null);
          }
          // 处理完后清除 pending
          setTimeout(() => {
            chrome.storage.local.remove('pending_sidebar_init').catch(() => {});
          }, 500);
        }
      }
    };
    chrome.storage.onChanged.addListener(storageListener);
    return () => {
      chrome.storage.onChanged.removeListener(storageListener);
    };
  }, [currentModel]);

  // 当模型加载完成后，处理初始化消息
  useEffect(() => {
    if (currentModel && availableModels.length > 0) {
      // 检查是否有待处理的初始化消息
      const checkInitMessage = async () => {
        // 从 storage 读取选中的文本和消息
        const result = await chrome.storage.local.get(['pending_sidebar_init']);
        if (result.pending_sidebar_init) {
          const { selectedText, context, userMessage, summaryPrompt, pageUrl, pageTitle } = result.pending_sidebar_init;
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
            // 创建会话 ID 用于保存历史
            const sessionId = generateSessionId();
            setCurrentSessionId(sessionId);
            // 清除 pending 状态
            await chrome.storage.local.remove(['pending_sidebar_init']);

            // 如果有 summaryPrompt（页面总结场景），使用 messages 数组格式绕过 text 校验
            if (summaryPrompt) {
              getAIResponseWithMessages(summaryPrompt, currentModel);
            } else {
              getAIResponse(userMessage, currentModel, selectedText || '', context || null);
            }
          }
        }
      };
      checkInitMessage();
    }
  }, [currentModel?.id, availableModels.length]); // 只依赖 model.id 和 length，避免重复触发

  // 生成追问问题（在 AI 回答完成后调用）
  const generateFollowUpQuestions = async (
    selectedText: string,
    context: { before: string; after: string } | null,
    model: ModelConfig
  ): Promise<string[]> => {
    return new Promise((resolve) => {
      const port = chrome.runtime.connect({ name: 'llm-stream' });
      let fullContent = '';

      port.onMessage.addListener((message) => {
        if (message.type === 'LLM_STREAM_CHUNK') {
          fullContent += message.chunk || '';
        } else if (message.type === 'LLM_STREAM_END') {
          // 过滤掉 [REASONING] 标签
          const cleanedContent = fullContent
            .replace(/\[REASONING\]/g, '')
            .replace(/\[REASONING_DONE\]/g, '')
            .replace(/\[ANSWER\]/g, '')
            .replace(/\[ANSWER_DONE\]/g, '');

          // 解析问题（多层过滤机制）
          const questions = cleanedContent
            .split('\n')                              // 第 1 层：按行分割
            .map(q => q.trim())                       // 去除空白
            .filter(q => q.length > 0 && q.length < 200)  // 第 2 层：长度检查
            .map(q => {
              // 第 3 层：移除序号和符号（参考 options 页面和 base.ts）
              let cleaned = q;
              // 先移除开头的数字和符号（如 "1."、"2)"、"- "、"* " 等）
              cleaned = cleaned.replace(/^[\d\-\•\*]+\s*[.)]?\s*/, '');
              // 再移除剩余的非中文字符（如 "第一个问题："）
              while (cleaned && !cleaned[0].match(/[\u4e00-\u9fa5a-zA-Z?]/)) {
                cleaned = cleaned.slice(1);
              }
              return cleaned.trim();
            })
            .filter(q => {
              // 第 4 层：过滤推理关键词
              if (q.length === 0) return false;
              const skipKeywords = [
                '首先', '接下来', '然后', '最后',
                '用户可能', '用户需要', '我得',
                '所以', '因为', '这是一个',
                '分析', '推理', '嗯，', '嗯,', '想想',
                '第一个问题', '第二个问题', '第三个问题'
              ];
              if (skipKeywords.some(keyword => q.includes(keyword))) return false;
              // 第 5 层：只保留包含问号或疑问词的行（确保是问题格式）
              return q.includes('?') || q.includes('？') ||
                     q.includes('什么') || q.includes('如何') ||
                     q.includes('怎么') || q.includes('为什么') ||
                     q.includes('是否') || q.includes('哪些') ||
                     q.includes('哪里') || q.includes('吗');
            })
            .slice(0, 3);  // 第 6 层：限制数量为 3 个
          port.disconnect();
          resolve(questions);
        } else if (message.type === 'LLM_STREAM_ERROR') {
          port.disconnect();
          resolve([]);
        }
      });

      port.onDisconnect.addListener(() => {
        resolve([]);
      });

      // 发送请求
      port.postMessage({
        type: 'LLM_STREAM_START',
        payload: {
          action: 'generateQuestions',
          text: selectedText,
          context: context || undefined,
          modelId: model.id,
        },
      });
    });
  };

  // 保存对话到历史记录
  const saveToHistory = async (modelToUse: ModelConfig, textForTitle: string, contextForSession: { before: string; after: string } | null) => {
    // 如果没有会话 ID，自动创建一个
    let sessionId = currentSessionId;
    if (!sessionId) {
      sessionId = generateSessionId();
      setCurrentSessionId(sessionId);
    }

    try {
      const sessions = await chrome.storage.local.get('select_ask_history');
      const history = (sessions as any).select_ask_history || { sessions: [] };
      const messagesToSave: HistoryMessage[] = messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp || Date.now(),
        ...(msg.reasoning ? { reasoning: msg.reasoning } : {}),
        ...(msg.modelName ? { modelName: msg.modelName } : {}),
        ...(msg.duration ? { duration: msg.duration } : {}),
      }));

      const typeMap: Record<string, string> = {
        '解释': 'explain',
        '翻译': 'translate',
        '搜索': 'search',
        '总结页面': 'summarize',
      };
      const firstMsg = messages[0];
      const sessionType = typeMap[firstMsg?.content] || 'question';

      // 标题：如果 textForTitle 太长（summaryPrompt 场景），用第一条消息内容
      const sessionTitle = textForTitle.length > 100
        ? (firstMsg?.content || '对话')
        : generateTitle(textForTitle, sessionType);

      const session = {
        id: sessionId,
        title: sessionTitle,
        type: sessionType,
        selectedText: textForTitle.length > 100 ? '' : textForTitle,
        messages: messagesToSave,
        modelId: modelToUse.id,
        modelName: modelToUse.name,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        pageUrl: pageInfo.pageUrl || undefined,
        pageTitle: pageInfo.pageTitle || undefined,
      };

      // 检查是否已存在，存在则更新，否则新增
      const existingIndex = history.sessions.findIndex((s: any) => s.id === sessionId);
      if (existingIndex >= 0) {
        history.sessions[existingIndex] = { ...session, updatedAt: Date.now() };
      } else {
        history.sessions.unshift(session);
      }

      // 限制最多 100 条
      if (history.sessions.length > 100) {
        history.sessions = history.sessions.slice(0, 100);
      }

      await chrome.storage.local.set({ select_ask_history: { sessions: history.sessions, maxSessions: 100 } });
    } catch (error) {
      console.error('[saveToHistory] 保存失败:', error);
    }
  };

  // 获取 AI 响应（使用 messages 数组格式，适用于页面总结等无选中文本的场景）
  const getAIResponseWithMessages = async (prompt: string, model?: ModelConfig) => {
    const modelToUse = model || currentModel;
    if (!modelToUse) {
      setMessages(prev => [...prev, { role: 'assistant', content: '请先在配置页面添加并启用模型', timestamp: Date.now() }]);
      return;
    }

    setIsLoading(true);
    const startTime = Date.now();
    let reasoningContent = '';
    let answerContent = '';

    try {
      const port = chrome.runtime.connect({ name: 'llm-stream' });
      currentPortRef.current = port;

      port.onMessage.addListener((message) => {
        if (message.type === 'LLM_STREAM_CHUNK') {
          const chunk = message.chunk || '';

          // 处理思考过程标签（与 getAIResponse 保持一致）
          if (chunk === '[REASONING]' || chunk === '[REASONING_DONE]') {
            return;
          }
          if (chunk.startsWith('[REASONING]')) {
            reasoningContent += chunk.slice(11);
            setMessages(prev => {
              const lastMsg = prev[prev.length - 1];
              if (lastMsg && lastMsg.role === 'assistant') {
                return [...prev.slice(0, -1), { ...lastMsg, content: answerContent, reasoning: reasoningContent, modelName: modelToUse.name, startTime }];
              }
              return [...prev, { role: 'assistant', content: answerContent, reasoning: reasoningContent, timestamp: Date.now(), modelName: modelToUse.name, startTime }];
            });
            return;
          }
          if (chunk === '[ANSWER]' || chunk === '[ANSWER_DONE]') {
            return;
          }

          answerContent += chunk;
          setMessages(prev => {
            const lastMsg = prev[prev.length - 1];
            if (lastMsg && lastMsg.role === 'assistant') {
              return [...prev.slice(0, -1), { ...lastMsg, content: answerContent, reasoning: reasoningContent || undefined, modelName: modelToUse.name, startTime }];
            }
            return [...prev, { role: 'assistant', content: answerContent, reasoning: reasoningContent || undefined, timestamp: Date.now(), modelName: modelToUse.name, startTime }];
          });
        } else if (message.type === 'LLM_STREAM_END') {
          // AI 回答完成，立即设置耗时
          const answerStartTime = startTime;
          setMessages(prev => {
            const aiMsgIndex = prev.findIndex(m => m.role === 'assistant' && m.startTime && m.duration === undefined);
            if (aiMsgIndex !== -1) {
              const aiMsg = prev[aiMsgIndex];
              const newPrev = [...prev];
              newPrev[aiMsgIndex] = { ...aiMsg, duration: Date.now() - answerStartTime };
              return newPrev;
            }
            return prev;
          });

          setIsLoading(false);
          currentPortRef.current = null;
          port.disconnect();

          // 保存到历史记录（页面总结场景）
          saveToHistory(modelToUse, prompt, null);
        } else if (message.type === 'LLM_STREAM_ERROR') {
          setIsLoading(false);
          currentPortRef.current = null;
          setMessages(prev => [...prev, { role: 'assistant', content: `错误：${message.error}`, timestamp: Date.now(), modelName: modelToUse.name }]);
          port.disconnect();
        }
      });

      port.onDisconnect.addListener(() => {
        setIsLoading(false);
        currentPortRef.current = null;
      });

      // 使用 messages 数组格式发送请求
      port.postMessage({
        type: 'LLM_STREAM_START',
        payload: {
          messages: [{ role: 'user', content: prompt }],
          modelId: modelToUse.id,
        },
      });
    } catch (error) {
      setIsLoading(false);
      setMessages(prev => [...prev, { role: 'assistant', content: `错误：${error instanceof Error ? error.message : String(error)}`, timestamp: Date.now() }]);
    }
  };

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
    let reasoningContent = '';
    let answerContent = '';

    // 选中文本和上下文
    const textToUse = initSelectedText !== undefined ? initSelectedText : selectedText;
    const contextToUse = initContext !== undefined ? initContext : context;

    // 推荐问题生成（在 AI 回答完成后调用）
    const generateQuestionsIfNeeded = async () => {
      if (autoGenerateEnabled && textToUse) {
        return generateFollowUpQuestions(textToUse, contextToUse, modelToUse);
      }
      return [];
    };

    try {
      // 创建端口进行流式通信
      const port = chrome.runtime.connect({ name: 'llm-stream' });
      currentPortRef.current = port;

      port.onMessage.addListener((message) => {
        if (message.type === 'LLM_STREAM_CHUNK') {
          const chunk = message.chunk || '';

          // 处理思考过程标签
          if (chunk === '[REASONING]') {
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
          // AI 回答完成，立即设置耗时（让操作按钮立即显示）
          const answerStartTime = startTime;
          setMessages(prev => {
            const aiMsgIndex = prev.findIndex(
              m => m.role === 'assistant' && m.startTime && m.duration === undefined
            );
            if (aiMsgIndex !== -1) {
              const aiMsg = prev[aiMsgIndex];
              const newPrev = [...prev];
              newPrev[aiMsgIndex] = {
                ...aiMsg,
                duration: Date.now() - answerStartTime,
              };
              return newPrev;
            }
            return prev;
          });

          // 立即恢复加载状态（不等待推荐问题生成）
          setIsLoading(false);
          currentPortRef.current = null;

          // 生成推荐问题（后台异步，不阻塞按钮状态恢复）
          (async () => {
            // 捕获当前会话 ID 和消息数量，如果会话已重置或用户已发送新消息，则不添加推荐问题
            const snapshotSessionId = currentSessionId;
            const snapshotMsgCount = messagesCountRef.current;
            if (autoGenerateEnabled && textToUse && !hasGeneratedQuestions) {
              try {
                const questions = await generateQuestionsIfNeeded();
                // 再次检查：会话是否已重置，且用户是否未发送新消息
                if (snapshotSessionId === currentSessionId && snapshotMsgCount === messagesCountRef.current && questions.length > 0) {
                  setMessages(prev => [
                    ...prev,
                    {
                      role: 'assistant',
                      content: '',
                      timestamp: Date.now(),
                      questions: questions,
                    },
                  ]);
                  // 标记已生成过推荐问题
                  setHasGeneratedQuestions(true);
                }
              } catch (error) {
                console.error('Failed to generate questions:', error);
              }
            }

            port.disconnect();

            // 保存到历史记录
            saveToHistory(modelToUse, textToUse, contextToUse);
          })();
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
      const textToUseForRequest = initSelectedText !== undefined ? initSelectedText : selectedText;
      const contextToUseForRequest = initContext !== undefined ? initContext : context;

      // 发送请求 — 有选中文本时使用 action+text 格式，否则使用 messages 格式
      if (textToUseForRequest) {
        port.postMessage({
          type: 'LLM_STREAM_START',
          payload: {
            action: actionType,
            text: textToUseForRequest,
            question: actionType === 'question' ? question : undefined,
            context: contextToUseForRequest || undefined,
            modelId: modelToUse.id,
          },
        });
      } else {
        port.postMessage({
          type: 'LLM_STREAM_START',
          payload: {
            messages: [{ role: 'user', content: question }],
            modelId: modelToUse.id,
          },
        });
      }

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

  // 点击追问气泡 - 立即触发问题追问
  const handleFollowUpClick = async (question: string) => {
    // 清空推荐问题
    setRecommendedQuestions([]);
    // 添加用户消息
    const userMsg: ExtendedHistoryMessage = {
      role: 'user',
      content: question,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMsg]);

    // 调用 AI 回答（追问不需要选中文本和上下文）
    await getAIResponse(question, currentModel);
  };

  // 点击推荐问题消息中的快速追问按钮
  const handleQuestionClick = async (question: string) => {
    // 添加用户消息
    const userMsg: ExtendedHistoryMessage = {
      role: 'user',
      content: question,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMsg]);

    // 调用 AI 回答
    await getAIResponse(question, currentModel);
  };

  // 发送指定问题（用于快捷按钮）
  const handleSendWithQuestion = async (question: string) => {
    if (isLoading) return;

    const userMsg: ExtendedHistoryMessage = {
      role: 'user',
      content: question,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMsg]);

    if (!currentModel) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '请先在配置中添加并启用模型',
        timestamp: Date.now(),
      }]);
      return;
    }

    await getAIResponse(question, currentModel, selectedText, context);
  };

  // 发送页面总结请求（使用 messages 数组格式，不需要选中文本）
  const handleSendSummary = async () => {
    if (isLoading) return;

    if (!currentModel) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '请先在配置中添加并启用模型',
        timestamp: Date.now(),
      }]);
      return;
    }

    const userMsg: ExtendedHistoryMessage = {
      role: 'user',
      content: '总结页面',
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMsg]);

    const summaryMsg = `请总结当前页面内容：${pageInfo.pageTitle || '当前网页'}`;
    await getAIResponseWithMessages(summaryMsg, currentModel);
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
        {/* 空状态 — 无对话时显示 */}
        {messages.length === 0 && (
          <div className="side-panel-empty-state">
            <div className="side-panel-empty-icon">
              <svg viewBox="0 0 64 64" width="64" height="64" fill="none">
                {/* 对话气泡 */}
                <circle cx="32" cy="32" r="28" fill="url(#emptyGrad)" opacity="0.12"/>
                <path d="M22 20c0-5.523 4.477-10 10-10s10 4.477 10 10v8c0 5.523-4.477 10-10 10l-6 6v-6H22c-5.523 0-10-4.477-10-10V20z" stroke="url(#emptyGrad)" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                {/* 内部 AI 标识 */}
                <text x="32" y="38" textAnchor="middle" fill="url(#emptyGrad)" fontSize="16" fontWeight="700" fontFamily="system-ui">AI</text>
                <defs>
                  <linearGradient id="emptyGrad" x1="0" y1="0" x2="64" y2="64">
                    <stop offset="0%" stopColor="#6366f1"/>
                    <stop offset="100%" stopColor="#8b5cf6"/>
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
                    <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                  </svg>
                </span>
                <span>选中文字，点击弹出菜单提问</span>
              </div>
              <div className="side-panel-empty-tip">
                <span className="side-panel-empty-tip-icon">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 8l6 6"/><path d="M4 14l6-6 2-3"/><path d="M2 5h12"/><path d="M22 22l-5-10-5 10"/><path d="M14 18h6"/>
                  </svg>
                </span>
                <span>点击右侧悬浮图标翻译全文或总结页面</span>
              </div>
              <div className="side-panel-empty-tip">
                <span className="side-panel-empty-tip-icon">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>
                  </svg>
                </span>
                <span>在下方输入框直接提问</span>
              </div>
            </div>
          </div>
        )}

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
                    <>
                      {/* 非第一条消息或没有选中文本时，正常显示消息内容 */}
                      {escapeHtml(msg.content)}
                      {/* 第一条消息有页面 URL 时显示 */}
                      {index === 0 && pageInfo?.pageUrl && (() => {
                        const { displayText, faviconUrl } = formatUrlForDisplay(pageInfo.pageUrl);
                        return (
                          <a
                            href={pageInfo.pageUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="side-panel-page-url"
                            title={pageInfo.pageUrl}
                          >
                            {faviconUrl && (
                              <img
                                src={faviconUrl}
                                alt=""
                                className="side-panel-page-url-favicon"
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
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                  />

                  {/* 推荐问题 - 在有 questions 字段时显示 */}
                  {msg.questions && msg.questions.length > 0 && (
                    <div className="side-panel-recommended-questions">
                      <div className="side-panel-recommended-list">
                        {msg.questions.map((q, idx) => (
                          <div key={idx} className="side-panel-recommended-item">
                            <span className="side-panel-recommended-text">{q}</span>
                            <button
                              className="side-panel-recommended-arrow"
                              onClick={() => handleQuestionClick(q)}
                              title="快速追问"
                            >
                              →
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
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
                    {/* 重新生成按钮 - 每一条 AI 回答消息都显示 */}
                    <button
                      className="side-panel-action-btn"
                      onClick={() => handleRegenerate(index)}
                      title="重新生成"
                    >
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M23 4v6h-6M1 20v-6h6"/>
                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                      </svg>
                    </button>
                  </div>
                )}

                {/* 追问气泡 - 在最后一条 AI 消息且回答完成后显示 */}
                {index === messages.length - 1 && (msg.duration || msg.isStopped) && (
                  <div className="side-panel-followup-section">
                    {/* 生成中状态 */}
                    {isGeneratingQuestions && (
                      <div className="side-panel-followup-loading">
                        <svg className="side-panel-spin-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10"/>
                          <path d="M12 6v6l4 2"/>
                        </svg>
                        <span>正在生成推荐问题...</span>
                      </div>
                    )}

                    {/* 追问气泡列表 */}
                    {!isGeneratingQuestions && recommendedQuestions.length > 0 && (
                      <div className="side-panel-followup-questions">
                        <div className="side-panel-followup-header">
                          <span>💡</span>
                          <span>推荐追问</span>
                        </div>
                        <div className="side-panel-followup-list">
                          {recommendedQuestions.map((q, idx) => (
                            <button
                              key={idx}
                              onClick={() => handleFollowUpClick(q)}
                              className="side-panel-followup-bubble"
                            >
                              {q}
                            </button>
                          ))}
                        </div>
                      </div>
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
        {/* 操作按钮行：总结网页（左）+ 新建会话（右） */}
        <div className="side-panel-action-bar">
          {pageInfo?.pageUrl && (
            <button
              className="side-panel-summarize-btn"
              onClick={handleSendSummary}
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <path d="M14 2v6h6"/>
                <path d="M16 13H8"/>
                <path d="M16 17H8"/>
                <path d="M10 9H8"/>
              </svg>
              <span>总结网页</span>
            </button>
          )}

          {/* 新建会话按钮 — 仅图标 */}
          <button
            className="side-panel-new-chat-btn"
            onClick={() => {
              // 如果有正在进行的请求，先取消
              if (currentPortRef.current) {
                try { currentPortRef.current.disconnect(); } catch {}
                currentPortRef.current = null;
              }
              setIsLoading(false);
              setMessages([]);
              setSelectedText('');
              setContext(null);
              setRecommendedQuestions([]);
              setCurrentSessionId(generateSessionId());
              setExpandedReasoning({});
            }}
            title="新建会话"
          >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                <line x1="12" y1="8" x2="12" y2="14"/>
                <line x1="9" y1="11" x2="15" y2="11"/>
              </svg>
            </button>
        </div>

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

          {/* 发送按钮 */}
          <div className="side-panel-input-controls">
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
                  <path d="M12 4L4 14h5v6h6v-6h5L12 4z"/>
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
