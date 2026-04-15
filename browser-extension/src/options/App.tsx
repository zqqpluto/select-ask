import { useEffect, useState, useRef } from 'react';
import {
  getAppConfig,
  saveAppConfig,
  saveModelConfig,
  deleteModelConfig,
  testModelConnection,
  getModelConfig,
  getModelConfigs,
  getSelectedChatModel,
  setSelectedChatModel,
  getFallbackLanguage,
  setFallbackLanguage,
  getDisplayMode,
  setDisplayMode,
  getSelectedTranslationModel,
  setSelectedTranslationModel,
  getTranslationConfig,
  saveTranslationConfig,
  getFullPageTranslationConfig,
  saveFullPageTranslationConfig,
} from '../utils/config-manager';
import { TARGET_LANGUAGES, DEFAULT_TRANSLATION_CONFIG, DEFAULT_FULLPAGE_TRANSLATION_CONFIG } from '../types/config';
import { getHistory, deleteSession, clearHistory, addMessageToSession } from '../utils/history-manager';
import { MODEL_PRESETS, PROVIDER_NAMES, PROVIDER_DEFAULTS } from '../types/config';
import { LLM_STREAM_PORT_NAME } from '../types/messages';
import type { ModelConfig, ProviderType, TranslationConfig, FullPageTranslationConfig } from '../types';
import type { HistorySession, HistoryMessage } from '../types/history';
import { marked } from 'marked';

interface ModelFormData {
  id: string;
  name: string;
  provider: ProviderType;
  apiKey: string;
  baseUrl: string;
  modelId: string;
  enabled: boolean;
}

const DEFAULT_FORM_DATA: ModelFormData = {
  id: '',
  name: '',
  provider: '' as ProviderType,
  apiKey: '',
  baseUrl: '',
  modelId: '',
  enabled: true,
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
            .slice(0, 3); // 只展示 3 个

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

// 转义 HTML 防止 XSS
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 格式化耗时
function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}秒`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}分${remainingSeconds}秒`;
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
  const [preferences, setPreferences] = useState({
    sendWithEnter: false,
    sidebarWidth: 420,
    autoGenerateQuestions: true,
    translation: DEFAULT_TRANSLATION_CONFIG,
  });
  const [fallbackLang, setFallbackLang] = useState<string>('en');
  const [showFloatingIcon, setShowFloatingIcon] = useState(true);
  const [displayMode, setDisplayModeState] = useState<'floating' | 'sidebar'>('floating');
  const [translationConfig, setTranslationConfig] = useState<TranslationConfig>(DEFAULT_TRANSLATION_CONFIG);
  const [fullPageConfig, setFullPageConfig] = useState<FullPageTranslationConfig>(DEFAULT_FULLPAGE_TRANSLATION_CONFIG);
  const [showModal, setShowModal] = useState(false);
  const [editingModel, setEditingModel] = useState<ModelConfig | null>(null);
  const [formData, setFormData] = useState<ModelFormData>(DEFAULT_FORM_DATA);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [draggedModelId, setDraggedModelId] = useState<string | null>(null);
  const [dragOverModelId, setDragOverModelId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'settings' | 'history' | 'about'>('settings');
  const [activeSettingSection, setActiveSettingSection] = useState('model');
  const [historySessions, setHistorySessions] = useState<HistorySession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingReasoning, setStreamingReasoning] = useState('');
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const settingsContentRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const [showApiKeyInModal, setShowApiKeyInModal] = useState(false);
  const [visibleApiKeys, setVisibleApiKeys] = useState<Set<string>>(new Set());
  // 历史对话相关状态
  const [currentChatModel, setCurrentChatModel] = useState<ModelConfig | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<number | null>(null);
  const [recommendedQuestions, setRecommendedQuestions] = useState<string[]>([]);
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [selectedTranslationModelId, setSelectedTranslationModelIdState] = useState<string | null>(null);
  // 模型列表获取相关状态
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [modelSearchQuery, setModelSearchQuery] = useState('');
  const [presetFilter, setPresetFilter] = useState('all');
  const [formError, setFormError] = useState<string>('');
  const autoFetchedApiKeyRef = useRef<string>('');
  // 历史记录页面思考过程展开/折叠状态
  const [expandedHistoryReasoning, setExpandedHistoryReasoning] = useState<Record<number, boolean>>({});

  // 自动获取模型：用户输入 API Key 后延迟触发
  useEffect(() => {
    if (!showModal || editingModel) return;
    const apiKey = formData.apiKey.trim();
    if (!apiKey || apiKey.length < 5) return;
    if (apiKey === autoFetchedApiKeyRef.current) return; // 已获取过

    const timer = setTimeout(async () => {
      autoFetchedApiKeyRef.current = apiKey;
      try {
        const { provider, baseUrl } = formData;
        let url: string;
        const headers: Record<string, string> = {};
        if (provider === 'anthropic') {
          url = baseUrl.includes('/v1') ? `${baseUrl}/v1/models` : `${baseUrl}/v1/models`;
          headers['x-api-key'] = apiKey;
          headers['anthropic-version'] = '2023-06-01';
        } else {
          url = baseUrl.includes('/v1') ? `${baseUrl}/models` : `${baseUrl}/v1/models`;
          headers['Authorization'] = `Bearer ${apiKey}`;
        }
        const resp = await fetch(url, { headers });
        if (resp.ok) {
          const data = await resp.json();
          const modelIds = (data.data || []).map((m: any) => m.id).sort();
          if (modelIds.length > 0) {
            setAvailableModels(modelIds);
            setShowModelDropdown(true);
          }
        }
      } catch {
        // 静默失败，用户可手动点击"获取模型"
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [showModal, editingModel, formData.apiKey, formData.provider, formData.baseUrl]);

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

  // 设置页面滚动监听 - 自动高亮侧边栏
  useEffect(() => {
    if (activeTab !== 'settings') return;

    const container = settingsContentRef.current;
    if (!container) return;

    const handleScroll = () => {
      const scrollTop = container.scrollTop;
      const sections = [
        { id: 'model', ref: sectionRefs.current['model'] },
        { id: 'appearance', ref: sectionRefs.current['appearance'] },
        { id: 'preference', ref: sectionRefs.current['preference'] },
        { id: 'translation', ref: sectionRefs.current['translation'] },
      ];

      let current = sections[0].id;
      for (const s of sections) {
        if (s.ref && s.ref.offsetTop - scrollTop <= 120) {
          current = s.id;
        }
      }
      setActiveSettingSection(current);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [activeTab]);

  const scrollToSection = (sectionId: string) => {
    const el = sectionRefs.current[sectionId];
    if (el && settingsContentRef.current) {
      settingsContentRef.current.scrollTo({
        top: el.offsetTop - 16,
        behavior: 'smooth',
      });
      setActiveSettingSection(sectionId);
    }
  };

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
    const models = await getModelConfigs();
    setModels(models);

    // Load preferences
    if (config.preferences) {
      setPreferences({
        ...config.preferences,
        translation: config.preferences.translation || DEFAULT_TRANSLATION_CONFIG,
      });
    }

    // Load fallback language
    const fbLang = await getFallbackLanguage();
    setFallbackLang(fbLang);

    // Load appearance settings
    setShowFloatingIcon(config.showFloatingIcon ?? true);
    const dm = await getDisplayMode();
    setDisplayModeState(dm);

    // Load translation config
    const tc = await getTranslationConfig();
    setTranslationConfig(tc);

    // Load full page translation config
    const fc = await getFullPageTranslationConfig();
    setFullPageConfig(fc);

    // 加载当前选择的对话模型
    const currentModel = await getSelectedChatModel();
    setCurrentChatModel(currentModel);

    // 加载翻译模型
    const translationModel = await getSelectedTranslationModel();
    setSelectedTranslationModelIdState(translationModel?.id || null);
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
      setAvailableModels([]);
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
    setAvailableModels([]);
    setFormData({
      ...formData,
      provider,
      baseUrl: defaults.baseUrl || formData.baseUrl,
      modelId: defaults.modelId || formData.modelId,
    });
  };

  // 从 API 获取可用模型列表
  const fetchAvailableModels = async () => {
    if (!formData.apiKey.trim()) {
      setFormError('请先输入 API Key');
      return;
    }
    setLoadingModels(true);
    setFormError('');
    try {
      const { provider, baseUrl, apiKey } = formData;
      let url: string;
      const headers: Record<string, string> = {};

      if (provider === 'anthropic') {
        url = baseUrl.includes('/v1') ? `${baseUrl}/v1/models` : `${baseUrl}/v1/models`;
        headers['x-api-key'] = apiKey;
        headers['anthropic-version'] = '2023-06-01';
      } else {
        url = baseUrl.includes('/v1') ? `${baseUrl}/models` : `${baseUrl}/v1/models`;
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      const resp = await fetch(url, { headers });
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }
      const data = await resp.json();
      const modelIds = (data.data || []).map((m: any) => m.id).sort();
      setAvailableModels(modelIds);
      setShowModelDropdown(true);
    } catch (error) {
      setFormError(`获取模型失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setLoadingModels(false);
    }
  };

  const handleSaveModel = async () => {
    setFormError('');
    if (!formData.modelId.trim()) {
      setFormError('请输入或选择模型 ID');
      return;
    }
    if (!formData.apiKey.trim()) {
      setFormError('请输入 API Key');
      return;
    }

    const config: ModelConfig = {
      id: editingModel?.id || formData.id || `model-${Date.now()}`,
      name: formData.modelId,
      provider: formData.provider,
      apiKey: formData.apiKey,
      baseUrl: formData.baseUrl,
      modelId: formData.modelId,
      enabled: formData.enabled,
      enableChat: formData.enabled,
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
      apiKey: model.apiKey || '',
      baseUrl: model.baseUrl,
      modelId: model.modelId,
      enabled: model.enabled,
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
      enabled: formData.enabled,
      enableChat: formData.enabled,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    setTestResult(result);
    setTesting(false);
  };

  const handleToggleEnabled = async (modelId: string, enabled: boolean) => {
    const model = models.find(m => m.id === modelId);
    if (!model) return;
    const updated = { ...model, enabled, updatedAt: Date.now() };
    await saveModelConfig(updated);
    loadConfig();
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
      'local-ollama': 'bg-amber-500',
      'local-lm-studio': 'bg-rose-500',
    };
    const labels: Record<ProviderType, string> = {
      'openai': 'O',
      'anthropic': 'A',
      'deepseek': 'D',
      'qwen': 'Q',
      'glm': 'G',
      'openai-compat': '⚙',
      'local-ollama': '🖥',
      'local-lm-studio': '📦',
    };
    return (
      <div className={`${sizeClass} ${colors[provider] || 'bg-slate-500'} rounded-md flex items-center justify-center text-white font-semibold`}>
        {labels[provider] || 'U'}
      </div>
    );
  };

  // 模型拖拽排序
  const handleModelDragStart = (modelId: string) => {
    setDraggedModelId(modelId);
  };

  const handleModelDragOver = (e: React.DragEvent, modelId: string) => {
    e.preventDefault();
    if (draggedModelId && draggedModelId !== modelId) {
      setDragOverModelId(modelId);
    }
  };

  const handleModelDrop = async (targetModelId: string) => {
    if (!draggedModelId || draggedModelId === targetModelId) {
      setDraggedModelId(null);
      setDragOverModelId(null);
      return;
    }

    const fromIndex = models.findIndex(m => m.id === draggedModelId);
    const toIndex = models.findIndex(m => m.id === targetModelId);
    if (fromIndex < 0 || toIndex < 0) {
      setDraggedModelId(null);
      setDragOverModelId(null);
      return;
    }

    // 重新排序
    const newModels = [...models];
    const [movedModel] = newModels.splice(fromIndex, 1);
    newModels.splice(toIndex, 0, movedModel);

    // 更新配置中 models 的顺序
    const config = await getAppConfig();
    config.models = newModels;
    await saveAppConfig(config);
    setModels(newModels);

    setDraggedModelId(null);
    setDragOverModelId(null);
  };

  const handleDragEnd = () => {
    setDraggedModelId(null);
    setDragOverModelId(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/80 backdrop-blur-xl shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-white shadow-lg shadow-blue-500/20 flex items-center justify-center">
                <img
                  src={chrome.runtime.getURL('public/icons/icon48.png')}
                  alt="Select Ask"
                  className="w-8 h-8"
                />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Select Ask</h1>
                <p className="text-xs text-gray-500">配置中心</p>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
              {[
                { id: 'settings', label: '设置', icon: (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )},
                { id: 'history', label: '历史记录', icon: (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )},
                { id: 'about', label: '关于', icon: (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )},
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
        {activeTab === 'settings' && (
          <div className="flex gap-8">
            {/* 左侧边栏导航 */}
            <aside className="w-48 flex-shrink-0">
              <div className="sticky top-28 space-y-1">
                {[
                  { id: 'model', label: '模型管理', icon: (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  )},
                  { id: 'appearance', label: '外观设置', icon: (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                    </svg>
                  )},
                  { id: 'preference', label: '偏好设置', icon: (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )},
                  { id: 'translation', label: '翻译设置', icon: (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                    </svg>
                  )},
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => scrollToSection(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${
                      activeSettingSection === item.id
                        ? 'bg-blue-50 text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    <span className="flex-shrink-0">{item.icon}</span>
                    {item.label}
                  </button>
                ))}
              </div>
            </aside>

            {/* 右侧滚动内容 */}
            <div ref={settingsContentRef} className="flex-1 min-w-0 max-h-[calc(100vh-140px)] overflow-y-auto pr-2">
              <div className="space-y-8">

            {/* 1. 模型管理 */}
            <section ref={(el) => { sectionRefs.current['model'] = el; }} className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">模型管理</h2>
                  <p className="text-sm text-gray-500 mt-1">配置您的 AI 模型，启用的模型将参与问答和翻译</p>
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
                  {models.map((model, index) => {
                    return (
                      <div
                        key={model.id}
                        draggable
                        onDragStart={() => handleModelDragStart(model.id)}
                        onDragOver={(e) => handleModelDragOver(e, model.id)}
                        onDrop={() => handleModelDrop(model.id)}
                        onDragEnd={handleDragEnd}
                        className={`group p-4 rounded-xl border transition-all duration-200 cursor-grab active:cursor-grabbing ${
                          model.enabled
                            ? 'border-blue-200 bg-blue-50'
                            : 'border-gray-200 bg-gray-50 hover:bg-white hover:border-gray-300'
                        } ${dragOverModelId === model.id ? 'border-indigo-400 ring-2 ring-indigo-100' : ''}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {/* 拖拽手柄 */}
                            <div className="flex-shrink-0 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 transition-colors" title="拖拽排序">
                              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                <circle cx="5" cy="3" r="1.5"/>
                                <circle cx="11" cy="3" r="1.5"/>
                                <circle cx="5" cy="8" r="1.5"/>
                                <circle cx="11" cy="8" r="1.5"/>
                                <circle cx="5" cy="13" r="1.5"/>
                                <circle cx="11" cy="13" r="1.5"/>
                              </svg>
                            </div>
                            {/* 序号 */}
                            <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-xs text-gray-400 font-medium">{index + 1}</span>
                            {getProviderIcon(model.provider, 'md')}
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-gray-900">{model.name}</span>
                                <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-500 font-mono">{model.modelId}</code>
                              </div>
                              <div className="text-xs text-gray-400 mt-0.5">
                                <span>{PROVIDER_NAMES[model.provider]}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {/* 启用/禁用开关 */}
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500">{model.enabled ? '已启用' : '已禁用'}</span>
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={model.enabled}
                                  onChange={() => handleToggleEnabled(model.id, !model.enabled)}
                                  className="sr-only peer"
                                />
                                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500"></div>
                              </label>
                            </div>
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

            {/* 2. 外观设置 */}
            <section ref={(el) => { sectionRefs.current['appearance'] = el; }} className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-gray-900">外观设置</h2>
                <p className="text-sm text-gray-500 mt-1">控制页面中选中文本后的浮动菜单入口</p>
              </div>

              <div className="space-y-4">
                {/* 悬浮图标开关 */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-gray-900">悬浮图标</h3>
                    <p className="text-xs text-gray-500 mt-1">选中文本后显示操作菜单的快捷入口</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer ml-4">
                    <input
                      type="checkbox"
                      checked={showFloatingIcon}
                      onChange={() => {
                        const newVal = !showFloatingIcon;
                        setShowFloatingIcon(newVal);
                        const config = getAppConfig().then(c => {
                          c.showFloatingIcon = newVal;
                          saveAppConfig(c);
                        });
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>
            </section>

            {/* 3. 偏好设置 */}
            <section ref={(el) => { sectionRefs.current['preference'] = el; }} className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-gray-900">偏好设置</h2>
                <p className="text-sm text-gray-500 mt-1">自定义您的使用体验</p>
              </div>

              <div className="space-y-4">
                {/* 消息发送方式 */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-gray-900">消息发送方式</h3>
                    <p className="text-xs text-gray-500 mt-1">
                      当前：{preferences.sendWithEnter ? 'Enter 发送' : 'Ctrl+Enter 发送'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    <span className={`text-xs ${!preferences.sendWithEnter ? 'text-blue-600 font-medium' : 'text-gray-500'}`}>Ctrl+Enter</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={preferences.sendWithEnter}
                        onChange={async () => {
                          const newValue = !preferences.sendWithEnter;
                          setPreferences(prev => ({ ...prev, sendWithEnter: newValue }));
                          const config = await getAppConfig();
                          config.preferences = {
                            ...config.preferences,
                            sendWithEnter: newValue,
                            sidebarWidth: config.preferences?.sidebarWidth ?? 420,
                            autoGenerateQuestions: config.preferences?.autoGenerateQuestions ?? true,
                            translation: config.preferences?.translation ?? DEFAULT_TRANSLATION_CONFIG,
                          };
                          await saveAppConfig(config);
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                    <span className={`text-xs ${preferences.sendWithEnter ? 'text-blue-600 font-medium' : 'text-gray-500'}`}>Enter</span>
                  </div>
                </div>

                {/* 自动生成推荐问题 */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-gray-900">自动生成推荐问题</h3>
                    <p className="text-xs text-gray-500 mt-1">回答后自动生成相关问题推荐</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer ml-4">
                    <input
                      type="checkbox"
                      checked={preferences.autoGenerateQuestions}
                      onChange={async () => {
                        const newVal = !preferences.autoGenerateQuestions;
                        setPreferences(prev => ({ ...prev, autoGenerateQuestions: newVal }));
                        const config = await getAppConfig();
                        config.preferences = {
                          ...config.preferences,
                          sendWithEnter: config.preferences?.sendWithEnter ?? false,
                          sidebarWidth: config.preferences?.sidebarWidth ?? 420,
                          autoGenerateQuestions: newVal,
                          translation: config.preferences?.translation ?? DEFAULT_TRANSLATION_CONFIG,
                        };
                        await saveAppConfig(config);
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>
            </section>

            {/* 4. 翻译设置 */}
            <section ref={(el) => { sectionRefs.current['translation'] = el; }} className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-gray-900">翻译设置</h2>
                <p className="text-sm text-gray-500 mt-1">划词翻译和全文翻译的配置</p>
              </div>

              <div className="space-y-4">
                {/* 翻译模式 */}
                <div className="p-4 bg-gray-50 rounded-xl">
                  <h3 className="text-sm font-medium text-gray-900 mb-3">翻译模式</h3>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { value: 'inline' as const, label: '行内翻译', desc: '译文直接替换原文位置' },
                      { value: 'floating' as const, label: '悬浮窗', desc: '译文在选中文本附近悬浮' },
                      { value: 'sidebar' as const, label: '侧边栏', desc: '译文在侧边栏显示' },
                    ].map((option) => (
                      <button
                        key={option.value}
                        onClick={async () => {
                          const newConfig = { ...translationConfig, mode: option.value };
                          setTranslationConfig(newConfig);
                          await saveTranslationConfig(newConfig);
                        }}
                        className={`p-3 rounded-xl border-2 text-left transition-all ${
                          translationConfig.mode === option.value
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                      >
                        <div className={`text-sm font-medium ${translationConfig.mode === option.value ? 'text-blue-700' : 'text-gray-900'}`}>
                          {option.label}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">{option.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-gray-900">翻译策略</h3>
                    <p className="text-xs text-gray-500 mt-1">
                      系统语言翻译成：<span className="text-gray-700 font-medium">{TARGET_LANGUAGES.find(l => l.code === fallbackLang)?.label || fallbackLang}</span>
                    </p>
                  </div>
                  <select
                    value={fallbackLang}
                    onChange={async (e) => {
                      const newLang = e.target.value;
                      setFallbackLang(newLang);
                      await setFallbackLanguage(newLang);
                    }}
                    className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-700 cursor-pointer"
                  >
                    {TARGET_LANGUAGES.map(lang => (
                      <option key={lang.code} value={lang.code}>{lang.label}</option>
                    ))}
                  </select>
                </div>

                {/* 翻译模型选择 */}
                <div className="p-4 bg-gray-50 rounded-xl">
                  <h3 className="text-sm font-medium text-gray-900 mb-1">翻译模型</h3>
                  <p className="text-xs text-gray-500 mb-3">选择用于划词翻译的 AI 模型，可与问答模型分开设置</p>
                  <select
                    value={selectedTranslationModelId || '__default__'}
                    onChange={async (e) => {
                      const value = e.target.value;
                      const modelId = value === '__default__' ? null : value;
                      setSelectedTranslationModelIdState(modelId);
                      await setSelectedTranslationModel(modelId);
                    }}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-700 cursor-pointer"
                  >
                    <option value="__default__">使用默认问答模型</option>
                    {models.filter(m => m.enabled).map(model => (
                      <option key={model.id} value={model.id}>{model.name}（{PROVIDER_NAMES[model.provider]}）</option>
                    ))}
                  </select>
                  {selectedTranslationModelId && (
                    <p className="text-xs text-green-600 mt-2">当前使用独立翻译模型：{models.find(m => m.id === selectedTranslationModelId)?.name || ''}</p>
                  )}
                  {!selectedTranslationModelId && (
                    <p className="text-xs text-gray-400 mt-2">当前使用默认问答模型进行翻译</p>
                  )}
                </div>

                {/* 分隔线 */}
                <div className="border-t border-gray-200 my-2"></div>

                {/* 全文翻译设置 */}
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-3">全文翻译</h3>

                  <div className="space-y-3">
                    {/* 全文翻译目标语言 */}
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                      <div className="flex-1">
                        <h3 className="text-sm font-medium text-gray-900">目标语言</h3>
                        <p className="text-xs text-gray-500 mt-1">
                          全文翻译的目标语言：<span className="text-gray-700 font-medium">{fullPageConfig.targetLanguage === 'auto' ? '跟随浏览器语言' : TARGET_LANGUAGES.find(l => l.code === fullPageConfig.targetLanguage)?.label || fullPageConfig.targetLanguage}</span>
                        </p>
                      </div>
                      <select
                        value={fullPageConfig.targetLanguage}
                        onChange={async (e) => {
                          const newConfig = { ...fullPageConfig, targetLanguage: e.target.value };
                          setFullPageConfig(newConfig);
                          await saveFullPageTranslationConfig(newConfig);
                        }}
                        className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-700 cursor-pointer"
                      >
                        <option value="auto">跟随浏览器语言</option>
                        {TARGET_LANGUAGES.map(lang => (
                          <option key={lang.code} value={lang.code}>{lang.label}</option>
                        ))}
                      </select>
                    </div>

                  </div>
                </div>
              </div>
            </section>

              </div>
            </div>
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
                  const chatEnabledModels = models.filter(m => m.enabled);

                  return (
                    <>
                      {/* 引用卡片 */}
                      <div className="px-4 py-3 border-b border-gray-100">
                        <div className="bg-[#f7f8fa] border-l-[3px] border-l-[#165dff] rounded-md px-3 py-2">
                          <div className="text-[11px] text-[#86909c] font-medium mb-1">📝 选中文本</div>
                          <div className="text-[13px] text-[#4e5969] line-clamp-2 leading-relaxed">{session.selectedText}</div>
                        </div>
                      </div>

                      {/* 消息列表 - 与侧边栏一致的样式 */}
                      <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-[16px]">
                        {session.messages.map((msg, idx) => (
                          <div
                            key={idx}
                            className={`history-message history-message-${msg.role}`}
                          >
                            {msg.role === 'user' ? (
                              <div className="history-message-wrapper history-message-user-wrapper">
                                <div className="history-message-content">
                                  {escapeHtml(msg.content)}
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
                                  {/* 思考过程 */}
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
                                  {/* 回答正文 */}
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
                                        <span className="history-reasoning-model">{currentModel?.name || 'AI'}</span>
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
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Hero 区域 */}
            <div className="relative overflow-hidden px-8 py-8" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 40%, #312e81 70%, #4338ca 100%)' }}>
              {/* 装饰网格点 */}
              <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
              {/* 装饰光晕 */}
              <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-violet-400/20 rounded-full blur-[80px] translate-x-1/4 -translate-y-1/4" />
              <div className="absolute bottom-0 left-1/4 w-[300px] h-[300px] bg-indigo-400/15 rounded-full blur-[60px] translate-y-1/3" />
              <div className="relative">
                <div className="flex items-start gap-5">
                  {/* Logo */}
                  <div className="relative flex-shrink-0">
                    <div className="w-14 h-14 rounded-xl bg-white shadow-2xl flex items-center justify-center">
                      <img
                        src={chrome.runtime.getURL('public/icons/icon64.png')}
                        alt="Select Ask"
                        className="w-10 h-10"
                      />
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-indigo-900" />
                  </div>
                  {/* 文字 + 操作区 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1.5">
                      <h2 className="text-xl font-bold text-white tracking-tight">Select Ask</h2>
                      <span className="px-2 py-0.5 bg-white/10 text-white/70 text-[10px] font-medium rounded-full border border-white/10 backdrop-blur-sm font-mono">v1.0.0</span>
                    </div>
                    <p className="text-indigo-200/70 text-sm mb-3">选中即问，知识自来 — 一款现代浏览器扩展，让 AI 触手可及</p>
                    {/* GitHub 操作区 */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <a
                        href="https://github.com/zqqpluto/select-ask"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.07] text-white/80 text-xs font-medium rounded-lg hover:bg-white/15 hover:text-white transition-all border border-white/10"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                        </svg>
                        查看源码
                      </a>
                      <a
                        href="https://github.com/zqqpluto/select-ask/stargazers"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-yellow-300/90 text-xs font-medium rounded-lg hover:bg-yellow-400/10 hover:text-yellow-200 transition-all"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                        </svg>
                        Star 支持
                      </a>
                      <span className="text-white/20 text-xs">|</span>
                      <span className="font-mono text-[11px] text-indigo-300/30">React + TypeScript + Vite</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6">
              {/* 功能特性 - 3 列网格 */}
              <div className="mb-6">
                <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.852L21 12l-5.714 2.148L13 21l-2.286-6.852L5 12l5.714-2.148L13 3z"/>
                  </svg>
                  核心功能
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {[
                    { icon: '🔍', title: '选中文本即问', desc: '在任意网页选中文本，快速调用 AI 解释、翻译、总结' },
                    { icon: '💬', title: '多轮对话', desc: '与 AI 进行连续对话，深入探讨复杂问题' },
                    { icon: '🌐', title: '全文翻译', desc: '将整个网页内容翻译为目标语言，保持原文结构' },
                    { icon: '📝', title: '页面总结', desc: '智能提取网页核心内容，一键生成摘要' },
                    { icon: '🤖', title: '多模型支持', desc: '支持 OpenAI、Anthropic、通义千问、DeepSeek 等 10+ 主流模型' },
                    { icon: '📋', title: '历史记录', desc: '自动保存对话历史，随时回顾之前的交流' },
                  ].map((feature) => (
                    <div key={feature.title} className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50/50 transition-colors">
                      <div className="text-xl flex-shrink-0">{feature.icon}</div>
                      <div className="min-w-0">
                        <h4 className="font-medium text-gray-900 text-sm">{feature.title}</h4>
                        <p className="text-xs text-gray-500 leading-relaxed mt-0.5">{feature.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 支持的供应商 — 与添加模型页面保持一致 */}
              <div className="mb-6">
                <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4 text-indigo-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"/>
                  </svg>
                  AI 模型供应商
                </h3>
                {/* 主流模型 */}
                <div className="mb-3">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">主流模型</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { name: 'OpenAI', desc: 'GPT-4 / GPT-4o', color: 'emerald' },
                      { name: 'Anthropic', desc: 'Claude 系列', color: 'orange' },
                      { name: 'DeepSeek', desc: 'V3 / R1', color: 'sky' },
                      { name: '通义千问', desc: 'Qwen 系列', color: 'purple' },
                      { name: '智谱 AI', desc: 'GLM 系列', color: 'cyan' },
                    ].map((provider) => {
                      const colorMap: Record<string, { bg: string; text: string; badge: string }> = {
                        emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-600' },
                        orange: { bg: 'bg-orange-50', text: 'text-orange-700', badge: 'bg-orange-100 text-orange-600' },
                        sky: { bg: 'bg-sky-50', text: 'text-sky-700', badge: 'bg-sky-100 text-sky-600' },
                        purple: { bg: 'bg-purple-50', text: 'text-purple-700', badge: 'bg-purple-100 text-purple-600' },
                        cyan: { bg: 'bg-cyan-50', text: 'text-cyan-700', badge: 'bg-cyan-100 text-cyan-600' },
                      };
                      const c = colorMap[provider.color] || colorMap.slate;
                      return (
                        <div key={provider.name} className={`inline-flex items-center gap-2 px-3 py-2 ${c.bg} rounded-full border border-transparent hover:border-gray-200 transition-all cursor-default`}>
                          <span className={`font-medium ${c.text} text-sm`}>{provider.name}</span>
                          {provider.desc && <span className={`text-xs px-1.5 py-0.5 rounded-full ${c.badge} font-medium`}>{provider.desc}</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
                {/* OpenAI 兼容 */}
                <div className="mb-3">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">OpenAI 兼容</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      'Moonshot · Kimi', '字节豆包', '百度文心', 'MiniMax',
                      '硅基流动', 'Google Gemini', 'Groq',
                      'Mistral AI',
                    ].map((name) => (
                      <div key={name} className="inline-flex items-center px-3 py-2 bg-slate-50 rounded-full border border-transparent hover:border-gray-200 transition-all cursor-default">
                        <span className="font-medium text-slate-700 text-sm">{name}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {/* 本地部署 */}
                <div>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">本地部署</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { name: 'Ollama 本地', desc: '本地部署' },
                      { name: 'LM Studio', desc: '本地部署' },
                    ].map((provider) => (
                      <div key={provider.name} className="inline-flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-full border border-transparent hover:border-gray-200 transition-all cursor-default">
                        <span className="font-medium text-gray-700 text-sm">{provider.name}</span>
                        {provider.desc && <span className="text-xs px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">{provider.desc}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* 隐私说明 */}
              <div className="mb-6">
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                  <h4 className="font-medium text-gray-900 mb-2.5 flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                    隐私与安全
                  </h4>
                  <ul className="space-y-1.5 text-sm text-gray-600">
                    <li className="flex items-start gap-2">
                      <svg className="w-3.5 h-3.5 text-green-500 mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      API Key 使用 AES-256-GCM 加密存储
                    </li>
                    <li className="flex items-start gap-2">
                      <svg className="w-3.5 h-3.5 text-green-500 mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      数据仅发送到您配置的 AI 提供商
                    </li>
                    <li className="flex items-start gap-2">
                      <svg className="w-3.5 h-3.5 text-green-500 mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      不收集、不上传任何用户数据
                    </li>
                  </ul>
                </div>
              </div>

              {/* 版本信息 */}
              <div className="mt-6 pt-4 border-t border-gray-100 text-center text-sm text-gray-400">
                <p> Select Ask · Built with React + TypeScript + Vite · Manifest V3</p>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl border border-gray-200 max-h-[90vh] overflow-y-auto scroll-smooth overscroll-contain">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-gray-900">
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

            {/* 选择供应商 — 3 分类布局，与关于页面一致 */}
            {!editingModel && (
              <div className="px-6 py-4 border-b border-gray-200">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  选择供应商
                  <span className="ml-1 text-xs text-gray-400 font-normal">（自动填充地址和默认模型）</span>
                </label>
                {/* 主流模型 */}
                <div className="mb-3">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">主流模型</p>
                  <div className="flex flex-wrap gap-2">
                    {([
                      { label: 'OpenAI', provider: 'openai' as ProviderType },
                      { label: 'Anthropic', provider: 'anthropic' as ProviderType },
                      { label: 'DeepSeek', provider: 'deepseek' as ProviderType },
                      { label: '通义千问', provider: 'qwen' as ProviderType },
                      { label: '智谱 AI', provider: 'glm' as ProviderType },
                    ]).map(({ label, provider }) => {
                      const isSelected = formData.provider === provider;
                      const defaults = PROVIDER_DEFAULTS[provider];
                      return (
                        <button
                          key={provider}
                          type="button"
                          onClick={() => {
                            setAvailableModels([]);
                            setFormData({
                              ...DEFAULT_FORM_DATA,
                              id: `custom-${Date.now()}`,
                              provider,
                              baseUrl: defaults.baseUrl,
                              modelId: defaults.modelId,
                            });
                          }}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-all whitespace-nowrap ${
                            isSelected
                              ? 'border-blue-400 bg-blue-50 text-blue-700 shadow-sm'
                              : 'border-gray-200 text-gray-600 hover:border-blue-300 hover:bg-blue-50/50'
                          }`}
                        >
                          {getProviderIcon(provider)}
                          <span>{label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                {/* OpenAI 兼容 */}
                <div className="mb-3">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">OpenAI 兼容</p>
                  <div className="flex flex-wrap gap-2">
                    {([
                      { label: 'Moonshot · Kimi', provider: 'openai-compat' as ProviderType, baseUrl: 'https://api.moonshot.cn/v1', modelId: 'moonshot-v1-8k' },
                      { label: '字节豆包', provider: 'openai-compat' as ProviderType, baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', modelId: '' },
                      { label: '百度文心', provider: 'openai-compat' as ProviderType, baseUrl: 'https://qianfan.baidubce.com/v2', modelId: '' },
                      { label: 'MiniMax', provider: 'openai-compat' as ProviderType, baseUrl: 'https://api.minimax.chat/v1', modelId: '' },
                      { label: '硅基流动', provider: 'openai-compat' as ProviderType, baseUrl: 'https://api.siliconflow.cn/v1', modelId: '' },
                      { label: 'Google Gemini', provider: 'openai-compat' as ProviderType, baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', modelId: 'gemini-2.0-flash' },
                      { label: 'Groq', provider: 'openai-compat' as ProviderType, baseUrl: 'https://api.groq.com/openai/v1', modelId: 'llama-3.1-70b-versatile' },
                      { label: 'Mistral AI', provider: 'openai-compat' as ProviderType, baseUrl: 'https://api.mistral.ai/v1', modelId: 'mistral-large-latest' },
                    ]).map(({ label, provider, baseUrl, modelId }) => {
                      const isSelected = formData.provider === provider && formData.baseUrl === baseUrl;
                      return (
                        <button
                          key={label}
                          type="button"
                          onClick={() => {
                            setAvailableModels([]);
                            setFormData({
                              ...DEFAULT_FORM_DATA,
                              id: `custom-${Date.now()}`,
                              provider,
                              baseUrl,
                              modelId,
                            });
                          }}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-all whitespace-nowrap ${
                            isSelected
                              ? 'border-blue-400 bg-blue-50 text-blue-700 shadow-sm'
                              : 'border-gray-200 text-gray-600 hover:border-blue-300 hover:bg-blue-50/50'
                          }`}
                        >
                          {getProviderIcon('openai-compat')}
                          <span>{label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                {/* 本地部署 */}
                <div>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">本地部署</p>
                  <div className="flex flex-wrap gap-2">
                    {([
                      { label: 'Ollama 本地', provider: 'local-ollama' as ProviderType },
                      { label: 'LM Studio', provider: 'local-lm-studio' as ProviderType },
                    ]).map(({ label, provider }) => {
                      const isSelected = formData.provider === provider;
                      const defaults = PROVIDER_DEFAULTS[provider];
                      return (
                        <button
                          key={provider}
                          type="button"
                          onClick={() => {
                            setAvailableModels([]);
                            setFormData({
                              ...DEFAULT_FORM_DATA,
                              id: `custom-${Date.now()}`,
                              provider,
                              baseUrl: defaults.baseUrl,
                              modelId: defaults.modelId,
                            });
                          }}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-all whitespace-nowrap ${
                            isSelected
                              ? 'border-blue-400 bg-blue-50 text-blue-700 shadow-sm'
                              : 'border-gray-200 text-gray-600 hover:border-blue-300 hover:bg-blue-50/50'
                          }`}
                        >
                          {getProviderIcon(provider)}
                          <span>{label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Form */}
            <div className="px-6 py-5 space-y-5">
              {/* API 地址 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  API 地址
                </label>
                <input
                  type="text"
                  value={formData.baseUrl}
                  onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
                  placeholder="https://api.openai.com/v1"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                />
              </div>

              {/* API Key */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  API Key <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showApiKeyInModal ? 'text' : 'password'}
                    value={formData.apiKey}
                    onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                    placeholder="sk-..."
                    className="w-full px-4 py-2.5 pr-12 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 font-mono text-sm"
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

              {/* 模型 ID */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  模型
                </label>
                <div className="relative">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={formData.modelId}
                        onChange={(e) => {
                          setFormData({ ...formData, modelId: e.target.value });
                          setModelSearchQuery(e.target.value);
                        }}
                        onFocus={() => {
                          if (availableModels.length > 0) setShowModelDropdown(true);
                        }}
                        placeholder="gpt-4o"
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                      />
                      {/* 模型下拉列表 */}
                      {showModelDropdown && availableModels.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                          {availableModels
                            .filter(m => !modelSearchQuery || m.toLowerCase().includes(modelSearchQuery.toLowerCase()))
                            .slice(0, 50)
                            .map((model) => (
                              <button
                                key={model}
                                type="button"
                                onClick={() => {
                                  setFormData({ ...formData, modelId: model });
                                  setModelSearchQuery(model);
                                  setShowModelDropdown(false);
                                }}
                                className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 ${
                                  formData.modelId === model ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                                }`}
                              >
                                {model}
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                    {loadingModels && (
                      <div className="px-3 py-2.5 text-sm text-gray-400 border border-gray-200 rounded-lg flex items-center gap-2">
                        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>
                        获取中
                      </div>
                    )}
                  </div>
                  {availableModels.length > 0 && (
                    <p className="text-xs text-green-600 mt-1">✓ 已获取 {availableModels.length} 个可用模型，可从上方列表中选择</p>
                  )}
                  {availableModels.length === 0 && !loadingModels && formData.apiKey.length > 5 && (
                    <p className="text-xs text-gray-400 mt-1">正在自动获取模型列表...</p>
                  )}
                </div>
              </div>

              {/* Form Error */}
              {formError && (
                <div className="p-3 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200">
                  {formError}
                </div>
              )}

              {/* Test Result */}
              {testResult && (
                <div className={`p-3 rounded-lg text-sm ${testResult.success ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                  {testResult.success ? '✓ 连接成功' : `✗ ${testResult.error}`}
                </div>
              )}

              {/* Model Status Toggle */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  模型状态
                </label>
                <div className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg">
                  <button
                    onClick={() => setFormData({ ...formData, enabled: !formData.enabled })}
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      formData.enabled ? 'bg-blue-500' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform shadow-sm ${
                        formData.enabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                  <span className="text-sm text-gray-600">{formData.enabled ? '启用' : '禁用'}</span>
                  <span className="text-xs text-gray-400">禁用后模型不参与问答和翻译</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 mt-2 border-t border-gray-100">
                <button
                  onClick={handleTestConnection}
                  disabled={testing}
                  className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-200 hover:border-gray-300 rounded-lg transition-all disabled:opacity-50"
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
                  className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-200 hover:border-gray-300 rounded-lg transition-all"
                >
                  取消
                </button>
                <button
                  onClick={handleSaveModel}
                  className="px-6 py-2.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all"
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