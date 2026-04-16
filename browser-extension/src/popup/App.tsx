import { useEffect, useState, useRef, useCallback } from 'react';
import { getAppConfig } from '../utils/config-manager';
import type { ModelConfig } from '../types';
import { useI18n } from '../hooks/useI18n';

export default function App() {
  const { t } = useI18n();
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [floatingIconEnabled, setFloatingIconEnabled] = useState(true);

  // 模型选择器状态
  const [currentModel, setCurrentModel] = useState<ModelConfig | null>(null);
  const [availableModels, setAvailableModels] = useState<ModelConfig[]>([]);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([]);

  // 多模型选择器状态
  const [showMultiModelSelector, setShowMultiModelSelector] = useState(false);
  const multiModelButtonRef = useRef<HTMLButtonElement>(null);
  const [multiModelDropdownPos, setMultiModelDropdownPos] = useState<{ top: number } | null>(null);

  // 单模型切换状态
  const modelButtonRef = useRef<HTMLButtonElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{ bottom: number; left: number } | null>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  // 点击外部关闭下拉菜单
  useEffect(() => {
    if (!showModelSelector && !showMultiModelSelector) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (showModelSelector && modelButtonRef.current && !modelButtonRef.current.contains(e.target as Node)) {
        const dropdown = document.querySelector('.popup-model-dropdown');
        if (dropdown && !dropdown.contains(e.target as Node)) {
          setShowModelSelector(false);
          setDropdownPosition(null);
        }
      }
      if (showMultiModelSelector && multiModelButtonRef.current && !multiModelButtonRef.current.contains(e.target as Node)) {
        const dropdown = document.querySelector('.popup-multi-model-dropdown');
        if (dropdown && !dropdown.contains(e.target as Node)) {
          setShowMultiModelSelector(false);
          setMultiModelDropdownPos(null);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showModelSelector, showMultiModelSelector]);

  const loadConfig = async () => {
    try {
      const config = await getAppConfig();
      setModels(config.models);
      setFloatingIconEnabled(config.showFloatingIcon ?? true);

      const selectedIds = config.selectedChatModelIds || [];
      setSelectedModelIds(selectedIds);

      const enabledModels = config.models.filter((m: ModelConfig) => m.enabled);
      let modelsToUse: ModelConfig[] = [];

      if (selectedIds.length > 0) {
        modelsToUse = selectedIds
          .map(id => enabledModels.find(m => m.id === id))
          .filter((m): m is ModelConfig => m !== undefined && m.enabled);
      } else {
        modelsToUse = enabledModels;
      }

      setAvailableModels(modelsToUse);

      const selectedId = config.selectedChatModel;
      if (selectedId) {
        const model = modelsToUse.find(m => m.id === selectedId);
        if (model) setCurrentModel(model);
        else if (modelsToUse.length > 0) setCurrentModel(modelsToUse[0]);
      } else if (modelsToUse.length > 0) {
        setCurrentModel(modelsToUse[0]);
      }
    } catch (error) {
      console.error('Failed to load config:', error);
    } finally {
      setLoading(false);
    }
  };

  const openOptions = () => {
    chrome.runtime.openOptionsPage();
    window.close();
  };

  const openHistory = () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/options/index.html') + '?tab=history' });
    window.close();
  };

  const toggleModelSelector = useCallback(() => {
    if (showModelSelector) {
      setShowModelSelector(false);
      setDropdownPosition(null);
    } else if (modelButtonRef.current) {
      const rect = modelButtonRef.current.getBoundingClientRect();
      setDropdownPosition({ bottom: rect.height + 6, left: 0 });
      setShowModelSelector(true);
    }
  }, [showModelSelector]);

  const handleModelSelect = async (modelId: string) => {
    try {
      await chrome.runtime.sendMessage({ type: 'SET_SELECTED_CHAT_MODEL', modelId });
      const config = await getAppConfig();
      const enabledModels = config.models.filter((m: ModelConfig) => m.enabled);
      const selectedIds = config.selectedChatModelIds || [];

      let modelsToUse: ModelConfig[] = [];
      if (selectedIds.length > 0) {
        modelsToUse = selectedIds
          .map(id => enabledModels.find(m => m.id === id))
          .filter((m): m is ModelConfig => m !== undefined && m.enabled);
      } else {
        modelsToUse = enabledModels;
      }

      setAvailableModels(modelsToUse);
      const model = modelsToUse.find(m => m.id === modelId);
      if (model) setCurrentModel(model);

      setShowModelSelector(false);
      setDropdownPosition(null);
    } catch (error) {
      console.error('Failed to select model:', error);
    }
  };

  const toggleModelEnabled = async (modelId: string, enabled: boolean) => {
    try {
      const config = await getAppConfig();
      let selectedIds = config.selectedChatModelIds || [];

      if (enabled) {
        if (!selectedIds.includes(modelId)) selectedIds = [...selectedIds, modelId];
      } else {
        selectedIds = selectedIds.filter(id => id !== modelId);
      }

      config.selectedChatModelIds = selectedIds;
      await chrome.storage.sync.set({ appConfig: config });
      setSelectedModelIds(selectedIds);

      const enabledModels = config.models.filter((m: ModelConfig) => m.enabled);
      let modelsToUse: ModelConfig[] = [];
      if (selectedIds.length > 0) {
        modelsToUse = selectedIds
          .map(id => enabledModels.find(m => m.id === id))
          .filter((m): m is ModelConfig => m !== undefined && m.enabled);
      } else {
        modelsToUse = enabledModels;
      }
      setAvailableModels(modelsToUse);

      if (!selectedIds.includes(currentModel?.id || '') && modelsToUse.length > 0) {
        setCurrentModel(modelsToUse[0]);
      }
    } catch (error) {
      console.error('Failed to toggle model:', error);
    }
  };

  const toggleMultiModelSelector = useCallback(() => {
    if (showMultiModelSelector) {
      setShowMultiModelSelector(false);
      setMultiModelDropdownPos(null);
    } else if (multiModelButtonRef.current) {
      const rect = multiModelButtonRef.current.getBoundingClientRect();
      setMultiModelDropdownPos({ top: rect.height + 6 });
      setShowMultiModelSelector(true);
    }
  }, [showMultiModelSelector]);

  return (
    <div className="popup-container">
      {/* Header */}
      <div className="popup-header">
        <div className="popup-header-left">
          <div className="popup-logo">
            <img src={chrome.runtime.getURL('public/icons/icon48.png')} alt="Select Ask" className="popup-logo-img" />
          </div>
          <div className="popup-header-text">
            <h1 className="popup-title">Select Ask</h1>
            <p className="popup-subtitle">选中即问，知识自来</p>
          </div>
        </div>
        <button onClick={openOptions} className="popup-settings-btn" title="设置">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
            <path d="M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/>
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="popup-content">
        {loading ? (
          <div className="popup-loading">
            <div className="popup-loading-spinner"></div>
            加载中...
          </div>
        ) : (
          <>
            {/* 模型选择器卡片 */}
            <div className="popup-model-card">
              <div className="popup-model-card-header">
                <div className="popup-model-card-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="5" r="2.5"/>
                    <circle cx="6" cy="12" r="2.5"/>
                    <circle cx="18" cy="12" r="2.5"/>
                    <circle cx="12" cy="19" r="2.5"/>
                    <path d="M12 7.5v2M7.5 12h2M14.5 12h2M12 14.5v2" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                    <path d="M7.5 13.5l3 3M13.5 7.5l3-3M16.5 13.5l-3 3M7.5 10.5l3-3" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.6"/>
                  </svg>
                </div>
                <div className="popup-model-card-text">
                  <div className="popup-model-card-title">模型选择</div>
                  <div className="popup-model-card-desc">选择要使用的 AI 模型</div>
                </div>
              </div>

              {/* 当前模型 + 切换按钮 */}
              <div className="popup-current-model">
                <div className="popup-model-selector-left">
                  <button ref={modelButtonRef} className="popup-model-btn-left" onClick={toggleModelSelector} title="切换模型">
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
                    <div className="popup-model-dropdown" style={{ bottom: dropdownPosition.bottom, left: dropdownPosition.left }}>
                      {availableModels.map(model => (
                        <button
                          key={model.id}
                          className={`popup-model-option ${currentModel?.id === model.id ? 'active' : ''}`}
                          onClick={() => handleModelSelect(model.id)}
                        >
                          {model.name}
                        </button>
                      ))}
                      {availableModels.length === 0 && (
                        <div className="popup-model-empty">请先在配置中管理模型</div>
                      )}
                    </div>
                  )}
                </div>

                {/* 多模型管理按钮 */}
                <button ref={multiModelButtonRef} className="popup-multi-model-btn" onClick={toggleMultiModelSelector} title="管理模型">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="7" rx="1"/>
                    <rect x="14" y="3" width="7" height="7" rx="1"/>
                    <rect x="3" y="14" width="7" height="7" rx="1"/>
                    <rect x="14" y="14" width="7" height="7" rx="1"/>
                  </svg>
                  <span>管理</span>
                </button>

                {showMultiModelSelector && multiModelDropdownPos && (
                  <div className="popup-multi-model-dropdown" style={{ top: multiModelDropdownPos.top }}>
                    <div className="popup-multi-model-title">勾选要启用的模型</div>
                    {models.filter(m => m.enabled).map(model => (
                      <label key={model.id} className="popup-multi-model-item">
                        <input
                          type="checkbox"
                          checked={selectedModelIds.includes(model.id)}
                          onChange={(e) => toggleModelEnabled(model.id, e.target.checked)}
                        />
                        <span className="popup-multi-model-name">{model.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 历史记录 */}
            <button onClick={openHistory} className="popup-history-btn">
              <div className="popup-history-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 8v4l3 3"/>
                  <path d="M3.05 11a9 9 0 1 1 .6 3"/>
                  <path d="M3 7v4h4"/>
                </svg>
              </div>
              <div className="popup-history-text">
                <div className="popup-history-title">历史记录</div>
                <div className="popup-history-desc">查看历史对话</div>
              </div>
              <svg className="popup-history-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>

            {/* 分隔线 */}
            <div className="popup-divider"></div>

            {/* 设置卡片 */}
            <div className="popup-settings-card">
              <div className="popup-setting-item">
                <div className="popup-setting-left">
                  <div className="popup-setting-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"></circle>
                      <path d="M12 16v-4"></path>
                      <path d="M12 8h.01"></path>
                    </svg>
                  </div>
                  <div className="popup-setting-text">
                    <div className="popup-setting-title">悬浮图标</div>
                    <div className="popup-setting-desc">页面右下角的快捷入口</div>
                  </div>
                </div>
                <label className="popup-toggle">
                  <input
                    type="checkbox"
                    checked={floatingIconEnabled}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      chrome.storage.sync.get(['app_config']).then((result) => {
                        const config = result.app_config;
                        if (config) {
                          config.showFloatingIcon = checked;
                          chrome.storage.sync.set({ appConfig: config });
                          setFloatingIconEnabled(checked);
                          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                            if (tabs[0]?.id) {
                              chrome.tabs.sendMessage(tabs[0].id, { action: 'floatingIconToggle', enabled: checked });
                            }
                          });
                        }
                      });
                    }}
                    className="sr-only peer"
                  />
                  <div className="popup-toggle-slider"></div>
                </label>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
