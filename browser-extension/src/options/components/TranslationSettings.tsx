import type { ModelConfig, TranslationConfig, ProviderType } from '../../types';
import { TARGET_LANGUAGES } from '../../types/config';

interface TranslationSettingsProps {
  translationConfig: TranslationConfig;
  fullPageConfig: {
    targetLanguage: string;
  };
  selectedTranslationModelId: string | null;
  models: ModelConfig[];
  fallbackLang: string;
  providerNames: Record<ProviderType, string>;
  // Handlers
  onTranslationModeChange: (mode: TranslationConfig['mode']) => void;
  onFallbackLangChange: (lang: string) => void;
  onTranslationModelChange: (modelId: string | null) => void;
  onFullPageTargetLangChange: (lang: string) => void;
}

export default function TranslationSettings({
  translationConfig,
  fullPageConfig,
  selectedTranslationModelId,
  models,
  fallbackLang,
  providerNames,
  onTranslationModeChange,
  onFallbackLangChange,
  onTranslationModelChange,
  onFullPageTargetLangChange,
}: TranslationSettingsProps) {
  return (
    <section className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
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
                onClick={() => onTranslationModeChange(option.value)}
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
            onChange={(e) => onFallbackLangChange(e.target.value)}
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
            onChange={(e) => {
              const value = e.target.value;
              const modelId = value === '__default__' ? null : value;
              onTranslationModelChange(modelId);
            }}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-700 cursor-pointer"
          >
            <option value="__default__">使用默认问答模型</option>
            {models.filter(m => m.enabled).map(model => (
              <option key={model.id} value={model.id}>{model.name}（{providerNames[model.provider]}）</option>
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
                onChange={(e) => onFullPageTargetLangChange(e.target.value)}
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
  );
}
