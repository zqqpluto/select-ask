import { useState, useRef, useCallback, useEffect } from 'react';
import type { HistoryMessage, ModelConfig } from '../../types';
import { generateSessionId, generateTitle } from '../../utils/history-manager';

export interface ExtendedHistoryMessage extends HistoryMessage {
  modelName?: string;
  duration?: number;
  startTime?: number;
  reasoning?: string;
  isStopped?: boolean;
  questions?: string[];
}

export interface PageInfo {
  selectedText: string;
  pageUrl: string;
  pageTitle: string;
}

interface UseChatStreamReturn {
  messages: ExtendedHistoryMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ExtendedHistoryMessage[]>>;
  inputValue: string;
  setInputValue: React.Dispatch<React.SetStateAction<string>>;
  isLoading: boolean;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  selectedText: string;
  setSelectedText: React.Dispatch<React.SetStateAction<string>>;
  context: { before: string; after: string } | null;
  setContext: React.Dispatch<React.SetStateAction<{ before: string; after: string } | null>>;
  currentModel: ModelConfig | null;
  setCurrentModel: React.Dispatch<React.SetStateAction<ModelConfig | null>>;
  availableModels: ModelConfig[];
  setAvailableModels: React.Dispatch<React.SetStateAction<ModelConfig[]>>;
  pageInfo: PageInfo | null;
  setPageInfo: React.Dispatch<React.SetStateAction<PageInfo | null>>;
  selectedTextExpanded: boolean;
  setSelectedTextExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  selectedTextNeedsExpand: boolean;
  setSelectedTextNeedsExpand: React.Dispatch<React.SetStateAction<boolean>>;
  mindMapMarkdown: string | null;
  setMindMapMarkdown: React.Dispatch<React.SetStateAction<string | null>>;
  mindMapInline: string | null;
  setMindMapInline: React.Dispatch<React.SetStateAction<string | null>>;
  mindMapLoading: boolean;
  setMindMapLoading: React.Dispatch<React.SetStateAction<boolean>>;
  expandedReasoning: Record<number, boolean>;
  setExpandedReasoning: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  currentPortRef: React.MutableRefObject<chrome.runtime.Port | null>;
  messagesCountRef: React.MutableRefObject<number>;
  userHasScrolled: boolean;
  setUserHasScrolled: React.Dispatch<React.SetStateAction<boolean>>;
  currentSessionId: string | null;
  setCurrentSessionId: React.Dispatch<React.SetStateAction<string | null>>;
  getAIResponse: (question: string, model?: ModelConfig, initSelectedText?: string, initContext?: { before: string; after: string } | null) => Promise<void>;
  getAIResponseWithMessages: (prompt: string, model?: ModelConfig) => Promise<void>;
  handleSend: () => Promise<void>;
  handleStopGeneration: () => void;
  handleRegenerate: (messageIndex?: number) => Promise<void>;
  handleReEdit: (content: string) => void;
  handleSendWithQuestion: (question: string) => Promise<void>;
  handleSendSummary: () => Promise<void>;
  handleSendMindMap: () => Promise<void>;
  handleConvertToMindMap: (content: string) => Promise<void>;
  handleTextareaChange: () => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  toggleReasoning: (index: number) => void;
  handleNewChat: () => void;
  autoGenerateEnabled: boolean;
  setAutoGenerateEnabled: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useChatStream(): UseChatStreamReturn {
  const [messages, setMessages] = useState<ExtendedHistoryMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedText, setSelectedText] = useState<string>('');
  const [context, setContext] = useState<{ before: string; after: string } | null>(null);
  const [currentModel, setCurrentModel] = useState<ModelConfig | null>(null);
  const [availableModels, setAvailableModels] = useState<ModelConfig[]>([]);
  const [pageInfo, setPageInfo] = useState<PageInfo | null>(null);
  const [selectedTextExpanded, setSelectedTextExpanded] = useState(false);
  const [selectedTextNeedsExpand, setSelectedTextNeedsExpand] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [mindMapMarkdown, setMindMapMarkdown] = useState<string | null>(null);
  const [mindMapInline, setMindMapInline] = useState<string | null>(null);
  const [mindMapLoading, setMindMapLoading] = useState(false);
  const [expandedReasoning, setExpandedReasoning] = useState<Record<number, boolean>>({});
  const [userHasScrolled, setUserHasScrolled] = useState(false);
  const [hasGeneratedQuestions, setHasGeneratedQuestions] = useState(false);
  const [autoGenerateEnabled, setAutoGenerateEnabled] = useState(true);

  const currentPortRef = useRef<chrome.runtime.Port | null>(null);
  const messagesCountRef = useRef(0);

  // Keep messagesCountRef in sync
  useEffect(() => {
    messagesCountRef.current = messages.length;
  }, [messages]);

  const toggleReasoning = useCallback((index: number) => {
    setExpandedReasoning(prev => ({ ...prev, [index]: !prev[index] }));
  }, []);

  const handleStopGeneration = useCallback(() => {
    if (currentPortRef.current) {
      currentPortRef.current.disconnect();
      currentPortRef.current = null;
    }
    setIsLoading(false);
    setMessages(prev => {
      const lastAiIndex = prev.map((m, i) => m.role === 'assistant' ? i : -1).filter(i => i !== -1).pop();
      if (lastAiIndex !== undefined && lastAiIndex >= 0) {
        return prev.map((msg, index) =>
          index === lastAiIndex ? { ...msg, isStopped: true, duration: msg.startTime ? Date.now() - msg.startTime : undefined } : msg
        );
      }
      return prev;
    });
  }, []);

  const handleReEdit = useCallback((content: string) => {
    setInputValue(content);
  }, []);

  const handleNewChat = useCallback(() => {
    if (currentPortRef.current) {
      try { currentPortRef.current.disconnect(); } catch {}
      currentPortRef.current = null;
    }
    setIsLoading(false);
    setMessages([]);
    setSelectedText('');
    setContext(null);
    setHasGeneratedQuestions(false);
    setCurrentSessionId(generateSessionId());
    setExpandedReasoning({});
    setMindMapMarkdown(null);
    setMindMapInline(null);
    setMindMapLoading(false);
  }, []);

  const handleTextareaChange = useCallback(() => {
    const textarea = document.querySelector('.side-panel-input-box textarea') as HTMLTextAreaElement | null;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }
  }, []);

  // Refs for sync access inside closures
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const currentSessionIdRef = useRef(currentSessionId);
  currentSessionIdRef.current = currentSessionId;
  const selectedTextStateRef = useRef(selectedText);
  selectedTextStateRef.current = selectedText;
  const contextStateRef = useRef(context);
  contextStateRef.current = context;
  const hasGeneratedQuestionsRef = useRef(hasGeneratedQuestions);
  hasGeneratedQuestionsRef.current = hasGeneratedQuestions;

  const saveToHistory = useCallback(async (modelToUse: ModelConfig, textForTitle: string, _contextForSession: { before: string; after: string } | null, currentPageInfo: PageInfo | null) => {
    let sessionId = currentSessionIdRef.current;
    if (!sessionId) {
      sessionId = generateSessionId();
      setCurrentSessionId(sessionId);
    }
    try {
      const sessions = await chrome.storage.local.get('select_ask_history');
      const history = (sessions as any).select_ask_history || { sessions: [] };
      const messagesToSave: HistoryMessage[] = messagesRef.current.map(msg => ({
        role: msg.role, content: msg.content, timestamp: msg.timestamp || Date.now(),
        ...(msg.reasoning ? { reasoning: msg.reasoning } : {}),
        ...(msg.modelName ? { modelName: msg.modelName } : {}),
        ...(msg.duration ? { duration: msg.duration } : {}),
      }));
      const typeMap: Record<string, string> = { '解释': 'explain', '翻译': 'translate', '搜索': 'search', '总结页面': 'summarize' };
      const firstMsg = messagesRef.current[0];
      const sessionType = typeMap[firstMsg?.content] || 'question';
      const sessionTitle = textForTitle.length > 100 ? (firstMsg?.content || '对话') : generateTitle(textForTitle, sessionType);
      const session = {
        id: sessionId, title: sessionTitle, type: sessionType,
        selectedText: textForTitle.length > 100 ? '' : textForTitle,
        messages: messagesToSave, modelId: modelToUse.id, modelName: modelToUse.name,
        createdAt: Date.now(), updatedAt: Date.now(),
        pageUrl: currentPageInfo?.pageUrl || undefined, pageTitle: currentPageInfo?.pageTitle || undefined,
      };
      const existingIndex = history.sessions.findIndex((s: any) => s.id === sessionId);
      if (existingIndex >= 0) history.sessions[existingIndex] = { ...session, updatedAt: Date.now() };
      else history.sessions.unshift(session);
      if (history.sessions.length > 100) history.sessions = history.sessions.slice(0, 100);
      await chrome.storage.local.set({ select_ask_history: { sessions: history.sessions, maxSessions: 100 } });
    } catch (error) {
      console.error('[saveToHistory] 保存失败:', error);
    }
  }, []);

  const generateFollowUpQuestions = useCallback(async (selText: string, ctx: { before: string; after: string } | null, model: ModelConfig): Promise<string[]> => {
    return new Promise((resolve) => {
      const port = chrome.runtime.connect({ name: 'llm-stream' });
      let fullContent = '';
      port.onMessage.addListener((message) => {
        if (message.type === 'LLM_STREAM_CHUNK') fullContent += message.chunk || '';
        else if (message.type === 'LLM_STREAM_END') {
          const cleaned = fullContent.replace(/\[REASONING\]/g, '').replace(/\[REASONING_DONE\]/g, '').replace(/\[ANSWER\]/g, '').replace(/\[ANSWER_DONE\]/g, '');
          const questions = cleaned.split('\n').map(q => q.trim()).filter(q => q.length > 0 && q.length < 200)
            .map(q => { let c = q.replace(/^[\d\-\•\*]+\s*[.)]?\s*/, ''); while (c && !c[0].match(/[\u4e00-\u9fa5a-zA-Z?]/)) c = c.slice(1); return c.trim(); })
            .filter(q => {
              if (!q.length) return false;
              if (['首先', '接下来', '然后', '最后', '用户可能', '用户需要', '我得', '所以', '因为', '这是一个', '分析', '推理', '嗯，', '嗯,', '想想', '第一个问题', '第二个问题', '第三个问题'].some(k => q.includes(k))) return false;
              return q.includes('?') || q.includes('？') || q.includes('什么') || q.includes('如何') || q.includes('怎么') || q.includes('为什么') || q.includes('是否') || q.includes('哪些') || q.includes('哪里') || q.includes('吗');
            }).slice(0, 3);
          port.disconnect(); resolve(questions);
        } else if (message.type === 'LLM_STREAM_ERROR') { port.disconnect(); resolve([]); }
      });
      port.onDisconnect.addListener(() => resolve([]));
      port.postMessage({ type: 'LLM_STREAM_START', payload: { action: 'generateQuestions', text: selText, context: ctx || undefined, modelId: model.id } });
    });
  }, []);

  const getAIResponseWithMessages = useCallback(async (prompt: string, model?: ModelConfig) => {
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
          if (chunk === '[REASONING]' || chunk === '[REASONING_DONE]') return;
          if (chunk.startsWith('[REASONING]')) {
            reasoningContent += chunk.slice(11);
            setMessages(prev => {
              const last = prev[prev.length - 1];
              if (last?.role === 'assistant') return [...prev.slice(0, -1), { ...last, content: answerContent, reasoning: reasoningContent, modelName: modelToUse.name, startTime }];
              return [...prev, { role: 'assistant', content: answerContent, reasoning: reasoningContent, timestamp: Date.now(), modelName: modelToUse.name, startTime }];
            });
            return;
          }
          if (chunk === '[ANSWER]' || chunk === '[ANSWER_DONE]') return;
          answerContent += chunk;
          setMessages(prev => {
            const last = prev[prev.length - 1];
            if (last?.role === 'assistant') return [...prev.slice(0, -1), { ...last, content: answerContent, reasoning: reasoningContent || undefined, modelName: modelToUse.name, startTime }];
            return [...prev, { role: 'assistant', content: answerContent, reasoning: reasoningContent || undefined, timestamp: Date.now(), modelName: modelToUse.name, startTime }];
          });
        } else if (message.type === 'LLM_STREAM_END') {
          const start = startTime;
          setMessages(prev => {
            const idx = prev.findIndex(m => m.role === 'assistant' && m.startTime && m.duration === undefined);
            if (idx !== -1) { const n = [...prev]; n[idx] = { ...n[idx], duration: Date.now() - start }; return n; }
            return prev;
          });
          setIsLoading(false); currentPortRef.current = null; port.disconnect();
          saveToHistory(modelToUse, prompt, null, pageInfo);
        } else if (message.type === 'LLM_STREAM_ERROR') {
          setIsLoading(false); currentPortRef.current = null;
          setMessages(prev => [...prev, { role: 'assistant', content: `错误：${message.error}`, timestamp: Date.now(), modelName: modelToUse.name }]);
          port.disconnect();
        }
      });
      port.onDisconnect.addListener(() => { setIsLoading(false); currentPortRef.current = null; });
      port.postMessage({ type: 'LLM_STREAM_START', payload: { messages: [{ role: 'user', content: prompt }], modelId: modelToUse.id } });
    } catch (error) {
      setIsLoading(false);
      setMessages(prev => [...prev, { role: 'assistant', content: `错误：${error instanceof Error ? error.message : String(error)}`, timestamp: Date.now() }]);
    }
  }, [currentModel, pageInfo, saveToHistory]);

  const getAIResponse = useCallback(async (question: string, model?: ModelConfig, initSelectedText?: string, initContext?: { before: string; after: string } | null) => {
    const modelToUse = model || currentModel;
    if (!modelToUse) {
      setMessages(prev => [...prev, { role: 'assistant', content: '请先在配置页面添加并启用模型', timestamp: Date.now() }]);
      return;
    }
    setIsLoading(true);
    const startTime = Date.now();
    let reasoningContent = '';
    let answerContent = '';
    const textToUse = initSelectedText !== undefined ? initSelectedText : selectedTextStateRef.current;
    const contextToUse = initContext !== undefined ? initContext : contextStateRef.current;
    const genQuestionsIfNeeded = async () => autoGenerateEnabled && textToUse ? generateFollowUpQuestions(textToUse, contextToUse, modelToUse) : [];
    try {
      const port = chrome.runtime.connect({ name: 'llm-stream' });
      currentPortRef.current = port;
      port.onMessage.addListener((message) => {
        if (message.type === 'LLM_STREAM_CHUNK') {
          const chunk = message.chunk || '';
          if (chunk === '[REASONING]' || chunk === '[REASONING_DONE]') return;
          if (chunk.startsWith('[REASONING]')) {
            reasoningContent += chunk.slice(11);
            setMessages(prev => {
              const last = prev[prev.length - 1];
              if (last?.role === 'assistant') return [...prev.slice(0, -1), { ...last, content: answerContent, reasoning: reasoningContent, modelName: modelToUse.name, startTime }];
              return [...prev, { role: 'assistant', content: answerContent, reasoning: reasoningContent, timestamp: Date.now(), modelName: modelToUse.name, startTime }];
            });
            return;
          }
          answerContent += chunk;
          setMessages(prev => {
            const last = prev[prev.length - 1];
            if (last?.role === 'assistant') return [...prev.slice(0, -1), { ...last, content: answerContent, reasoning: reasoningContent || undefined, modelName: modelToUse.name, startTime }];
            return [...prev, { role: 'assistant', content: answerContent, reasoning: reasoningContent || undefined, timestamp: Date.now(), modelName: modelToUse.name, startTime }];
          });
        } else if (message.type === 'LLM_STREAM_END') {
          const start = startTime;
          setMessages(prev => {
            const idx = prev.findIndex(m => m.role === 'assistant' && m.startTime && m.duration === undefined);
            if (idx !== -1) { const n = [...prev]; n[idx] = { ...n[idx], duration: Date.now() - start }; return n; }
            return prev;
          });
          setIsLoading(false); currentPortRef.current = null;
          (async () => {
            const snapSession = currentSessionIdRef.current;
            const snapMsgs = messagesCountRef.current;
            if (autoGenerateEnabled && textToUse && !hasGeneratedQuestionsRef.current) {
              try {
                const questions = await genQuestionsIfNeeded();
                if (snapSession === currentSessionIdRef.current && snapMsgs === messagesCountRef.current && questions.length > 0) {
                  setMessages(prev => [...prev, { role: 'assistant', content: '', timestamp: Date.now(), questions }]);
                  setHasGeneratedQuestions(true);
                }
              } catch (e) { console.error('Failed to generate questions:', e); }
            }
            port.disconnect();
            saveToHistory(modelToUse, textToUse, contextToUse, pageInfo);
          })();
        } else if (message.type === 'LLM_STREAM_ERROR') {
          setIsLoading(false); currentPortRef.current = null;
          setMessages(prev => [...prev, { role: 'assistant', content: `错误：${message.error}`, timestamp: Date.now(), modelName: modelToUse.name }]);
          port.disconnect();
        }
      });
      port.onDisconnect.addListener(() => { setIsLoading(false); currentPortRef.current = null; });
      let actionType: 'explain' | 'translate' | 'question' | 'search' = 'question';
      if (question === '解释' || question === 'explain') actionType = 'explain';
      else if (question === '翻译' || question === 'translate') actionType = 'translate';
      else if (question === '搜索' || question === 'search') actionType = 'search';
      const reqText = initSelectedText !== undefined ? initSelectedText : selectedTextStateRef.current;
      const reqCtx = initContext !== undefined ? initContext : contextStateRef.current;
      if (reqText) {
        port.postMessage({ type: 'LLM_STREAM_START', payload: { action: actionType, text: reqText, question: actionType === 'question' ? question : undefined, context: reqCtx || undefined, modelId: modelToUse.id } });
      } else {
        port.postMessage({ type: 'LLM_STREAM_START', payload: { messages: [{ role: 'user', content: question }], modelId: modelToUse.id } });
      }
    } catch (error) {
      setIsLoading(false);
      setMessages(prev => [...prev, { role: 'assistant', content: `错误：${error instanceof Error ? error.message : String(error)}`, timestamp: Date.now() }]);
    }
  }, [currentModel, autoGenerateEnabled, generateFollowUpQuestions, saveToHistory, pageInfo]);

  const handleRegenerate = useCallback(async (messageIndex?: number) => {
    const targetIndex = messageIndex ?? messages.map((m, i) => m.role === 'assistant' ? i : -1).filter(i => i !== -1).pop();
    if (targetIndex === undefined || targetIndex < 0) return;
    const userMsgIndex = targetIndex > 0 ? targetIndex - 1 : null;
    if (userMsgIndex === null || messages[userMsgIndex]?.role !== 'user') return;
    const userMessage = messages[userMsgIndex].content;
    setMessages(prev => {
      const next = prev[targetIndex + 1];
      if (next?.questions) return prev.slice(0, targetIndex);
      return prev.slice(0, targetIndex);
    });
    await getAIResponse(userMessage, currentModel || undefined);
  }, [messages, currentModel, getAIResponse]);

  const handleSendWithQuestion = useCallback(async (question: string) => {
    if (isLoading) return;
    setMessages(prev => [...prev, { role: 'user', content: question, timestamp: Date.now() }]);
    if (!currentModel) {
      setMessages(prev => [...prev, { role: 'assistant', content: '请先在配置中添加并启用模型', timestamp: Date.now() }]);
      return;
    }
    await getAIResponse(question, currentModel, selectedTextStateRef.current, contextStateRef.current);
  }, [isLoading, currentModel, getAIResponse]);

  const handleSendSummary = useCallback(async () => {
    if (isLoading) return;
    if (!currentModel) {
      setMessages(prev => [...prev, { role: 'assistant', content: '请先在配置中添加并启用模型', timestamp: Date.now() }]);
      return;
    }
    setMessages(prev => [...prev, { role: 'user', content: '总结页面', timestamp: Date.now() }]);
    await getAIResponseWithMessages(`请总结当前页面内容：${pageInfo?.pageTitle || '当前网页'}`, currentModel || undefined);
  }, [isLoading, currentModel, pageInfo, getAIResponseWithMessages]);

  async function getPageMindMapPrompt(): Promise<string | null> {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return null;
      const response = await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_PAGE_FOR_MINDMAP' });
      if (!response?.content) return null;
      return `请将以下内容整理为层级化 Markdown 脑图格式。要求：
1. 使用 ## 作为一级标题，### 作为二级标题，#### 作为三级标题
2. 使用 - 列表项表示子节点
3. 结构清晰，层次分明
4. 提取核心要点，不要遗漏重要信息

内容：
${response.content}`;
    } catch (error) { console.error('[脑图] 获取页面内容失败:', error); return null; }
  }

  const handleSendMindMap = useCallback(async () => {
    if (isLoading) return;
    if (!currentModel) {
      setMessages(prev => [...prev, { role: 'assistant', content: '请先在配置中添加并启用模型', timestamp: Date.now() }]);
      return;
    }
    setMessages(prev => [...prev, { role: 'user', content: '生成脑图', timestamp: Date.now() }]);
    const mindMapPrompt = await getPageMindMapPrompt();
    if (!mindMapPrompt) {
      setMessages(prev => [...prev, { role: 'assistant', content: '无法获取页面内容，请稍后重试', timestamp: Date.now() }]);
      return;
    }
    setMindMapLoading(true); setMindMapInline(null); setIsLoading(true);
    const startTime = Date.now();
    let reasoningContent = ''; let answerContent = '';
    setMessages(prev => [...prev, { role: 'assistant', content: '', timestamp: Date.now(), modelName: currentModel.name, startTime }]);
    const port = chrome.runtime.connect({ name: 'llm-stream' });
    currentPortRef.current = port;
    port.onMessage.addListener((message) => {
      if (message.type === 'LLM_STREAM_CHUNK') {
        const chunk = message.chunk || '';
        if (message.reasoning) reasoningContent += chunk; else answerContent += chunk;
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant') return [...prev.slice(0, -1), { ...last, content: '', reasoning: reasoningContent || undefined, startTime }];
          return [...prev, { role: 'assistant', content: '', reasoning: reasoningContent || undefined, timestamp: Date.now(), modelName: currentModel.name, startTime }];
        });
      } else if (message.type === 'LLM_STREAM_END') {
        const match = answerContent.match(/```markdown\s*([\s\S]*?)```|```\s*([\s\S]*?)```/);
        const content = match ? (match[1] || match[2]) : answerContent;
        setMindMapInline(content.trim()); setMindMapLoading(false); setIsLoading(false); currentPortRef.current = null;
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant') return [...prev.slice(0, -1), { ...last, duration: Date.now() - startTime }];
          return prev;
        });
        port.disconnect();
      } else if (message.type === 'LLM_STREAM_ERROR') {
        setMindMapLoading(false); setIsLoading(false); currentPortRef.current = null;
        setMessages(prev => [...prev, { role: 'assistant', content: `错误：${message.error}`, timestamp: Date.now(), modelName: currentModel.name }]);
        port.disconnect();
      }
    });
    port.onDisconnect.addListener(() => { setMindMapLoading(false); setIsLoading(false); currentPortRef.current = null; });
    port.postMessage({ type: 'LLM_STREAM_START', prompt: mindMapPrompt, modelId: currentModel.id, selectedText: '', context: null, sessionId: currentSessionIdRef.current || undefined });
  }, [isLoading, currentModel]);

  const handleConvertToMindMap = useCallback(async (content: string) => {
    if (isLoading) return;
    if (!currentModel) {
      setMessages(prev => [...prev, { role: 'assistant', content: '请先在配置中添加并启用模型', timestamp: Date.now() }]);
      return;
    }
    const mindMapPrompt = `请将以下内容整理为层级化 Markdown 脑图格式。要求：
1. 使用 ## 作为一级标题，### 作为二级标题，#### 作为三级标题
2. 使用 - 列表项表示子节点
3. 结构清晰，层次分明
4. 提取核心要点，不要遗漏重要信息
5. 直接输出脑图 Markdown，不要添加任何解释性文字

内容：
${content}`;
    setMessages(prev => [...prev, { role: 'user', content: '将以上内容整理为脑图', timestamp: Date.now() }]);
    setMindMapLoading(true); setMindMapInline(null); setIsLoading(true);
    const startTime = Date.now();
    let reasoningContent = ''; let answerContent = '';
    setMessages(prev => [...prev, { role: 'assistant', content: '', timestamp: Date.now(), modelName: currentModel.name, startTime }]);
    const port = chrome.runtime.connect({ name: 'llm-stream' });
    currentPortRef.current = port;
    port.onMessage.addListener((message) => {
      if (message.type === 'LLM_STREAM_CHUNK') {
        const chunk = message.chunk || '';
        if (message.reasoning) reasoningContent += chunk; else answerContent += chunk;
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant') return [...prev.slice(0, -1), { ...last, content: '', reasoning: reasoningContent || undefined, startTime }];
          return [...prev, { role: 'assistant', content: '', reasoning: reasoningContent || undefined, timestamp: Date.now(), modelName: currentModel.name, startTime }];
        });
      } else if (message.type === 'LLM_STREAM_END') {
        const match = answerContent.match(/```markdown\s*([\s\S]*?)```|```\s*([\s\S]*?)```/);
        const content = match ? (match[1] || match[2]) : answerContent;
        setMindMapInline(content.trim()); setMindMapLoading(false); setIsLoading(false); currentPortRef.current = null;
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant') return [...prev.slice(0, -1), { ...last, duration: Date.now() - startTime }];
          return prev;
        });
        port.disconnect();
      } else if (message.type === 'LLM_STREAM_ERROR') {
        setMindMapLoading(false); setIsLoading(false); currentPortRef.current = null;
        setMessages(prev => [...prev, { role: 'assistant', content: `错误：${message.error}`, timestamp: Date.now(), modelName: currentModel.name }]);
        port.disconnect();
      }
    });
    port.onDisconnect.addListener(() => { setMindMapLoading(false); setIsLoading(false); currentPortRef.current = null; });
    port.postMessage({ type: 'LLM_STREAM_START', prompt: mindMapPrompt, modelId: currentModel.id, selectedText: '', context: null, sessionId: currentSessionIdRef.current || undefined });
  }, [isLoading, currentModel]);

  const handleSend = useCallback(async () => {
    const message = inputValue.trim();
    if (!message || isLoading) return;
    setMessages(prev => [...prev, { role: 'user', content: message, timestamp: Date.now() }]);
    setInputValue('');
    setMessages(prev => [...prev, { role: 'assistant', content: '', timestamp: Date.now(), modelName: currentModel?.name, startTime: Date.now() }]);
    await getAIResponse(message, currentModel || undefined);
  }, [inputValue, isLoading, currentModel, getAIResponse]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (inputValue.trim() && !isLoading) handleSend();
    }
  }, [inputValue, isLoading, handleSend]);

  return {
    messages, setMessages, inputValue, setInputValue, isLoading, setIsLoading,
    selectedText, setSelectedText, context, setContext,
    currentModel, setCurrentModel, availableModels, setAvailableModels,
    pageInfo, setPageInfo,
    selectedTextExpanded, setSelectedTextExpanded, selectedTextNeedsExpand, setSelectedTextNeedsExpand,
    currentSessionId, setCurrentSessionId,
    mindMapMarkdown, setMindMapMarkdown, mindMapInline, setMindMapInline, mindMapLoading, setMindMapLoading,
    expandedReasoning, setExpandedReasoning,
    currentPortRef, messagesCountRef, userHasScrolled, setUserHasScrolled,
    getAIResponse, getAIResponseWithMessages,
    handleSend, handleStopGeneration, handleRegenerate, handleReEdit,
    handleSendWithQuestion, handleSendSummary, handleSendMindMap, handleConvertToMindMap,
    handleTextareaChange, handleKeyDown,
    toggleReasoning, handleNewChat,
    autoGenerateEnabled, setAutoGenerateEnabled,
  };
}
