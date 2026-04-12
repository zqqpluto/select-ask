import { useEffect, useState } from 'react';
import { getAppConfig, getSelectedChatModel } from '../utils/config-manager';
import type { ModelConfig } from '../types';
import { useI18n } from '../hooks/useI18n';

export default function App() {
  const { t } = useI18n();
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [floatingIconEnabled, setFloatingIconEnabled] = useState(true);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const config = await getAppConfig();
      setModels(config.models);
      setFloatingIconEnabled(config.showFloatingIcon ?? true);
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

  const enabledModels = models.filter(m => m.enabled);
  const hasModels = enabledModels.length > 0;
  const chatModel = enabledModels.find(m => m.id === (models as any).selectedChatModel);

  const handleFloatingIconToggle = async (checked: boolean) => {
    try {
      const config = await getAppConfig();
      config.showFloatingIcon = checked;
      await chrome.storage.sync.set({ appConfig: config });
      setFloatingIconEnabled(checked);

      // 立即通知当前 tab 的 content script 更新悬浮图标
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'floatingIconToggle' });
        }
      });
    } catch (error) {
      console.error('Failed to update floating icon setting:', error);
    }
  };

  return (
    <div className="min-w-[340px]">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center shadow-lg">
              <img
                src={chrome.runtime.getURL('public/icons/icon48.png')}
                alt="Select Ask"
                className="w-7 h-7"
              />
            </div>
            <div>
              <h1 className="text-base font-semibold">Select Ask</h1>
              <p className="text-xs text-indigo-200">选中即问，知识自来</p>
            </div>
          </div>
          <button
            onClick={openOptions}
            className="p-2 hover:bg-white/15 rounded-lg transition-colors"
            title="设置"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
            <div className="animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-2"></div>
            加载中...
          </div>
        ) : (
          <>
            {/* 快捷操作 */}
            <div className="space-y-2 mb-4">
              {/* 翻译全文 */}
              <button
                onClick={() => {
                  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    if (tabs[0]?.id) {
                      chrome.tabs.sendMessage(tabs[0].id, { action: 'toggleFullPageTranslate' });
                      window.close();
                    }
                  });
                }}
                className="w-full flex items-center gap-3 px-4 py-3 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors group"
              >
                <div className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-200 transition-colors">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="m5 8 6 6"></path>
                    <path d="m4 14 6-6 2-3"></path>
                    <path d="M2 5h12"></path>
                    <path d="M7 2h1"></path>
                    <path d="m22 22-5-10-5 10"></path>
                    <path d="M14 18h6"></path>
                  </svg>
                </div>
                <div className="text-left flex-1">
                  <div className="text-sm font-medium text-gray-800">翻译全文</div>
                  <div className="text-xs text-gray-500">将当前页面翻译成目标语言</div>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400 group-hover:text-gray-600 transition-colors">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </button>

              {/* 总结页面 */}
              <button
                onClick={() => {
                  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    if (tabs[0]?.id) {
                      chrome.tabs.sendMessage(tabs[0].id, { action: 'startPageSummarize' });
                      window.close();
                    }
                  });
                }}
                className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors group"
              >
                <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center group-hover:bg-amber-200 transition-colors">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <path d="M14 2v6h6"></path>
                    <path d="M16 13H8"></path>
                    <path d="M16 17H8"></path>
                    <path d="M10 9H8"></path>
                  </svg>
                </div>
                <div className="text-left flex-1">
                  <div className="text-sm font-medium text-gray-800">总结页面</div>
                  <div className="text-xs text-gray-500">AI 智能总结当前页面内容</div>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400 group-hover:text-gray-600 transition-colors">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </button>

              {/* 历史记录 */}
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
                  <div className="text-sm font-medium text-gray-800">历史记录</div>
                  <div className="text-xs text-gray-500">查看历史对话</div>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400 group-hover:text-gray-600 transition-colors">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </button>
            </div>

            {/* 分隔线 */}
            <div className="border-t border-gray-100 my-4"></div>

            {/* 设置项 */}
            <div className="space-y-3">
              {/* 悬浮图标开关 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"></circle>
                      <path d="M12 16v-4"></path>
                      <path d="M12 8h.01"></path>
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-800">悬浮图标</div>
                    <div className="text-xs text-gray-500">页面右下角的快捷入口</div>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={floatingIconEnabled}
                    onChange={(e) => handleFloatingIconToggle(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>
            </div>

            {/* 当前模型 */}
            {hasModels && chatModel && (
              <>
                <div className="border-t border-gray-100 my-4"></div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                  <span>当前模型: <span className="text-gray-700 font-medium">{chatModel.name}</span></span>
                </div>
              </>
            )}
          </>
        )}

        {/* 状态栏 */}
        <div className="mt-4 pt-3 border-t border-gray-100">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">状态</span>
            <span className="flex items-center gap-1.5 text-green-600">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
              已启用
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}