/**
 * API Key 加密工具
 * 使用 Web Crypto API (AES-GCM) 加密存储
 */

const ENCRYPTION_KEY_NAME = 'llm_encryption_key';

/**
 * 获取或创建加密密钥
 */
async function getOrCreateEncryptionKey(): Promise<CryptoKey> {
  // 尝试从 storage.local 获取现有密钥
  const stored = await chrome.storage.local.get(ENCRYPTION_KEY_NAME);
  const keyData = stored[ENCRYPTION_KEY_NAME];

  if (keyData) {
    // 导入现有密钥
    const keyBuffer = Uint8Array.from(atob(keyData), c => c.charCodeAt(0));
    return crypto.subtle.importKey(
      'raw',
      keyBuffer,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  // 创建新密钥
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  // 导出并存储密钥
  const exportedKey = await crypto.subtle.exportKey('raw', key);
  const keyBase64 = btoa(String.fromCharCode(...new Uint8Array(exportedKey)));
  await chrome.storage.local.set({ [ENCRYPTION_KEY_NAME]: keyBase64 });

  return key;
}

/**
 * 加密文本
 */
export async function encryptApiKey(plainText: string): Promise<string> {
  if (!plainText) return '';

  const key = await getOrCreateEncryptionKey();
  const encoder = new TextEncoder();
  const data = encoder.encode(plainText);

  // 生成随机 IV
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // 加密
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );

  // 组合 IV + 加密数据
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);

  // 转为 Base64
  return btoa(String.fromCharCode(...combined));
}

/**
 * 解密文本
 */
export async function decryptApiKey(encryptedText: string): Promise<string> {
  if (!encryptedText) return '';

  try {
    const key = await getOrCreateEncryptionKey();

    // 从 Base64 解码
    const combined = Uint8Array.from(atob(encryptedText), c => c.charCodeAt(0));

    // 分离 IV 和加密数据
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);

    // 解密
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encrypted
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    console.error('Failed to decrypt API key:', error);
    return '';
  }
}

/**
 * 检查是否是加密的值
 * 加密后的值通常更长且是 Base64 格式
 */
export function isEncrypted(value: string): boolean {
  // 简单检查：加密后的值包含 IV (12 bytes) + encrypted data
  // Base64 编码后至少会有一定长度
  try {
    const decoded = atob(value);
    return decoded.length > 12;
  } catch {
    return false;
  }
}