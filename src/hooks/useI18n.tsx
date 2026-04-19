/**
 * React Hook for internationalization
 */

import { useState, useEffect, useCallback } from 'react';
import { getMessage as getMessageUtil, getCurrentLanguage, setLanguage as setLanguageUtil, SupportedLanguage } from '../utils/i18n';

/**
 * Hook for using i18n in React components
 */
export function useI18n() {
  const [currentLang, setCurrentLang] = useState<string>('en');

  useEffect(() => {
    getCurrentLanguage().then(setCurrentLang);
  }, []);

  const changeLanguage = useCallback(async (lang: SupportedLanguage) => {
    await setLanguageUtil(lang);
    // 刷新页面以应用新语言
    window.location.reload();
  }, []);

  return {
    t: getMessageUtil, // 简化的翻译函数
    currentLang,
    changeLanguage,
  };
}