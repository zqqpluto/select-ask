/**
 * 配置管理器
 * 管理模型配置和应用设置
 */

import type { AppConfig, ModelConfig, DisplayMode } from '../types/config';
import { encryptApiKey, decryptApiKey } from '../services/llm/crypto';
import { getStorageSync, setStorageSync } from '../utils/storage';

const CONFIG_KEY = 'app_config';

/**
 * 默认配置
 */
const DEFAULT_CONFIG: AppConfig = {
  selectedChatModelIds: [],
  selectedQuestionModelId: null,
  models: [],
  displayMode: 'sidebar',
  preferences: {
    sendWithEnter: false,          // 默认使用Ctrl+Enter发送
    sidebarWidth: 420,             // 默认侧边栏宽度420px
    autoGenerateQuestions: true,   // 默认自动生成问题推荐
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
  return config;
}

/**
 * 保存应用配置
 */
export async function saveAppConfig(config: AppConfig): Promise<void> {
  await setStorageSync(CONFIG_KEY, config);
}

/**
 * 获取所有模型配置
 */
export async function getModelConfigs(): Promise<ModelConfig[]> {
  const config = await getAppConfig();
  return config.models;
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