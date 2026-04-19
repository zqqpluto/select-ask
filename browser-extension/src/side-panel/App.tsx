import { useEffect, useRef } from 'react';
import type { ModelConfig } from '../types';
import { generateSessionId } from '../utils/history-manager';
import { useChatStream, type ExtendedHistoryMessage } from './hooks/useChatStream';
import ChatMessageList from './components/ChatMessageList';
import ChatInput from './components/ChatInput';
import MindMapIntegration from './components/MindMapIntegration';
import '../components/MindMap/mind-map.css';

export default function App() {
  const {
    messages, setMessages, inputValue, setInputValue, isLoading,
    selectedText: _selectedText, setSelectedText, context: _context, setContext,
    currentModel, setCurrentModel, availableModels, setAvailableModels,
    pageInfo, setPageInfo,
    selectedTextExpanded, setSelectedTextExpanded,
    selectedTextNeedsExpand, setSelectedTextNeedsExpand,
    mindMapMarkdown, setMindMapMarkdown,
    mindMapInline, mindMapLoading,
    expandedReasoning, toggleReasoning,
    currentPortRef: _currentPortRef, messagesCountRef,
    userHasScrolled, setUserHasScrolled,
    currentSessionId: _currentSessionId, setCurrentSessionId,
    getAIResponse, getAIResponseWithMessages,
    handleSend, handleStopGeneration, handleRegenerate,
    handleReEdit, handleConvertToMindMap,
    handleTextareaChange, handleKeyDown: _handleKeyDown,
    handleNewChat, handleSendMindMap,
    autoGenerateEnabled: _autoGenerateEnabled, setAutoGenerateEnabled,
  } = useChatStream();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const selectedTextRef = useRef<HTMLQuoteElement>(null);

  // Keep messagesCountRef in sync
  useEffect(() => {
    messagesCountRef.current = messages.length;
  }, [messages, messagesCountRef]);

  // Scroll to bottom
  useEffect(() => {
    if (!userHasScrolled) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, userHasScrolled]);

  // Scroll listener
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const handleScroll = () => {
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
      setUserHasScrolled(!isNearBottom);
    };
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [setUserHasScrolled]);

  // Detect if selected text needs expand
  useEffect(() => {
    if (selectedTextRef.current && pageInfo?.selectedText) {
      const el = selectedTextRef.current;
      const needsExpand = el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth;
      setSelectedTextNeedsExpand(needsExpand);
    }
  }, [pageInfo?.selectedText, messages.length, setSelectedTextNeedsExpand]);

  // Load models
  useEffect(() => {
    const loadModels = async () => {
      try {
        const result = await chrome.storage.sync.get(['app_config']);
        const config = result.app_config;
        if (config && config.models) {
          const enabledModels = config.models.filter((m: ModelConfig) => m.enabled && (m.enableChat !== false));
          const selectedIds = config.selectedChatModelIds || [];
          let modelsToUse: ModelConfig[] = [];
          if (selectedIds.length > 0) {
            modelsToUse = selectedIds.map((id: string) => enabledModels.find((m: { id: string; enabled: boolean }) => m.id === id)).filter((m: ModelConfig | undefined): m is ModelConfig => m !== undefined && m.enabled);
          } else {
            modelsToUse = enabledModels;
          }
          setAvailableModels(modelsToUse);
          if (modelsToUse.length > 0) setCurrentModel(modelsToUse[0]);
          else console.warn('No models available!');
        }
        if (config && config.preferences) {
          setAutoGenerateEnabled(config.preferences.autoGenerateQuestions !== false);
        }
      } catch (error) {
        console.error('Failed to load models:', error);
      }
    };
    loadModels();
  }, [setAvailableModels, setCurrentModel]);

  // Listen for messages from content script
  useEffect(() => {
    const port = chrome.runtime.connect({ name: 'sidepanel' });
    port.onDisconnect.addListener(() => {
      chrome.storage.local.remove('pending_sidebar_init').catch(() => {});
    });

    const messageListener = (message: any, _sender: chrome.runtime.MessageSender, sendResponse: (response: any) => void) => {
      if (message.type === 'SIDEBAR_INIT') {
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

  // Listen for storage changes (new page summary requests)
  useEffect(() => {
    const storageListener = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
      if (areaName === 'local' && changes.pending_sidebar_init?.newValue) {
        const { selectedText, context, userMessage, summaryPrompt, pageUrl, pageTitle } = changes.pending_sidebar_init.newValue;
        setSelectedText(selectedText || '');
        setContext(context || null);
        setPageInfo({ selectedText: selectedText || '', pageUrl: pageUrl || '', pageTitle: pageTitle || '' });
        if (userMessage && currentModel) {
          const userMsg: ExtendedHistoryMessage = { role: 'user', content: userMessage, timestamp: Date.now() };
          if (summaryPrompt) {
            setMessages([userMsg]);
            getAIResponseWithMessages(summaryPrompt, currentModel);
          } else {
            setMessages(prev => [...prev, userMsg]);
            getAIResponse(userMessage, currentModel, selectedText || '', context || null);
          }
          setTimeout(() => { chrome.storage.local.remove('pending_sidebar_init').catch(() => {}); }, 500);
        }
      }
    };
    chrome.storage.onChanged.addListener(storageListener);
    return () => { chrome.storage.onChanged.removeListener(storageListener); };
  }, [currentModel, setSelectedText, setContext, setPageInfo, setMessages, getAIResponse, getAIResponseWithMessages]);

  // Handle pending init message when models are loaded
  useEffect(() => {
    if (currentModel && availableModels.length > 0) {
      const checkInitMessage = async () => {
        const result = await chrome.storage.local.get(['pending_sidebar_init']);
        if (result.pending_sidebar_init) {
          const { selectedText, context, userMessage, summaryPrompt, pageUrl, pageTitle } = result.pending_sidebar_init;
          setSelectedText(selectedText || '');
          setContext(context || null);
          setPageInfo({ selectedText: selectedText || '', pageUrl: pageUrl || '', pageTitle: pageTitle || '' });
          if (userMessage) {
            const userMsg: ExtendedHistoryMessage = { role: 'user', content: userMessage, timestamp: Date.now() };
            setMessages([userMsg]);
            const sessionId = generateSessionId();
            setCurrentSessionId(sessionId);
            await chrome.storage.local.remove(['pending_sidebar_init']);
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
  }, [currentModel?.id, availableModels.length, setSelectedText, setContext, setPageInfo, setMessages, setCurrentSessionId, getAIResponse, getAIResponseWithMessages]);

  // Re-edit with focus
  const handleReEditWithFocus = (content: string) => {
    handleReEdit(content);
    if (textareaRef.current) {
      textareaRef.current.focus();
      handleTextareaChange();
    }
  };

  return (
    <div className="side-panel-container">
      <div className="side-panel-content" ref={messagesContainerRef}>
        <ChatMessageList
          messages={messages}
          pageInfo={pageInfo}
          selectedTextExpanded={selectedTextExpanded}
          selectedTextNeedsExpand={selectedTextNeedsExpand}
          onToggleSelectedTextExpand={() => setSelectedTextExpanded(!selectedTextExpanded)}
          mindMapLoading={mindMapLoading}
          mindMapInline={mindMapInline}
          expandedReasoning={expandedReasoning}
          toggleReasoning={toggleReasoning}
          onReEdit={handleReEditWithFocus}
          onRegenerate={handleRegenerate}
          onConvertToMindMap={handleConvertToMindMap}
          onQuestionClick={async (q) => {
            setMessages(prev => [...prev, { role: 'user', content: q, timestamp: Date.now() }]);
            await getAIResponse(q, currentModel || undefined);
          }}
          onSetMindMapMarkdown={setMindMapMarkdown}
          selectedTextRef={selectedTextRef}
        />
        <div ref={messagesEndRef} />
      </div>

      <ChatInput
        inputValue={inputValue}
        isLoading={isLoading}
        pageInfo={pageInfo}
        textareaRef={textareaRef}
        onInputChange={setInputValue}
        onSend={handleSend}
        onStop={handleStopGeneration}
        onSummary={async () => {
          if (isLoading || !currentModel) return;
          setMessages(prev => [...prev, { role: 'user', content: '总结页面', timestamp: Date.now() }]);
          await getAIResponseWithMessages(`请总结当前页面内容：${pageInfo?.pageTitle || '当前网页'}`, currentModel);
        }}
        onMindMap={handleSendMindMap}
        onNewChat={handleNewChat}
      />

      <MindMapIntegration
        mindMapMarkdown={mindMapMarkdown}
        onClose={() => setMindMapMarkdown(null)}
      />
    </div>
  );
}
