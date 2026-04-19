import { useEffect, useState, useRef } from 'react';
import {
  getAppConfig,
  saveAppConfig,
  saveModelConfig,
  deleteModelConfig,
  testModelConnection,
  getModelConfigs,
  getSelectedChatModel,
  getDisplayMode,
  getSelectedTranslationModel,
  setSelectedTranslationModel,
  getTranslationConfig,
  saveTranslationConfig,
  getFullPageTranslationConfig,
  saveFullPageTranslationConfig,
  getFallbackLanguage,
  setFallbackLanguage,
} from '../utils/config-manager';
import { DEFAULT_TRANSLATION_CONFIG, DEFAULT_FULLPAGE_TRANSLATION_CONFIG } from '../types/config';
import { getHistory } from '../utils/history-manager';
import type { ModelConfig, ProviderType, TranslationConfig, FullPageTranslationConfig } from '../types';
import type { HistorySession } from '../types/history';

// Extracted components
import ModelList from './components/ModelList';
import ModelFormModal from './components/ModelFormModal';
import TranslationSettings from './components/TranslationSettings';
import HistoryViewer from './components/HistoryViewer';

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
  const [_displayMode, setDisplayModeState] = useState<'floating' | 'sidebar'>('floating');
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
  const settingsContentRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const [showApiKeyInModal, setShowApiKeyInModal] = useState(false);
  // 历史对话相关状态
  const [currentChatModel, setCurrentChatModel] = useState<ModelConfig | null>(null);
  const [selectedTranslationModelId, setSelectedTranslationModelIdState] = useState<string | null>(null);
  // 模型列表获取相关状态
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [modelSearchQuery, setModelSearchQuery] = useState('');
  const [formError, setFormError] = useState<string>('');
  const autoFetchedApiKeyRef = useRef<string>('');

  // 自动获取模型：用户输入 API Key 后延迟触发
  useEffect(() => {
    if (!showModal) return;
    const apiKey = formData.apiKey.trim();
    if (!apiKey || apiKey.length < 5) return;
    if (apiKey === autoFetchedApiKeyRef.current) return;

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
        // 静默失败
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [showModal, formData.apiKey, formData.provider, formData.baseUrl]);

  // 点击外部关闭模型下拉
  useEffect(() => {
    if (!showModelDropdown) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.model-dropdown-wrapper')) {
        setShowModelDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showModelDropdown]);

  useEffect(() => {
    loadConfig();
    loadHistory();

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'sync' && changes.app_config) {
        const newConfig = changes.app_config.newValue;
        if (newConfig && newConfig.showFloatingIcon !== undefined) {
          setShowFloatingIcon(newConfig.showFloatingIcon);
        }
      }
    });
  }, []);

  // Check URL parameters to switch to history tab
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab === 'history') {
      setActiveTab('history');
    }
  }, []);

  // 设置页面滚动监听
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
    if (sessions.length > 0 && !selectedSessionId) {
      setSelectedSessionId(sessions[0].id);
    }
  };

  const loadConfig = async () => {
    const config = await getAppConfig();
    const models = await getModelConfigs();
    setModels(models);

    if (config.preferences) {
      setPreferences({
        ...config.preferences,
        translation: config.preferences.translation || DEFAULT_TRANSLATION_CONFIG,
      });
    }

    const fbLang = await getFallbackLanguage();
    setFallbackLang(fbLang);

    setShowFloatingIcon(config.showFloatingIcon ?? true);
    const dm = await getDisplayMode();
    setDisplayModeState(dm);

    const tc = await getTranslationConfig();
    setTranslationConfig(tc);

    const fc = await getFullPageTranslationConfig();
    setFullPageConfig(fc);

    const currentModel = await getSelectedChatModel();
    setCurrentChatModel(currentModel);

    const translationModel = await getSelectedTranslationModel();
    setSelectedTranslationModelIdState(translationModel?.id || null);
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

    const newModels = [...models];
    const [movedModel] = newModels.splice(fromIndex, 1);
    newModels.splice(toIndex, 0, movedModel);

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

  const providerNames: Record<ProviderType, string> = {
    'openai': 'OpenAI', 'anthropic': 'Anthropic', 'deepseek': 'DeepSeek',
    'qwen': 'Qwen', 'glm': 'GLM', 'openai-compat': 'OpenAI Compatible',
    'local-ollama': 'Ollama', 'local-lm-studio': 'LM Studio',
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
                    <ModelList
                      models={models}
                      onEdit={handleEditModel}
                      onDelete={handleDeleteModel}
                      onToggleEnabled={handleToggleEnabled}
                      getProviderIcon={getProviderIcon}
                      onDragStart={handleModelDragStart}
                      onDragOver={handleModelDragOver}
                      onDrop={handleModelDrop}
                      onDragEnd={handleDragEnd}
                      dragOverModelId={dragOverModelId}
                    />
                  )}
                </section>

                {/* 2. 外观设置 */}
                <section ref={(el) => { sectionRefs.current['appearance'] = el; }} className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                  <div className="mb-6">
                    <h2 className="text-lg font-semibold text-gray-900">外观设置</h2>
                    <p className="text-sm text-gray-500 mt-1">控制页面中选中文本后的浮动菜单入口</p>
                  </div>

                  <div className="space-y-4">
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
                            getAppConfig().then(c => {
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

                  <TranslationSettings
                    translationConfig={translationConfig}
                    fullPageConfig={fullPageConfig}
                    selectedTranslationModelId={selectedTranslationModelId}
                    models={models}
                    fallbackLang={fallbackLang}
                    providerNames={providerNames}
                    onTranslationModeChange={async (mode) => {
                      const newConfig = { ...translationConfig, mode };
                      setTranslationConfig(newConfig);
                      await saveTranslationConfig(newConfig);
                    }}
                    onFallbackLangChange={async (lang) => {
                      setFallbackLang(lang);
                      await setFallbackLanguage(lang);
                    }}
                    onTranslationModelChange={async (modelId) => {
                      setSelectedTranslationModelIdState(modelId);
                      await setSelectedTranslationModel(modelId);
                    }}
                    onFullPageTargetLangChange={async (lang) => {
                      const newConfig = { ...fullPageConfig, targetLanguage: lang };
                      setFullPageConfig(newConfig);
                      await saveFullPageTranslationConfig(newConfig);
                    }}
                  />
                </section>

              </div>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <HistoryViewer
            historySessions={historySessions}
            selectedSessionId={selectedSessionId}
            models={models}
            currentChatModel={currentChatModel}
            onSelectSession={setSelectedSessionId}
            onSessionsRefresh={loadHistory}
          />
        )}

        {activeTab === 'about' && (
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Hero 区域 */}
            <div className="relative overflow-hidden px-8 py-8" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 40%, #312e81 70%, #4338ca 100%)' }}>
              <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
              <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-violet-400/20 rounded-full blur-[80px] translate-x-1/4 -translate-y-1/4" />
              <div className="absolute bottom-0 left-1/4 w-[300px] h-[300px] bg-indigo-400/15 rounded-full blur-[60px] translate-y-1/3" />
              <div className="relative">
                <div className="flex items-start gap-5">
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
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1.5">
                      <h2 className="text-xl font-bold text-white tracking-tight">Select Ask</h2>
                      <span className="px-2 py-0.5 bg-white/10 text-white/70 text-[10px] font-medium rounded-full border border-white/10 backdrop-blur-sm font-mono">v1.0.0</span>
                    </div>
                    <p className="text-indigo-200/70 text-sm mb-3">选中即问，知识自来 — 一款现代浏览器扩展，让 AI 触手可及</p>
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
              {/* 功能特性 */}
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

              {/* 支持的供应商 */}
              <div className="mb-6">
                <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4 text-indigo-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"/>
                  </svg>
                  AI 模型供应商
                </h3>
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

              {/* 反馈建议 */}
              <div className="mb-6">
                <div className="p-4 bg-white rounded-xl border border-gray-200 hover:border-blue-300 transition-colors shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                        </svg>
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900 text-sm">反馈建议</h4>
                        <p className="text-xs text-gray-500 mt-0.5">遇到问题或有好的建议？欢迎在 GitHub 提交 Issue</p>
                      </div>
                    </div>
                    <a
                      href="https://github.com/zqqpluto/select-ask/issues"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                    >
                      提交反馈
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M5 12h14M12 5l7 7-7 7"/>
                      </svg>
                    </a>
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

      {/* Model Form Modal */}
      {showModal && (
        <ModelFormModal
          editingModel={editingModel}
          formData={formData}
          testing={testing}
          testResult={testResult}
          formError={formError}
          availableModels={availableModels}
          loadingModels={loadingModels}
          showModelDropdown={showModelDropdown}
          modelSearchQuery={modelSearchQuery}
          showApiKey={showApiKeyInModal}
          onClose={() => {
            setShowModal(false);
            setFormData(DEFAULT_FORM_DATA);
            setEditingModel(null);
            setTestResult(null);
          }}
          onSave={handleSaveModel}
          onTestConnection={handleTestConnection}
          onFormDataChange={(updates) => setFormData(prev => ({ ...prev, ...updates }))}
          onToggleApiKey={() => setShowApiKeyInModal(!showApiKeyInModal)}
          onFetchModels={fetchAvailableModels}
          onSelectModel={(modelId) => {
            setFormData(prev => ({ ...prev, modelId, name: modelId }));
          }}
          setShowModelDropdown={setShowModelDropdown}
          setModelSearchQuery={setModelSearchQuery}
          getProviderIcon={getProviderIcon}
        />
      )}
    </div>
  );
}
