import axios, { AxiosInstance } from 'axios';
import type {
  ModelsResponse,
  ChatRequest,
  QuestionsRequest,
  QuestionsResponse,
  UsageRequest,
  UsageResponse,
} from '../types';

// 获取API基础URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

// 创建axios实例
export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 设备ID（延迟获取）
let deviceId: string | null = null;

/**
 * 获取设备ID
 */
async function getDeviceId(): Promise<string> {
  if (deviceId) {
    return deviceId;
  }

  const { device_id } = await chrome.storage.sync.get('device_id');
  if (device_id) {
    deviceId = device_id;
    return deviceId;
  }

  // 如果没有设备ID，生成一个新的
  deviceId = crypto.randomUUID();
  await chrome.storage.sync.set({ device_id: deviceId });
  return deviceId;
}

/**
 * 获取可用模型列表
 */
export async function fetchModels(): Promise<ModelsResponse> {
  try {
    const response = await apiClient.get<ModelsResponse>('/models');
    return response.data;
  } catch (error) {
    console.error('Failed to fetch models:', error);
    throw error;
  }
}

/**
 * 上报使用统计
 */
export async function reportUsage(data: UsageRequest): Promise<UsageResponse> {
  try {
    const response = await apiClient.post<UsageResponse>('/usage', {
      ...data,
      deviceId: await getDeviceId(),
    });
    return response.data;
  } catch (error) {
    console.error('Failed to report usage:', error);
    // 统计失败不影响主流程，静默处理
    return { success: false };
  }
}

/**
 * 生成常见问题
 */
export async function generateQuestions(request: QuestionsRequest): Promise<QuestionsResponse> {
  try {
    const response = await apiClient.post<QuestionsResponse>('/questions', request);
    return response.data;
  } catch (error) {
    console.error('Failed to generate questions:', error);
    throw error;
  }
}

/**
 * 流式聊天（SSE）
 */
export async function streamChat(
  request: ChatRequest,
  onChunk: (chunk: string) => void,
  onComplete: () => void,
  onError: (error: Error) => void
): Promise<void> {
  try {
    const response = await fetch(`${API_BASE_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...request,
        deviceId: await getDeviceId(),
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error('Response body is not readable');
    }

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        onComplete();
        break;
      }

      const chunk = decoder.decode(value, { stream: true });
      onChunk(chunk);
    }
  } catch (error) {
    console.error('Stream chat error:', error);
    onError(error as Error);
  }
}

export default apiClient;