/**
 * 用户行为统计工具
 * 用于收集匿名使用数据，帮助了解产品使用情况
 */

// 统计服务地址（请在部署后修改为实际的 Worker URL）
// 部署方法见 analytics-service/README.md
const ANALYTICS_URL = import.meta.env.VITE_ANALYTICS_URL || '';

// 是否启用统计（用户可在设置中关闭）
let analyticsEnabled = true;

// 缓存的设备 ID
let cachedDeviceId: string | null = null;

/**
 * 统计事件类型
 */
type AnalyticsAction = 'startup' | 'feature_use' | 'error';

type FeatureName = 'explain' | 'translate' | 'ask' | 'questions' | 'follow_up';

/**
 * 获取设备 ID
 */
async function getDeviceId(): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId;

  try {
    const result = await chrome.storage.sync.get('device_id');
    cachedDeviceId = result.device_id || 'unknown';
    return cachedDeviceId;
  } catch {
    return 'unknown';
  }
}

/**
 * 获取插件版本
 */
function getVersion(): string {
  return chrome.runtime.getManifest().version;
}

/**
 * 发送统计事件
 */
async function sendEvent(
  action: AnalyticsAction,
  data?: {
    feature?: FeatureName;
    model?: string;
    error?: string;
  }
): Promise<void> {
  if (!analyticsEnabled) return;

  try {
    const deviceId = await getDeviceId();
    const version = getVersion();

    const payload = {
      action,
      version,
      deviceId,
      ...data,
      timestamp: Date.now(),
    };

    // 使用 fetch 发送，不等待响应（fire and forget）
    fetch(ANALYTICS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {
      // 静默失败，不影响用户体验
    });
  } catch {
    // 静默失败
  }
}

/**
 * 插件启动统计
 */
export async function trackStartup(): Promise<void> {
  await sendEvent('startup');
}

/**
 * 功能使用统计
 */
export async function trackFeatureUse(
  feature: FeatureName,
  model?: string
): Promise<void> {
  await sendEvent('feature_use', { feature, model });
}

/**
 * 错误统计
 */
export async function trackError(error: string): Promise<void> {
  await sendEvent('error', { error });
}

/**
 * 设置是否启用统计
 */
export async function setAnalyticsEnabled(enabled: boolean): Promise<void> {
  analyticsEnabled = enabled;
  await chrome.storage.sync.set({ analytics_enabled: enabled });
}

/**
 * 初始化统计设置
 */
export async function initAnalytics(): Promise<void> {
  try {
    const result = await chrome.storage.sync.get('analytics_enabled');
    analyticsEnabled = result.analytics_enabled !== false; // 默认启用
  } catch {
    analyticsEnabled = true;
  }
}

/**
 * 检查是否启用统计
 */
export function isAnalyticsEnabled(): boolean {
  return analyticsEnabled;
}