import { useEffect, useState, useRef } from 'react';
import {
  getAppConfig,
  saveAppConfig,
  saveModelConfig,
  deleteModelConfig,
  setSelectedChatModels,
  setSelectedQuestionModel,
  testModelConnection,
  getModelConfig,
  setModelEnableChat,
  getSelectedChatModel,
  setSelectedChatModel,
} from '../utils/config-manager';
import { getHistory, deleteSession, clearHistory, addMessageToSession } from '../utils/history-manager';
import { MODEL_PRESETS, PROVIDER_NAMES, PROVIDER_DEFAULTS } from '../types/config';
import { LLM_STREAM_PORT_NAME } from '../types/messages';
import type { ModelConfig, ProviderType } from '../types';
import type { HistorySession, HistoryMessage } from '../types/history';
import { marked } from 'marked';

interface ModelFormData {
  id: string;
  name: string;
  provider: ProviderType;
  apiKey: string;
  baseUrl: string;
  modelId: string;
  enableChat: boolean;
}

const DEFAULT_FORM_DATA: ModelFormData = {
  id: '',
  name: '',
  provider: 'openai',
  apiKey: '',
  baseUrl: 'https://api.openai.com/v1',
  modelId: 'gpt-4o',
  enableChat: true,
};

// 格式化时间 - 包含年月日时分秒
function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

// 渲染 Markdown
function renderMarkdown(text: string): string {
  return marked.parse(text, { breaks: true }) as string;
}

// 生成推荐问题
async function generateRecommendedQuestions(
  selectedText: string,
  userQuestion: string,
  aiAnswer: string
): Promise<string[]> {
  try {
    const port = chrome.runtime.connect({ name: LLM_STREAM_PORT_NAME });

    return new Promise((resolve, reject) => {
      let fullContent = '';

      port.onMessage.addListener((message) => {
        if (message.type === 'LLM_STREAM_CHUNK') {
          fullContent += message.chunk || '';
        } else if (message.type === 'LLM_STREAM_ERROR') {
          reject(new Error(message.error));
          port.disconnect();
        } else if (message.type === 'LLM_STREAM_END') {
          port.disconnect();

          // 解析问题列表
          const questions = fullContent
            .split('\n')
            .map(q => q.trim())
            .filter(q => q && !q.match(/^[\d\-\•\*]+\.?\s*/)) // 移除序号
            .slice(0, 5);

          resolve(questions);
        }
      });

      port.onDisconnect.addListener(() => {
        if (!fullContent) {
          reject(new Error('Connection closed'));
        }
      });

      port.postMessage({
        type: 'LLM_STREAM_START',
        payload: {
          action: 'generateQuestions',
          text: selectedText,
          context: userQuestion,
          answer: aiAnswer,
        },
      });
    });
  } catch (error) {
    console.error('Failed to generate questions:', error);
    return [];
  }
}

// 复制到剪贴板
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export default function App() {
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [selectedChatModelIds, setSelectedChatModelIds] = useState<string[]>([]);
  const [selectedQuestionModelId, setSelectedQuestionModelId] = useState<string | null>(null);
  const [preferences, setPreferences] = useState({
    sendWithEnter: false,
    sidebarWidth: 420,
    autoGenerateQuestions: true,
  });
  const [showModal, setShowModal] = useState(false);
  const [editingModel, setEditingModel] = useState<ModelConfig | null>(null);
  const [formData, setFormData] = useState<ModelFormData>(DEFAULT_FORM_DATA);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'models' | 'history' | 'about'>('models');
  const [historySessions, setHistorySessions] = useState<HistorySession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingReasoning, setStreamingReasoning] = useState('');
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [showApiKeyInModal, setShowApiKeyInModal] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [showQuestionModelDropdown, setShowQuestionModelDropdown] = useState(false);
  // 历史对话相关状态
  const [currentChatModel, setCurrentChatModel] = useState<ModelConfig | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<number | null>(null);
  const [recommendedQuestions, setRecommendedQuestions] = useState<string[]>([]);
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [historySearchQuery, setHistorySearchQuery] = useState('');

  useEffect(() => {
    loadConfig();
    loadHistory();
  }, []);

  // Check URL parameters to switch to history tab
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab === 'history') {
      setActiveTab('history');
    }
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.question-model-dropdown-container')) {
        setShowQuestionModelDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadHistory = async () => {
    const sessions = await getHistory();
    setHistorySessions(sessions);
    // 默认选中最新的对话
    if (sessions.length > 0 && !selectedSessionId) {
      setSelectedSessionId(sessions[0].id);
    }
  };

  const loadConfig = async () => {
    const config = await getAppConfig();
    setModels(config.models);

    // Load preferences
    if (config.preferences) {
      setPreferences(config.preferences);
    }

    const chatEnabledModels = config.models.filter(m => m.enabled && m.enableChat !== false);
    const chatModelIds = config.selectedChatModelIds || [];

    const validIds = chatModelIds.filter(id =>
      chatEnabledModels.some(m => m.id === id)
    );

    if (validIds.length === 0 && chatEnabledModels.length > 0) {
      const defaultIds = chatEnabledModels.map(m => m.id);
      setSelectedChatModelIds(defaultIds);
      await setSelectedChatModels(defaultIds);
    } else if (validIds.length !== chatModelIds.length) {
      setSelectedChatModelIds(validIds);
      await setSelectedChatModels(validIds);
    } else {
      setSelectedChatModelIds(chatModelIds);
    }

    setSelectedQuestionModelId(config.selectedQuestionModelId);

    // 加载当前选择的对话模型
    const currentModel = await getSelectedChatModel();
    setCurrentChatModel(currentModel);
  };

  // 格式化绝对时间
  const formatAbsoluteTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');

    if (isToday) {
      return `今天 ${hours}:${minutes}`;
    }

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    if (isYesterday) {
      return `昨天 ${hours}:${minutes}`;
    }

    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');

    if (date.getFullYear() === now.getFullYear()) {
      return `${month}/${day} ${hours}:${minutes}`;
    }

    return `${date.getFullYear()}/${month}/${day}`;
  };

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  };

  const handleSendFollowUp = async () => {
    if (!chatInput.trim() || isStreaming || !selectedSessionId) return;

    // 清除之前的推荐问题
    setRecommendedQuestions([]);

    const session = historySessions.find(s => s.id === selectedSessionId);
    if (!session) return;

    const userMessage: HistoryMessage = {
      role: 'user',
      content: chatInput.trim(),
      timestamp: Date.now(),
    };

    await addMessageToSession(selectedSessionId, userMessage);
    const updatedSessions = await getHistory();
    setHistorySessions(updatedSessions);

    setChatInput('');
    setIsStreaming(true);
    setStreamingContent('');
    setStreamingReasoning('');

    setTimeout(scrollToBottom, 50);

    try {
      const chatModelIds = selectedChatModelIds;
      if (!chatModelIds || chatModelIds.length === 0) {
        throw new Error('请先在设置中选择问答模型');
      }

      const model = models.find(m => m.id === chatModelIds[0]);
      if (!model) {
        throw new Error('未找到选中的模型');
      }

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
          addMessageToSession(selectedSessionId, assistantMessage).then(() => {
            getHistory().then(setHistorySessions);
          });

          // 自动生成推荐问题
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

      const sessionToUpdate = updatedSessions.find(s => s.id === selectedSessionId);

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

  const handlePresetSelect = (presetId: string) => {
    const preset = MODEL_PRESETS.find(p => p.id === presetId);
    if (preset) {
      setFormData({
        ...DEFAULT_FORM_DATA,
        id: `custom-${Date.now()}`,
        name: preset.name,
        provider: preset.provider,
        baseUrl: preset.baseUrl,
        modelId: preset.modelId,
      });
    }
  };

  const handleProviderChange = (provider: ProviderType) => {
    const defaults = PROVIDER_DEFAULTS[provider];
    setFormData({
      ...formData,
      provider,
      baseUrl: defaults.baseUrl || formData.baseUrl,
      modelId: defaults.modelId || formData.modelId,
    });
  };

  const handleSaveModel = async () => {
    if (!formData.name.trim()) {
      alert('请输入模型名称');
      return;
    }
    if (!formData.apiKey.trim()) {
      alert('请输入 API Key');
      return;
    }

    const config: ModelConfig = {
      id: editingModel?.id || formData.id || `model-${Date.now()}`,
      name: formData.name,
      provider: formData.provider,
      apiKey: formData.apiKey,
      baseUrl: formData.baseUrl,
      modelId: formData.modelId,
      enabled: editingModel?.enabled ?? true,
      enableChat: formData.enableChat,
      createdAt: editingModel?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };

    await saveModelConfig(config);
    await loadConfig();
    setShowModal(false);
    setFormData(DEFAULT_FORM_DATA);
    setEditingModel(null);
    setTestResult(null);
  };

  const handleEditModel = (model: ModelConfig) => {
    setEditingModel(model);
    setFormData({
      id: model.id,
      name: model.name,
      provider: model.provider,
      apiKey: model.apiKey,
      baseUrl: model.baseUrl,
      modelId: model.modelId,
      enableChat: model.enableChat !== false,
    });
    setShowApiKeyInModal(false);
    setTestResult(null);
    setShowModal(true);
  };

  const handleDeleteModel = async (modelId: string) => {
    if (confirm('确定要删除此模型吗？')) {
      await deleteModelConfig(modelId);
      await loadConfig();
    }
  };

  const handleTestConnection = async () => {
    if (!formData.apiKey.trim()) {
      alert('请先输入 API Key');
      return;
    }

    setTesting(true);
    setTestResult(null);

    const result = await testModelConnection({
      id: formData.id,
      name: formData.name,
      provider: formData.provider,
      apiKey: formData.apiKey,
      baseUrl: formData.baseUrl,
      modelId: formData.modelId,
      enabled: true,
      enableChat: formData.enableChat,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    setTestResult(result);
    setTesting(false);
  };

  const handleToggleEnableChat = async (modelId: string, enableChat: boolean) => {
    await setModelEnableChat(modelId, enableChat);
    loadConfig();
  };

  const handleSelectQuestionModel = async (modelId: string) => {
    await setSelectedQuestionModel(modelId);
    setSelectedQuestionModelId(modelId);
    setShowQuestionModelDropdown(false);
  };

  const handleDragStart = (modelId: string) => {
    setDraggedId(modelId);
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) return;

    const currentIds = [...selectedChatModelIds];
    const draggedIndex = currentIds.indexOf(draggedId);
    const targetIndex = currentIds.indexOf(targetId);

    if (draggedIndex !== -1 && targetIndex !== -1) {
      currentIds.splice(draggedIndex, 1);
      currentIds.splice(targetIndex, 0, draggedId);
      setSelectedChatModelIds(currentIds);
    }
  };

  const handleDragEnd = async () => {
    if (draggedId) {
      await setSelectedChatModels(selectedChatModelIds);
    }
    setDraggedId(null);
  };

  const getProviderIcon = (provider: ProviderType, size: 'sm' | 'md' = 'sm') => {
    const sizeClass = size === 'sm' ? 'w-5 h-5 text-[10px]' : 'w-8 h-8 text-sm';
    const colors: Record<ProviderType, string> = {
      'openai': 'bg-emerald-500',
      'anthropic': 'bg-orange-500',
      'deepseek': 'bg-blue-500',
      'qwen': 'bg-purple-500',
      'glm': 'bg-cyan-500',
      'openai-compat': 'bg-slate-500',
    };
    const labels: Record<ProviderType, string> = {
      'openai': 'O',
      'anthropic': 'C',
      'deepseek': 'D',
      'qwen': 'Q',
      'glm': 'G',
      'openai-compat': 'U',
    };
    return (
      <div className={`${sizeClass} ${colors[provider] || 'bg-slate-500'} rounded-md flex items-center justify-center text-white font-semibold`}>
        {labels[provider] || 'U'}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/80 backdrop-blur-xl shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img
                src={chrome.runtime.getURL('public/icons/icon48.png')}
                alt="Select Ask"
                className="w-11 h-11 rounded-xl shadow-lg shadow-blue-500/20"
              />
              <div>
                <h1 className="text-xl font-bold text-gray-900">Select Ask</h1>
                <p className="text-xs text-gray-500">配置中心</p>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
              {[
                { id: 'models', label: '模型配置', icon: '⚡' },
                { id: 'history', label: '历史记录', icon: '📋' },
                { id: 'about', label: '关于', icon: 'ℹ️' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeTab === tab.id
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-500 hover:text-gray-900 hover:bg-white/50'
                  }`}
                >
                  <span>{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {activeTab === 'models' && (
          <div className="space-y-8">
            {/* Model List */}
            <section className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">模型列表</h2>
                  <p className="text-sm text-gray-500 mt-1">配置您的 AI 模型，支持多个模型同时启用</p>
                </div>
                <button
                  onClick={() => {
                    setEditingModel(null);
                    setFormData(DEFAULT_FORM_DATA);
                    setShowApiKeyInModal(false);
                    setTestResult(null);
                    setShowModal(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all text-sm font-medium shadow-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  添加模型
                </button>
              </div>

              {models.length === 0 ? (
                <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-xl">
                  <div className="text-5xl mb-4">🤖</div>
                  <p className="text-gray-600">还没有配置任何模型</p>
                  <p className="text-sm text-gray-400 mt-2">点击「添加模型」开始使用</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {models.map((model) => {
                    const isQuestionModel = selectedQuestionModelId === model.id;
                    const enableChat = model.enableChat !== false;

                    return (
                      <div
                        key={model.id}
                        className={`group p-4 rounded-xl border transition-all duration-200 ${
                          enableChat || isQuestionModel
                            ? 'border-blue-200 bg-blue-50'
                            : 'border-gray-200 bg-gray-50 hover:bg-white hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            {getProviderIcon(model.provider, 'md')}
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-gray-900">{model.name}</span>
                                {isQuestionModel && (
                                  <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full border border-green-200">问题生成</span>
                                )}
                                {enableChat && (
                                  <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full border border-blue-200">问答</span>
                                )}
                              </div>
                              <div className="text-sm text-gray-500 mt-0.5 flex items-center gap-2">
                                <span>{PROVIDER_NAMES[model.provider]}</span>
                                <span className="text-gray-300">·</span>
                                <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">{model.modelId}</code>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {/* 参与问答开关 */}
                            <label className="flex items-center gap-2 cursor-pointer px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                              <span className="text-xs text-gray-500">问答</span>
                              <button
                                onClick={() => handleToggleEnableChat(model.id, !enableChat)}
                                className={`relative w-9 h-5 rounded-full transition-colors ${
                                  enableChat ? 'bg-blue-500' : 'bg-gray-300'
                                }`}
                              >
                                <span
                                  className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow-sm ${
                                    enableChat ? 'translate-x-4' : 'translate-x-0'
                                  }`}
                                />
                              </button>
                            </label>
                            <button
                              onClick={() => handleEditModel(model)}
                              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                              title="编辑"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDeleteModel(model.id)}
                              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                              title="删除"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Model Selection */}
            <section className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">模型用途配置</h2>

              {models.filter(m => m.enabled).length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
                  <div className="text-4xl mb-3">📭</div>
                  <p className="text-gray-500">请先添加模型配置</p>
                </div>
              ) : (
                <div className="grid gap-6 lg:grid-cols-2">
                  {/* Chat Models */}
                  <div className="p-5 bg-gray-50 rounded-xl border border-gray-200">
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      问答模型优先级
                      <span className="ml-2 text-xs text-gray-400">拖拽调整顺序</span>
                    </label>
                    <div className="space-y-2 min-h-[100px]">
                      {selectedChatModelIds.length === 0 ? (
                        <div className="text-sm text-gray-400 py-8 text-center border border-dashed border-gray-200 rounded-xl">
                          请在上方开启模型的「问答」开关
                        </div>
                      ) : (
                        selectedChatModelIds.map((modelId) => {
                          const model = models.find(m => m.id === modelId);
                          if (!model) return null;
                          return (
                            <div
                              key={modelId}
                              draggable
                              onDragStart={() => handleDragStart(modelId)}
                              onDragOver={(e) => handleDragOver(e, modelId)}
                              onDragEnd={handleDragEnd}
                              className={`group flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 cursor-move ${
                                draggedId === modelId
                                  ? 'border-blue-300 bg-blue-50 scale-[0.98]'
                                  : 'border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300'
                              }`}
                            >
                              {getProviderIcon(model.provider)}
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-gray-900 truncate text-sm">{model.name}</div>
                                <div className="text-xs text-gray-500">{PROVIDER_NAMES[model.provider]}</div>
                              </div>
                              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                              </svg>
                            </div>
                          );
                        })
                      )}
                    </div>
                    {selectedChatModelIds.length > 0 && (
                      <div className="mt-3 text-xs text-gray-400">
                        对话框将默认使用第一个模型
                      </div>
                    )}
                  </div>

                  {/* Question Model */}
                  <div className="p-5 bg-gray-50 rounded-xl border border-gray-200 question-model-dropdown-container">
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      问题生成模型
                      <span className="ml-2 text-xs text-gray-400">用于生成相关问题</span>
                    </label>
                    <div className="relative">
                      <button
                        onClick={() => setShowQuestionModelDropdown(!showQuestionModelDropdown)}
                        className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300 transition-all text-left"
                      >
                        {selectedQuestionModelId ? (
                          (() => {
                            const model = models.find(m => m.id === selectedQuestionModelId);
                            if (!model) return <span className="text-gray-400">选择模型</span>;
                            return (
                              <>
                                {getProviderIcon(model.provider)}
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-gray-900 truncate text-sm">{model.name}</div>
                                  <div className="text-xs text-gray-500">{PROVIDER_NAMES[model.provider]}</div>
                                </div>
                              </>
                            );
                          })()
                        ) : (
                          <span className="text-gray-400">选择模型</span>
                        )}
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      {showQuestionModelDropdown && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-xl z-10 max-h-60 overflow-y-auto">
                          {models.filter(m => m.enabled).map((model) => (
                            <button
                              key={model.id}
                              onClick={() => handleSelectQuestionModel(model.id)}
                              className={`w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors text-left ${
                                selectedQuestionModelId === model.id ? 'bg-blue-50' : ''
                              }`}
                            >
                              {getProviderIcon(model.provider)}
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-gray-900 truncate text-sm">{model.name}</div>
                                <div className="text-xs text-gray-500">{PROVIDER_NAMES[model.provider]}</div>
                              </div>
                              {selectedQuestionModelId === model.id && (
                                <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* Preferences Settings */}
            <section className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-gray-900">偏好设置</h2>
                <p className="text-sm text-gray-500 mt-1">自定义您的使用体验</p>
              </div>

              <div className="space-y-4">
                {/* Send with Enter toggle */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-gray-900">消息发送方式</h3>
                    <p className="text-xs text-gray-500 mt-1">
                      当前：{preferences.sendWithEnter ? 'Enter 发送消息' : 'Ctrl+Enter 发送消息'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs ${!preferences.sendWithEnter ? 'text-blue-600 font-medium' : 'text-gray-600'}`}>
                      Ctrl+Enter
                    </span>
                    <button
                      onClick={async () => {
                        const newValue = !preferences.sendWithEnter;
                        setPreferences(prev => ({ ...prev, sendWithEnter: newValue }));

                        const config = await getAppConfig();
                        const updatedConfig = {
                          ...config,
                          preferences: {
                            ...config.preferences,
                            sendWithEnter: newValue,
                            sidebarWidth: config.preferences?.sidebarWidth ?? 420,
                            autoGenerateQuestions: config.preferences?.autoGenerateQuestions ?? true,
                          }
                        };
                        await saveAppConfig(updatedConfig);
                      }}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 ${
                        preferences.sendWithEnter ? 'bg-blue-600' : 'bg-gray-200'
                      }`}
                      role="switch"
                      aria-checked={preferences.sendWithEnter}
                    >
                      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        preferences.sendWithEnter ? 'translate-x-5' : 'translate-x-0'
                      }`}>
                      </span>
                    </button>
                    <span className={`text-xs ${preferences.sendWithEnter ? 'text-blue-600 font-medium' : 'text-gray-600'}`}>
                      Enter
                    </span>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'history' && (
          <section className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm h-[calc(100vh-120px)] min-h-[500px]">
            <div className="flex h-full">
              {/* 左侧历史列表 - 复用全屏模式样式 */}
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
                  {(() => {
                    // 搜索过滤
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

                    return filteredSessions.length === 0 ? (
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
                          onClick={() => setSelectedSessionId(session.id)}
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
                    );
                  })()}
                </div>
              </div>

              {/* 右侧对话区域 */}
              <div className="flex-1 flex flex-col min-w-0 bg-gradient-to-b from-white to-[#f8fafc]">
                {selectedSessionId ? (() => {
                  const session = historySessions.find(s => s.id === selectedSessionId);
                  if (!session) return null;

                  // 获取可用于对话的模型
                  const chatEnabledModels = models.filter(m => m.enabled && m.enableChat !== false);

                  return (
                    <>
                      {/* 引用卡片 */}
                      <div className="px-4 py-3 border-b border-gray-100">
                        <div className="bg-[#f7f8fa] border-l-[3px] border-l-[#165dff] rounded-md px-3 py-2">
                          <div className="text-[11px] text-[#86909c] font-medium mb-1">📝 选中文本</div>
                          <div className="text-[13px] text-[#4e5969] line-clamp-2 leading-relaxed">{session.selectedText}</div>
                        </div>
                      </div>

                      {/* 消息列表 - 简化风格，参考DeepSeek */}
                      <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-[20px]">
                        {session.messages.map((msg, idx) => (
                          <div
                            key={idx}
                            className={msg.role === 'user' ? 'flex justify-end' : 'flex'}
                          >
                            {msg.role === 'assistant' ? (
                              /* AI消息 - 简洁风格 */
                              <div className="flex gap-[10px] max-w-full">
                                {/* AI头像 */}
                                <div className="w-8 h-8 rounded-full bg-[#f2f3f5] flex items-center justify-center flex-shrink-0 overflow-hidden">
                                  <img src={chrome.runtime.getURL('public/icons/icon48.png')} alt="AI" className="w-7 h-7 rounded-full object-cover" />
                                </div>

                                {/* AI内容 */}
                                <div className="flex-1 min-w-0">
                                  {/* 思考过程 */}
                                  {msg.reasoning && (
                                    <details className="mb-3 group open" open>
                                      <summary className="flex items-center gap-2 cursor-pointer text-[12px] font-medium text-[#86909c] hover:text-[#165dff] list-none py-2 px-[10px] bg-transparent border border-[#e5e6eb] rounded-lg transition-all group-open:rounded-b-none group-open:border-b-0">
                                        <span>💭</span>
                                        <span>思考过程</span>
                                        <svg className="w-3 h-3 ml-auto transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                      </summary>
                                      <div className="text-[12px] text-[#4e5969] leading-[1.6] prose prose-xs max-w-none py-2 px-[10px] bg-transparent border border-[#e5e6eb] rounded-b-lg border-t-0">
                                        <div dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.reasoning) }} />
                                      </div>
                                    </details>
                                  )}

                                  {/* 回答内容 - 无边框无背景 */}
                                  <div className="text-[14px] text-[#1d2129] leading-relaxed prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
                                </div>
                              </div>
                            ) : (
                              /* 用户消息 - 简洁无气泡 */
                              <div className="max-w-[80%] text-[14px] text-[#1d2129] leading-relaxed">
                                {msg.content}
                              </div>
                            )}
                          </div>
                        ))}

                        {/* 流式输出 */}
                        {isStreaming && (
                          <div className="flex gap-[10px] flex-row">
                            <div className="w-8 h-8 rounded-full bg-[#f2f3f5] flex items-center justify-center flex-shrink-0 overflow-hidden">
                              <img src={chrome.runtime.getURL('public/icons/icon48.png')} alt="AI" className="w-7 h-7 rounded-full object-cover" />
                            </div>
                            <div className="max-w-[85%] min-w-0 rounded-xl px-[14px] py-[12px] bg-[rgba(59,130,246,0.02)] border border-[rgba(59,130,246,0.06)]">
                              {streamingReasoning && (
                                <details className="mb-2 group open" open>
                                  <summary className="flex items-center gap-2 cursor-pointer text-[12px] font-medium text-[#86909c] hover:text-[#165dff] list-none py-2 px-[10px] bg-transparent border border-[#e5e6eb] rounded-lg transition-all group-open:rounded-b-none group-open:border-b-0">
                                    <span>💭</span>
                                    <span>思考中...</span>
                                    <svg className="w-3 h-3 ml-auto transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                  </summary>
                                  <div className="text-[12px] text-[#4e5969] leading-[1.6] prose prose-xs max-w-none py-2 px-[10px] bg-transparent border border-[#e5e6eb] rounded-b-lg border-t-0">
                                    <div dangerouslySetInnerHTML={{ __html: renderMarkdown(streamingReasoning) }} />
                                  </div>
                                </details>
                              )}
                              <div className="text-[14px] text-[#1d2129] leading-relaxed prose prose-sm max-w-none">
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
                        {/* 输入框容器 - 圆角卡片式设计 */}
                        <div className="flex flex-col bg-[#f8fafc] border border-[rgba(59,130,246,0.12)] rounded-[20px] overflow-hidden transition-all focus-within:border-[rgba(59,130,246,0.35)] focus-within:bg-white focus-within:shadow-[0_0_0_3px_rgba(59,130,246,0.08),0_4px_12px_rgba(59,130,246,0.1)]">
                          {/* 输入行：文本框 */}
                          <div className="flex gap-2 items-end p-2 pb-0">
                            <textarea
                              value={chatInput}
                              onChange={(e) => setChatInput(e.target.value)}
                              onKeyDown={async (e) => {
                                if (e.key === 'Enter') {
                                  const config = await getAppConfig();
                                  const sendWithEnter = config.preferences?.sendWithEnter ?? false;

                                  if (sendWithEnter) {
                                    // Enter发送,Shift+Enter换行
                                    if (!e.shiftKey) {
                                      e.preventDefault();
                                      handleSendFollowUp();
                                    }
                                  } else {
                                    // Ctrl+Enter发送
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

                          {/* 底部控制栏：模型选择器 + 发送按钮 */}
                          <div className="flex gap-2 items-center justify-between px-3 pb-2">
                            <div className="inline-flex items-center gap-1">
                              <select
                                value={currentChatModel?.id || ''}
                                onChange={async (e) => {
                                  const modelId = e.target.value;
                                  if (modelId) {
                                    await setSelectedChatModel(modelId);
                                    const model = chatEnabledModels.find(m => m.id === modelId);
                                    setCurrentChatModel(model || null);
                                  }
                                }}
                                className="py-1 px-0 border-none rounded-none bg-transparent text-[13px] font-medium text-[#1d2129] cursor-pointer outline-none appearance-none whitespace-nowrap hover:text-[#165dff] focus:text-[#165dff]"
                              >
                                {chatEnabledModels.map(model => (
                                  <option key={model.id} value={model.id}>{model.name}</option>
                                ))}
                              </select>
                              <svg className="w-4 h-4 text-[#86909c] pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                            {/* 发送按钮 */}
                            <button
                              onClick={handleSendFollowUp}
                              disabled={isStreaming || !chatInput.trim()}
                              className="w-8 h-8 border-none rounded-full flex items-center justify-center transition-all flex-shrink-0 p-0 bg-gradient-to-br from-[#3b82f6] to-[#6366f1] text-white shadow-[0_2px_8px_rgba(59,130,246,0.3)] hover:from-[#2563eb] hover:to-[#4f46e5] hover:-translate-y-[1px] hover:shadow-[0_4px_16px_rgba(59,130,246,0.4)] active:scale-[0.95] disabled:bg-[#e5e6eb] disabled:cursor-not-allowed disabled:text-[#c9cdd4] disabled:shadow-none disabled:hover:translate-y-0"
                            >
                              {isStreaming ? (
                                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                              ) : (
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M12 19V5M5 12l7-7 7 7"/>
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
        )}

        {activeTab === 'about' && (
          <section className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
            <div className="max-w-2xl mx-auto">
              <div className="text-center mb-8">
                <img
                  src={chrome.runtime.getURL('public/icons/icon48.png')}
                  alt="Select Ask"
                  className="w-16 h-16 rounded-2xl shadow-lg shadow-blue-500/20 mx-auto mb-4"
                />
                <h2 className="text-2xl font-bold text-gray-900">Select Ask</h2>
                <p className="text-gray-500 mt-2">选中即问，知识自来</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="p-5 bg-gray-50 rounded-xl border border-gray-200">
                  <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <span>✨</span> 功能特性
                  </h3>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                      选中文本后一键解释、翻译
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                      AI 生成相关问题推荐
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                      支持追问功能
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                      支持多种大模型
                    </li>
                  </ul>
                </div>

                <div className="p-5 bg-gray-50 rounded-xl border border-gray-200">
                  <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <span>🔒</span> 隐私说明
                  </h3>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    所有 API Key 均使用 AES-256 加密存储在本地浏览器中，不会上传到任何服务器。
                    您的聊天内容仅发送到您配置的 AI 服务提供商。
                  </p>
                </div>
              </div>

              <div className="mt-6 p-5 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-gray-200">
                <h3 className="font-medium text-gray-900 mb-3">支持的模型</h3>
                <div className="flex flex-wrap gap-2">
                  {['OpenAI GPT-4', 'Claude', 'DeepSeek', '通义千问', '智谱 GLM', '自定义模型'].map((name) => (
                    <span key={name} className="px-3 py-1.5 text-sm bg-white text-gray-600 rounded-lg border border-gray-200 shadow-sm">
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-gray-200 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  {editingModel ? '编辑模型' : '添加模型'}
                </h3>
                <button
                  onClick={() => {
                    setShowModal(false);
                    setFormData(DEFAULT_FORM_DATA);
                    setEditingModel(null);
                    setTestResult(null);
                  }}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Quick Select Preset */}
            {!editingModel && (
              <div className="p-6 border-b border-gray-100">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  快速选择预设
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {MODEL_PRESETS.slice(0, 6).map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => handlePresetSelect(preset.id)}
                      className="flex items-center gap-2 px-3 py-2.5 text-sm border border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-all text-left text-gray-600 hover:text-gray-900"
                    >
                      {getProviderIcon(preset.provider)}
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Form */}
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  模型名称 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="如：我的 GPT-4"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  提供商
                </label>
                <select
                  value={formData.provider}
                  onChange={(e) => handleProviderChange(e.target.value as ProviderType)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 appearance-none cursor-pointer"
                >
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic (Claude)</option>
                  <option value="deepseek">DeepSeek</option>
                  <option value="qwen">通义千问</option>
                  <option value="glm">智谱AI</option>
                  <option value="openai-compat">OpenAI 兼容</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  API Key <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showApiKeyInModal ? 'text' : 'password'}
                    value={formData.apiKey}
                    onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                    placeholder="sk-..."
                    className="w-full px-4 py-3 pr-12 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 font-mono text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKeyInModal(!showApiKeyInModal)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showApiKeyInModal ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  API 地址
                </label>
                <input
                  type="text"
                  value={formData.baseUrl}
                  onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
                  placeholder="https://api.openai.com/v1"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  模型 ID
                </label>
                <input
                  type="text"
                  value={formData.modelId}
                  onChange={(e) => setFormData({ ...formData, modelId: e.target.value })}
                  placeholder="gpt-4o"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                />
              </div>

              {/* Test Result */}
              {testResult && (
                <div className={`p-3 rounded-xl text-sm ${testResult.success ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                  {testResult.success ? '✓ 连接成功' : `✗ ${testResult.error}`}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleTestConnection}
                  disabled={testing}
                  className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-200 hover:border-gray-300 rounded-xl transition-all disabled:opacity-50"
                >
                  {testing ? '测试中...' : '测试连接'}
                </button>
                <div className="flex-1" />
                <button
                  onClick={() => {
                    setShowModal(false);
                    setFormData(DEFAULT_FORM_DATA);
                    setEditingModel(null);
                    setTestResult(null);
                  }}
                  className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-200 hover:border-gray-300 rounded-xl transition-all"
                >
                  取消
                </button>
                <button
                  onClick={handleSaveModel}
                  className="px-6 py-2.5 text-sm font-medium bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all"
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}