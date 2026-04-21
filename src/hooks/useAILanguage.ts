import { useTranslation } from 'react-i18next';
import { useLearningSettingsStore } from '../store/useLearningSettingsStore';
import i18n from '../i18n';

export type AILanguageCode = 'zh-CN' | 'en-US';

interface UseAILanguageReturn {
  language: AILanguageCode;
  isEnglish: boolean;
}

export function useAILanguage(): UseAILanguageReturn {
  const aiLanguage = useLearningSettingsStore((state) => state.aiLanguage);
  const { i18n: i18nInstance } = useTranslation();

  const language: AILanguageCode = (() => {
    if (aiLanguage === 'auto') {
      const lang = i18nInstance.language || 'zh-CN';
      if (lang.startsWith('en')) return 'en-US';
      if (lang.startsWith('zh')) return 'zh-CN';
      return 'zh-CN';
    }
    return aiLanguage;
  })();

  return {
    language,
    isEnglish: language === 'en-US',
  };
}

export function getAILanguage(): AILanguageCode {
  const aiLanguage = useLearningSettingsStore.getState().aiLanguage;
  if (aiLanguage === 'auto') {
    const lang = i18n.language || 'zh-CN';
    if (lang.startsWith('en')) return 'en-US';
    if (lang.startsWith('zh')) return 'zh-CN';
    return 'zh-CN';
  }
  return aiLanguage;
}

export function isEnglishLanguage(language?: string): boolean {
  if (!language) return false;
  return language === 'en-US' || language === 'en' || language.startsWith('en');
}
