import type { ModelConfig, ProviderType } from '../../types';
import { PROVIDER_DEFAULTS } from '../../types/config';

interface ModelFormModalProps {
  editingModel: ModelConfig | null;
  formData: {
    id: string;
    name: string;
    provider: ProviderType;
    apiKey: string;
    baseUrl: string;
    modelId: string;
    enabled: boolean;
  };
  testing: boolean;
  testResult: { success: boolean; error?: string } | null;
  formError: string;
  availableModels: string[];
  loadingModels: boolean;
  showModelDropdown: boolean;
  modelSearchQuery: string;
  showApiKey: boolean;
  // Handlers
  onClose: () => void;
  onSave: () => void;
  onTestConnection: () => void;
  onFormDataChange: (updates: Partial<ModelFormModalProps['formData']>) => void;
  onToggleApiKey: () => void;
  onFetchModels: () => void;
  onSelectModel: (modelId: string) => void;
  setShowModelDropdown: (show: boolean) => void;
  setModelSearchQuery: (query: string) => void;
  // Provider icon renderer
  getProviderIcon: (provider: ProviderType, size?: 'sm' | 'md') => React.ReactNode;
}

export default function ModelFormModal({
  editingModel,
  formData,
  testing,
  testResult,
  formError,
  availableModels,
  loadingModels,
  showModelDropdown,
  modelSearchQuery,
  showApiKey,
  onClose,
  onSave,
  onTestConnection,
  onFormDataChange,
  onToggleApiKey,
  onFetchModels,
  onSelectModel,
  setShowModelDropdown,
  setModelSearchQuery,
  getProviderIcon,
}: ModelFormModalProps) {
  const isLocal = formData.provider === 'local-ollama' || formData.provider === 'local-lm-studio';

  // Provider button click: reset form to defaults for that provider
  const handleSelectPreset = (provider: ProviderType, extra?: { baseUrl?: string; modelId?: string }) => {
    const defaults = PROVIDER_DEFAULTS[provider];
    onFormDataChange({
      id: editingModel?.id || `custom-${Date.now()}`,
      name: editingModel?.name || '',
      provider,
      baseUrl: extra?.baseUrl || defaults?.baseUrl || '',
      modelId: extra?.modelId || formData.modelId,
      apiKey: formData.apiKey,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl border border-gray-200 max-h-[90vh] overflow-y-auto overscroll-contain">
        {/* Header */}
        <div className="px-5 py-3 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900">
              {editingModel ? '编辑模型' : '添加模型'}
            </h3>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Provider selection */}
        <div className="px-5 py-3 border-b border-gray-200">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            选择供应商
            <span className="ml-1 text-xs text-gray-400 font-normal">（自动填充 API 地址）</span>
          </label>

          {/* 主流模型 */}
          <div className="mb-2">
            <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">主流模型</p>
            <div className="flex flex-wrap gap-1.5">
              {([
                { label: 'OpenAI', provider: 'openai' as ProviderType },
                { label: 'Anthropic', provider: 'anthropic' as ProviderType },
                { label: 'DeepSeek', provider: 'deepseek' as ProviderType },
                { label: '通义千问', provider: 'qwen' as ProviderType },
                { label: '智谱 AI', provider: 'glm' as ProviderType },
              ]).map(({ label, provider }) => {
                const isSelected = formData.provider === provider;
                return (
                  <button
                    key={provider}
                    type="button"
                    onClick={() => {
                      setShowModelDropdown(false);
                      handleSelectPreset(provider);
                    }}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-sm transition-all whitespace-nowrap ${
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
          <div className="mb-2">
            <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">OpenAI 兼容</p>
            <div className="flex flex-wrap gap-1.5">
              {([
                { label: 'Moonshot · Kimi', baseUrl: 'https://api.moonshot.cn/v1', icon: '🌙', iconColor: 'bg-indigo-500' },
                { label: '字节豆包', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', icon: '🫘', iconColor: 'bg-red-500' },
                { label: '百度文心', baseUrl: 'https://qianfan.baidubce.com/v2', icon: '文', iconColor: 'bg-blue-600' },
                { label: 'MiniMax', baseUrl: 'https://api.minimax.chat/v1', icon: 'M', iconColor: 'bg-violet-500' },
                { label: '硅基流动', baseUrl: 'https://api.siliconflow.cn/v1', icon: 'S', iconColor: 'bg-teal-500' },
                { label: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', icon: 'G', iconColor: 'bg-green-500' },
                { label: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', icon: '⚡', iconColor: 'bg-yellow-600' },
                { label: 'Mistral AI', baseUrl: 'https://api.mistral.ai/v1', icon: '🌬', iconColor: 'bg-sky-500' },
              ]).map(({ label, baseUrl, icon, iconColor }) => {
                const isSelected = formData.provider === 'openai-compat' && formData.baseUrl === baseUrl;
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => {
                      setShowModelDropdown(false);
                      handleSelectPreset('openai-compat', { baseUrl });
                    }}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-sm transition-all whitespace-nowrap ${
                      isSelected
                        ? 'border-blue-400 bg-blue-50 text-blue-700 shadow-sm'
                        : 'border-gray-200 text-gray-600 hover:border-blue-300 hover:bg-blue-50/50'
                    }`}
                  >
                    <div className={`w-4 h-4 ${iconColor} rounded flex items-center justify-center text-white text-[9px] font-semibold`}>
                      {icon}
                    </div>
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 本地部署 */}
          <div>
            <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">本地部署</p>
            <div className="flex flex-wrap gap-1.5">
              {([
                { label: 'Ollama 本地', provider: 'local-ollama' as ProviderType },
                { label: 'LM Studio', provider: 'local-lm-studio' as ProviderType },
              ]).map(({ label, provider }) => {
                const isSelected = formData.provider === provider;
                return (
                  <button
                    key={provider}
                    type="button"
                    onClick={() => {
                      setShowModelDropdown(false);
                      handleSelectPreset(provider);
                    }}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-sm transition-all whitespace-nowrap ${
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

        {/* Form fields */}
        <div className="px-5 py-4 space-y-4">
          {/* API 地址 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">API 地址</label>
            <input
              type="text"
              value={formData.baseUrl}
              onChange={(e) => onFormDataChange({ baseUrl: e.target.value })}
              placeholder="https://api.openai.com/v1"
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
            />
          </div>

          {/* API Key */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              API Key <span className="text-red-500">*</span>
              {!isLocal && (
                <span className="ml-2 text-xs text-gray-400 font-normal">— 输入后自动获取模型列表</span>
              )}
            </label>
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={formData.apiKey}
                onChange={(e) => onFormDataChange({ apiKey: e.target.value })}
                placeholder="sk-..."
                className="w-full px-3 py-2 pr-10 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 font-mono"
              />
              <button
                type="button"
                onClick={onToggleApiKey}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showApiKey ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Model ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">模型名</label>
            <div className="relative">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={formData.modelId}
                    onChange={(e) => {
                      const val = e.target.value;
                      onFormDataChange({ modelId: val, name: val });
                      setModelSearchQuery(val);
                    }}
                    onFocus={() => {
                      if (availableModels.length > 0) setShowModelDropdown(true);
                    }}
                    placeholder={availableModels.length > 0 ? '选择或输入模型名称' : 'gpt-4o'}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
                  />
                  {/* Dropdown */}
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
                              onFormDataChange({ modelId: model });
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
                <button
                  type="button"
                  onClick={onFetchModels}
                  disabled={loadingModels || !formData.apiKey.trim()}
                  className="px-3 py-2 text-sm font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex items-center gap-1.5"
                  title="获取模型列表"
                >
                  {loadingModels ? (
                    <>
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                      获取中
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      获取模型
                    </>
                  )}
                </button>
              </div>
              {availableModels.length > 0 && (
                <p className="text-xs text-green-600 mt-1">✓ 已获取 {availableModels.length} 个可用模型，可从下拉列表选择</p>
              )}
              {availableModels.length === 0 && !loadingModels && formData.apiKey.length > 0 && (
                <p className="text-xs text-gray-400 mt-1">点击"获取模型"按钮获取可用模型列表，或手动输入模型名称</p>
              )}
            </div>
          </div>

          {/* Form Error */}
          {formError && (
            <div className="p-2.5 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200">
              {formError}
            </div>
          )}

          {/* Model Status Toggle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">模型状态</label>
            <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
              <button
                onClick={() => onFormDataChange({ enabled: !formData.enabled })}
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
          <div className="flex items-center gap-3 pt-3 mt-1 border-t border-gray-100">
            <button
              onClick={onTestConnection}
              disabled={testing}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-200 hover:border-gray-300 rounded-lg transition-all disabled:opacity-50"
            >
              {testing ? '测试中...' : '测试连接'}
            </button>
            {testResult && (
              <span className={`text-sm ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
                {testResult.success ? '✓ 连接成功' : `✗ ${testResult.error}`}
              </span>
            )}
            <div className="flex-1" />
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-200 hover:border-gray-300 rounded-lg transition-all"
            >
              取消
            </button>
            <button
              onClick={onSave}
              className="px-6 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all"
            >
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
