import { useEffect, useState } from 'react';
import { getAppConfig, setDisplayMode } from '../utils/config-manager';
import type { ModelConfig, DisplayMode } from '../types';
import { useI18n } from '../hooks/useI18n';

export default function App() {
  const { t } = useI18n();
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [displayMode, setDisplayModeState] = useState<DisplayMode>('floating');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const config = await getAppConfig();
      setModels(config.models);
      setDisplayModeState(config.displayMode || 'floating');
    } catch (error) {
      console.error('Failed to load config:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDisplayModeChange = async (mode: DisplayMode) => {
    await setDisplayMode(mode);
    setDisplayModeState(mode);
  };

  const openOptions = () => {
    chrome.runtime.openOptionsPage();
    window.close();
  };

  const openHistory = () => {
    // 打开配置页面的历史记录标签
    chrome.tabs.create({ url: chrome.runtime.getURL('src/options/index.html') + '?tab=history' });
    window.close();
  };

  const enabledModels = models.filter(m => m.enabled);
  const hasModels = enabledModels.length > 0;

  return (
    <div className="min-w-[320px]">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={chrome.runtime.getURL('public/icons/icon48.png')}
              alt="Select Ask"
              className="w-9 h-9 rounded-xl shadow-lg"
            />
            <div>
              <h1 className="text-lg font-semibold">{t('popup_title')}</h1>
              <p className="text-xs text-blue-100">{t('extension_description')}</p>
            </div>
          </div>
          <button
            onClick={openOptions}
            className="p-2 hover:bg-white/15 rounded-lg transition-colors"
            title={t('popup_open_settings')}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {loading ? (
          <div className="text-center py-8 text-gray-500">
            <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
            {t('loading')}
          </div>
        ) : !hasModels ? (
          <div className="text-center py-6">
            <div className="text-4xl mb-3">⚠️</div>
            <p className="text-gray-600 mb-3">{t('popup_no_model')}</p>
            <button
              onClick={openOptions}
              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:opacity-90 transition-opacity text-sm font-medium"
            >
              {t('popup_add_model')}
            </button>
          </div>
        ) : (
          <>
            {/* 显示模式设置 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('settings_display_mode')}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleDisplayModeChange('floating')}
                  className={`p-3 rounded-xl border transition-all text-center ${
                    displayMode === 'floating'
                      ? 'bg-blue-50 border-blue-300 text-blue-700'
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex justify-center mb-1.5">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    </svg>
                  </div>
                  <div className="text-sm font-medium">{t('settings_mode_popup')}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{t('popup_mode_draggable')}</div>
                </button>
                <button
                  onClick={() => handleDisplayModeChange('sidebar')}
                  className={`p-3 rounded-xl border transition-all text-center ${
                    displayMode === 'sidebar'
                      ? 'bg-blue-50 border-blue-300 text-blue-700'
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex justify-center mb-1.5">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                      <line x1="15" y1="3" x2="15" y2="21"></line>
                    </svg>
                  </div>
                  <div className="text-sm font-medium">{t('settings_mode_sidebar')}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{t('popup_mode_fixed_right')}</div>
                </button>
              </div>
            </div>

            {/* 分隔线 */}
            <div className="border-t border-gray-100 my-4"></div>

            {/* 快捷操作 */}
            <div className="space-y-2">
              <button
                onClick={openHistory}
                className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors group"
              >
                <div className="w-9 h-9 rounded-lg bg-green-100 text-green-600 flex items-center justify-center group-hover:bg-green-200 transition-colors">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                  </svg>
                </div>
                <div className="text-left flex-1">
                  <div className="text-sm font-medium text-gray-800">{t('history_title')}</div>
                  <div className="text-xs text-gray-500">{t('popup_view_history')}</div>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400 group-hover:text-gray-600 transition-colors">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </button>
            </div>
          </>
        )}

        {/* 状态栏 */}
        <div className="mt-4 pt-3 border-t border-gray-100">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">{t('popup_current_status')}</span>
            <span className="flex items-center gap-1.5 text-green-600">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
              {t('popup_enabled')}
            </span>
          </div>
          {hasModels && (
            <div className="flex items-center justify-between text-xs mt-1.5">
              <span className="text-gray-500">{t('popup_models_configured', String(enabledModels.length))}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}