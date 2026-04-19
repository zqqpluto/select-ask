/**
 * 配置管理器
 * 管理模型配置和应用设置
 */

import type { AppConfig, ModelConfig, DisplayMode, TranslationConfig, TranslationMode, TranslationOverlapMode, FullPageTranslationConfig } from '../types/config';
import { DEFAULT_TRANSLATION_CONFIG, DEFAULT_FULLPAGE_TRANSLATION_CONFIG, TARGET_LANGUAGES } from '../types/config';
import { encryptApiKey, decryptApiKey } from '../services/llm/crypto';
import { getStorageSync, setStorageSync } from '../utils/storage';

const CONFIG_KEY = 'app_config';

/**
 * 默认配置
 */
const DEFAULT_CONFIG: AppConfig = {
  selectedChatModelIds: [],
  selectedQuestionModelId: null,
  selectedTranslationModelId: null,
  models: [],
  displayMode: 'sidebar',
  showFloatingIcon: true,
  preferences: {
    sendWithEnter: false,
    sidebarWidth: 420,
    autoGenerateQuestions: true,
    translation: DEFAULT_TRANSLATION_CONFIG,
  },
};

/**
 * 获取应用配置
 */
export async function getAppConfig(): Promise<AppConfig> {
  const config = await getStorageSync<AppConfig>(CONFIG_KEY);
  if (!config) {
    return { ...DEFAULT_CONFIG };
  }
  // 与默认值合并，确保新增字段有默认值（兼容旧配置）
  return { ...DEFAULT_CONFIG, ...config };
}

/**
 * 保存应用配置
 */
export async function saveAppConfig(config: AppConfig): Promise<void> {
  await setStorageSync(CONFIG_KEY, config);
}

/**
 * 获取所有模型配置（解密后的 API Key）
 */
export async function getModelConfigs(): Promise<ModelConfig[]> {
  const config = await getAppConfig();
  const decryptedModels: ModelConfig[] = [];
  for (const model of config.models) {
    const decryptedKey = await decryptApiKey(model.apiKey);
    decryptedModels.push({
      ...model,
      apiKey: decryptedKey,
    });
  }
  return decryptedModels;
}

/**
 * 获取单个模型配置（解密后的 API Key）
 */
export async function getModelConfig(modelId: string): Promise<ModelConfig | null> {
  const config = await getAppConfig();
  const model = config.models.find(m => m.id === modelId);
  if (!model) return null;

  // 解密 API Key
  const decryptedKey = await decryptApiKey(model.apiKey);
  return {
    ...model,
    apiKey: decryptedKey,
  };
}

/**
 * 添加或更新模型配置
 */
export async function saveModelConfig(model: Omit<ModelConfig, 'createdAt' | 'updatedAt'> & { createdAt?: number; updatedAt?: number; enableChat?: boolean }): Promise<ModelConfig> {
  const config = await getAppConfig();
  const now = Date.now();

  const existingIndex = config.models.findIndex(m => m.id === model.id);
  const isNewModel = existingIndex < 0;

  // 加密 API Key
  const encryptedKey = await encryptApiKey(model.apiKey);

  const newModel: ModelConfig = {
    ...model,
    apiKey: encryptedKey,
    enableChat: model.enableChat !== undefined ? model.enableChat : true, // 默认参与问答
    createdAt: model.createdAt || now,
    updatedAt: now,
  };

  if (existingIndex >= 0) {
    config.models[existingIndex] = newModel;
  } else {
    config.models.push(newModel);
  }

  // 新添加的模型且参与问答，默认选中为问答模型
  if (isNewModel && model.enabled && newModel.enableChat) {
    if (!config.selectedChatModelIds) {
      config.selectedChatModelIds = [];
    }
    if (!config.selectedChatModelIds.includes(model.id)) {
      config.selectedChatModelIds.push(model.id);
    }
  }

  await saveAppConfig(config);
  return newModel;
}

/**
 * 更新模型的参与问答状态
 */
export async function setModelEnableChat(modelId: string, enableChat: boolean): Promise<void> {
  const config = await getAppConfig();
  const modelIndex = config.models.findIndex(m => m.id === modelId);

  if (modelIndex >= 0) {
    config.models[modelIndex].enableChat = enableChat;
    config.models[modelIndex].updatedAt = Date.now();

    // 如果禁用问答，从选中列表中移除
    if (!enableChat) {
      config.selectedChatModelIds = config.selectedChatModelIds.filter(id => id !== modelId);
    } else {
      // 如果启用问答，添加到选中列表
      if (!config.selectedChatModelIds.includes(modelId)) {
        config.selectedChatModelIds.push(modelId);
      }
    }

    await saveAppConfig(config);
  }
}

/**
 * 删除模型配置
 */
export async function deleteModelConfig(modelId: string): Promise<void> {
  const config = await getAppConfig();
  config.models = config.models.filter(m => m.id !== modelId);

  // 如果删除的是当前选中的模型，从列表中移除
  config.selectedChatModelIds = config.selectedChatModelIds.filter(id => id !== modelId);
  if (config.selectedQuestionModelId === modelId) {
    config.selectedQuestionModelId = null;
  }

  await saveAppConfig(config);
}

/**
 * 设置选中的聊天模型（单个）
 * 将选中的模型移到数组首位，确保 getSelectedChatModel 返回该模型
 */
export async function setSelectedChatModel(modelId: string | null): Promise<void> {
  const config = await getAppConfig();
  if (modelId) {
    // 先从数组中移除（如果存在）
    const index = config.selectedChatModelIds.indexOf(modelId);
    if (index >= 0) {
      config.selectedChatModelIds.splice(index, 1);
    }
    // 添加到数组首位
    config.selectedChatModelIds.unshift(modelId);
  } else {
    config.selectedChatModelIds = [];
  }
  await saveAppConfig(config);
}

/**
 * 设置选中的聊天模型（多个）
 */
export async function setSelectedChatModels(modelIds: string[]): Promise<void> {
  const config = await getAppConfig();
  config.selectedChatModelIds = modelIds;
  await saveAppConfig(config);
}

/**
 * 切换聊天模型的选中状态
 */
export async function toggleChatModel(modelId: string): Promise<void> {
  const config = await getAppConfig();
  const index = config.selectedChatModelIds.indexOf(modelId);
  if (index >= 0) {
    config.selectedChatModelIds.splice(index, 1);
  } else {
    config.selectedChatModelIds.push(modelId);
  }
  await saveAppConfig(config);
}

/**
 * 设置选中的问题生成模型
 */
export async function setSelectedQuestionModel(modelId: string | null): Promise<void> {
  const config = await getAppConfig();
  config.selectedQuestionModelId = modelId;
  await saveAppConfig(config);
}

/**
 * 获取选中的聊天模型配置（解密后，返回第一个）
 * 如果没有选中任何模型，返回第一个启用的模型
 */
export async function getSelectedChatModel(): Promise<ModelConfig | null> {
  const config = await getAppConfig();
  const enabledModels = config.models.filter(m => m.enabled);

  if (config.selectedChatModelIds && config.selectedChatModelIds.length > 0) {
    // 返回第一个选中的模型
    const model = await getModelConfig(config.selectedChatModelIds[0]);
    if (model) return model;
  }

  // 如果没有选中任何模型，返回第一个启用的模型
  if (enabledModels.length > 0) {
    return getModelConfig(enabledModels[0].id);
  }

  return null;
}

/**
 * 获取所有选中的聊天模型配置（解密后）
 * 如果没有选中任何模型，返回所有启用的模型
 */
export async function getSelectedChatModels(): Promise<ModelConfig[]> {
  const config = await getAppConfig();
  const enabledModels = config.models.filter(m => m.enabled);

  if (!config.selectedChatModelIds || config.selectedChatModelIds.length === 0) {
    // 返回所有启用的模型
    const models: ModelConfig[] = [];
    for (const model of enabledModels) {
      const decryptedModel = await getModelConfig(model.id);
      if (decryptedModel) models.push(decryptedModel);
    }
    return models;
  }

  const models: ModelConfig[] = [];
  for (const id of config.selectedChatModelIds) {
    const model = await getModelConfig(id);
    if (model) models.push(model);
  }
  return models;
}

/**
 * 获取选中的问题生成模型配置（解密后）
 */
export async function getSelectedQuestionModel(): Promise<ModelConfig | null> {
  const config = await getAppConfig();
  if (!config.selectedQuestionModelId) return null;
  return getModelConfig(config.selectedQuestionModelId);
}

/**
 * 设置翻译模型
 */
export async function setSelectedTranslationModel(modelId: string | null): Promise<void> {
  const config = await getAppConfig();
  config.selectedTranslationModelId = modelId;
  await saveAppConfig(config);
}

/**
 * 获取翻译模型配置（解密后）
 * 如果未单独设置，返回问答模型（向后兼容）
 */
export async function getSelectedTranslationModel(): Promise<ModelConfig | null> {
  const config = await getAppConfig();
  const modelId = config.selectedTranslationModelId;
  if (modelId) {
    return getModelConfig(modelId);
  }
  // 未单独设置时，使用问答模型
  return getSelectedChatModel();
}

/**
 * 测试模型连接
 */
export async function testModelConnection(model: ModelConfig): Promise<{ success: boolean; error?: string }> {
  try {
    const { getLLMProvider } = await import('../services/llm');
    const provider = getLLMProvider(model.provider, {
      apiKey: model.apiKey,
      baseUrl: model.baseUrl,
      modelId: model.modelId,
    });

    // 发送一个简单的测试请求
    const messages = [{ role: 'user' as const, content: 'Hi' }];
    let hasResponse = false;

    for await (const _ of provider.streamChat(messages)) {
      hasResponse = true;
      break; // 只需要确认能收到响应
    }

    return { success: hasResponse };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
}

/**
 * 设置显示模式
 */
export async function setDisplayMode(mode: DisplayMode): Promise<void> {
  const config = await getAppConfig();
  config.displayMode = mode;
  await saveAppConfig(config);
}

/**
 * 获取显示模式
 */
export async function getDisplayMode(): Promise<DisplayMode> {
  const config = await getAppConfig();
  return config.displayMode || 'sidebar';
}

// ============= 翻译配置相关函数 =============

/**
 * 获取翻译配置
 */
export async function getTranslationConfig(): Promise<TranslationConfig> {
  const config = await getAppConfig();
  return config.preferences.translation || DEFAULT_TRANSLATION_CONFIG;
}

/**
 * 保存翻译配置
 */
export async function saveTranslationConfig(translation: TranslationConfig): Promise<void> {
  const config = await getAppConfig();
  config.preferences.translation = translation;
  await saveAppConfig(config);
}

/**
 * 获取翻译显示模式
 */
export async function getTranslationMode(): Promise<TranslationMode> {
  const translationConfig = await getTranslationConfig();
  return translationConfig.mode || 'inline';
}

/**
 * 设置翻译显示模式
 */
export async function setTranslationMode(mode: TranslationMode): Promise<void> {
  const translationConfig = await getTranslationConfig();
  translationConfig.mode = mode;
  await saveTranslationConfig(translationConfig);
}

/**
 * 获取翻译重叠模式
 */
export async function getTranslationOverlapMode(): Promise<TranslationOverlapMode> {
  const translationConfig = await getTranslationConfig();
  return translationConfig.overlapMode || 'replace';
}

/**
 * 设置翻译重叠模式
 */
export async function setTranslationOverlapMode(mode: TranslationOverlapMode): Promise<void> {
  const translationConfig = await getTranslationConfig();
  translationConfig.overlapMode = mode;
  await saveTranslationConfig(translationConfig);
}

// ============= 目标语言相关函数 =============

/**
 * 检测文本的主要语言
 * 基于字符 Unicode 范围进行启发式判断
 */
export function detectLanguage(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return 'en';

  let chineseCount = 0;
  let japaneseKanaCount = 0;
  let koreanCount = 0;
  let latinCount = 0;
  let totalCount = 0;

  for (let i = 0; i < trimmed.length; i++) {
    const code = trimmed.charCodeAt(i);
    // 跳过空白和标点
    if (code <= 0x7f && !/[a-zA-Z]/.test(trimmed[i])) continue;

    totalCount++;
    // 中日韩统一表意文字
    if ((code >= 0x4e00 && code <= 0x9fff) || (code >= 0x3400 && code <= 0x4dbf)) {
      chineseCount++;
    }
    // 日文平假名 + 片假名
    if ((code >= 0x3040 && code <= 0x309f) || (code >= 0x30a0 && code <= 0x30ff)) {
      japaneseKanaCount++;
    }
    // 韩文音节
    if (code >= 0xac00 && code <= 0xd7af) {
      koreanCount++;
    }
    // 拉丁字母
    if (/[a-zA-Z]/.test(trimmed[i])) {
      latinCount++;
    }
  }

  if (totalCount === 0) return 'en';

  // 取占比最高的语言
  const ratios = {
    'zh-CN': chineseCount / totalCount,
    'ja': japaneseKanaCount / totalCount,
    'ko': koreanCount / totalCount,
    'en': latinCount / totalCount,
  };

  let best = 'en';
  let bestRatio = 0;
  for (const [lang, ratio] of Object.entries(ratios)) {
    if (ratio > bestRatio) {
      bestRatio = ratio;
      best = lang;
    }
  }
  return best;
}

/**
 * 获取当前浏览器语言代码
 */
function getBrowserLanguageCode(): string {
  const lang = navigator.language;
  // 尝试精确匹配
  const exact = TARGET_LANGUAGES.find(l => l.code === lang);
  if (exact) return exact.code;
  // 尝试前缀匹配（如 zh-CN -> zh-CN, en-US -> en）
  const prefix = lang.split('-')[0];
  const prefixMatch = TARGET_LANGUAGES.find(l => l.code.startsWith(prefix));
  if (prefixMatch) return prefixMatch.code;
  // 默认英语
  return 'en';
}

/**
 * 获取翻译目标语言
 *
 * 智能目标语言策略：
 * - 未传入 sourceText 时：返回用户手动设置的目标语言，或跟随浏览器语言
 * - 传入 sourceText 时：检测文本语言
 *   - 文本语言 != 系统语言 → 翻译成系统语言
 *   - 文本语言 == 系统语言 → 翻译成 fallbackLanguage（默认英文，可在设置中调整）
 */
export async function getTargetLanguage(sourceText?: string): Promise<string> {
  const config = await getAppConfig();
  const stored = (config.preferences as any).targetLanguage;

  // 用户手动设置了目标语言且不是 auto → 直接返回
  if (stored && stored !== 'auto') return stored;

  const systemLang = getBrowserLanguageCode();

  if (!sourceText) {
    return systemLang;
  }

  const sourceLang = detectLanguage(sourceText);

  // 文本语言与系统语言不同 → 翻译成系统语言
  if (sourceLang !== systemLang) {
    return systemLang;
  }

  // 文本语言 == 系统语言 → 翻译成 fallback 语言（默认英文）
  const fallback = (config.preferences as any).fallbackLanguage || 'en';
  return fallback;
}

/**
 * 设置翻译目标语言（手动选择时保存）
 */
export async function setTargetLanguage(lang: string): Promise<void> {
  const config = await getAppConfig();
  (config.preferences as any).targetLanguage = lang;
  await saveAppConfig(config);
}

/**
 * 设置翻译 fallback 语言（当选中文字与系统语言相同时的翻译目标）
 */
export async function setFallbackLanguage(lang: string): Promise<void> {
  const config = await getAppConfig();
  (config.preferences as any).fallbackLanguage = lang;
  await saveAppConfig(config);
}

/**
 * 获取翻译 fallback 语言
 */
export async function getFallbackLanguage(): Promise<string> {
  const config = await getAppConfig();
  return (config.preferences as any).fallbackLanguage || 'en';
}

// ============= 全文翻译配置相关函数 =============

/**
 * 获取全文翻译配置
 */
export async function getFullPageTranslationConfig(): Promise<FullPageTranslationConfig> {
  const config = await getAppConfig();
  const stored = (config.preferences as any).fullPageTranslation;
  if (!stored) return { ...DEFAULT_FULLPAGE_TRANSLATION_CONFIG };
  return {
    ...DEFAULT_FULLPAGE_TRANSLATION_CONFIG,
    ...stored,
  };
}

/**
 * 保存全文翻译配置
 */
export async function saveFullPageTranslationConfig(fullPage: Partial<FullPageTranslationConfig>): Promise<void> {
  const config = await getAppConfig();
  const current = await getFullPageTranslationConfig();
  (config.preferences as any).fullPageTranslation = { ...current, ...fullPage };
  await saveAppConfig(config);
}
