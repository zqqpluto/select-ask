// 设备ID和指纹生成和管理
import { generateDeviceFingerprint, isValidFingerprint } from './device-fingerprint';

const DEVICE_ID_KEY = 'device_id';
const DEVICE_FINGERPRINT_KEY = 'device_fingerprint';

/**
 * 获取设备ID
 * 如果不存在则生成新的UUID
 */
export async function getDeviceId(): Promise<string> {
  const { device_id } = await chrome.storage.sync.get(DEVICE_ID_KEY);

  if (device_id) {
    return device_id;
  }

  // 生成新的设备ID
  const newDeviceId = crypto.randomUUID();
  await chrome.storage.sync.set({ [DEVICE_ID_KEY]: newDeviceId });
  return newDeviceId;
}

/**
 * 获取设备指纹
 * 如果不存在则生成新的指纹
 */
export async function getDeviceFingerprint(): Promise<string> {
  try {
    const { device_fingerprint } = await chrome.storage.local.get(DEVICE_FINGERPRINT_KEY);

    // 如果已有有效指纹，直接返回
    if (device_fingerprint && isValidFingerprint(device_fingerprint)) {
      return device_fingerprint;
    }

    // 生成新的设备指纹
    console.log('Generating new device fingerprint...');
    const newFingerprint = await generateDeviceFingerprint();

    // 存储指纹（使用local storage，因为指纹基于硬件特征，不需要跨设备同步）
    await chrome.storage.local.set({ [DEVICE_FINGERPRINT_KEY]: newFingerprint });

    return newFingerprint;
  } catch (error) {
    console.error('Failed to get device fingerprint:', error);
    // 降级方案：返回fallback指纹
    return `fallback-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }
}

/**
 * 获取设备ID和指纹
 * 用于API请求的身份验证
 */
export async function getDeviceCredentials(): Promise<{
  deviceId: string;
  fingerprint: string;
}> {
  const [deviceId, fingerprint] = await Promise.all([
    getDeviceId(),
    getDeviceFingerprint(),
  ]);

  return { deviceId, fingerprint };
}

/**
 * 重新生成设备指纹
 * 当检测到指纹失效时调用
 */
export async function regenerateDeviceFingerprint(): Promise<string> {
  console.log('Regenerating device fingerprint...');

  // 清除旧指纹
  await chrome.storage.local.remove(DEVICE_FINGERPRINT_KEY);

  // 生成新指纹
  return await getDeviceFingerprint();
}