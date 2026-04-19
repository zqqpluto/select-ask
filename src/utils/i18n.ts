/**
 * 国际化工具函数
 * 支持中英文切换，自动跟随浏览器语言
 */

import { getStorageSync, setStorageSync } from './storage';

export type SupportedLanguage = 'en' | 'zh_CN' | 'auto';

const LANGUAGE_KEY = 'user_language';

// 缓存语言设置，避免重复读取存储
let cachedLanguage: string | null = null;

/**
 * 获取浏览器语言
 */
export function getBrowserLanguage(): string {
  const lang = navigator.language || (navigator as any).userLanguage;

  // 中文变体统一使用 zh_CN
  if (lang.startsWith('zh')) {
    return 'zh_CN';
  }

  // 默认英文
  return 'en';
}

/**
 * 获取当前语言设置
 */
export async function getCurrentLanguage(): Promise<string> {
  // 如果有缓存，直接返回
  if (cachedLanguage) {
    return cachedLanguage;
  }

  try {
    // 先检查用户设置
    const userLang = await getStorageSync<string>(LANGUAGE_KEY);

    if (userLang && userLang !== 'auto') {
      cachedLanguage = userLang;
      return userLang;
    }

    // 自动跟随浏览器语言
    const browserLang = getBrowserLanguage();
    cachedLanguage = browserLang;
    return browserLang;
  } catch {
    return 'en';
  }
}

/**
 * 设置语言
 */
export async function setLanguage(lang: SupportedLanguage): Promise<void> {
  await setStorageSync(LANGUAGE_KEY, lang);
  // 更新缓存
  cachedLanguage = lang === 'auto' ? getBrowserLanguage() : lang;
}

/**
 * 获取国际化消息
 */
export function getMessage(key: string, substitutions?: string | string[]): string {
  try {
    const message = chrome.i18n.getMessage(key, substitutions);
    return message || key;
  } catch {
    // 如果 i18n 不可用（比如在开发环境），返回 key
    return key;
  }
}

/**
 * 获取所有可用的语言
 */
export function getAvailableLanguages(): Array<{ code: string; name: string }> {
  return [
    { code: 'auto', name: getMessage('settings_language_auto') },
    { code: 'en', name: 'English' },
    { code: 'zh_CN', name: '中文' },
  ];
}