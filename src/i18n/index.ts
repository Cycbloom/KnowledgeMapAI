import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const LANGUAGE_STORAGE_KEY = 'i18n-language';
export const DEFAULT_LANGUAGE = 'zh-CN';

const languageLoaders = {
  'zh-CN': () => import('./locales/zh-CN'),
  'en-US': () => import('./locales/en-US'),
} as const;

export type SupportedLanguage = keyof typeof languageLoaders;

const supportedLanguages = Object.keys(languageLoaders) as SupportedLanguage[];

function resolveSupportedLanguage(lng: string | null | undefined): SupportedLanguage {
  const normalized = lng?.toLowerCase();
  const exact = supportedLanguages.find(
    (supported) => supported.toLowerCase() === normalized,
  );
  if (exact) return exact;
  if (normalized?.startsWith('zh')) return 'zh-CN';
  if (normalized?.startsWith('en')) return 'en-US';
  return DEFAULT_LANGUAGE;
}

function detectInitialLanguage(): SupportedLanguage {
  if (typeof window === 'undefined') return DEFAULT_LANGUAGE;
  const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (stored) return resolveSupportedLanguage(stored);
  return resolveSupportedLanguage(window.navigator.language);
}

const initialLanguage = detectInitialLanguage();

void i18n.use(initReactI18next).init({
  lng: initialLanguage,
  fallbackLng: DEFAULT_LANGUAGE,
  partialBundledLanguages: true,
  debug: false,
  interpolation: {
    escapeValue: false,
  },
});

if (typeof document !== 'undefined') {
  document.documentElement.lang = initialLanguage;
}

const loadedLanguages = new Set<SupportedLanguage>();

export async function loadLanguageResources(
  lng: string | null | undefined,
): Promise<SupportedLanguage> {
  const target = resolveSupportedLanguage(lng);
  if (loadedLanguages.has(target)) return target;
  const bundle = await languageLoaders[target]();
  i18n.addResourceBundle(target, 'translation', bundle.default, true, true);
  loadedLanguages.add(target);
  return target;
}

export async function changeLanguage(lng: string | null | undefined): Promise<void> {
  const target = await loadLanguageResources(lng);
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, target);
  }
  if (i18n.language !== target) {
    await i18n.changeLanguage(target);
  }
}

export const i18nReady = loadLanguageResources(initialLanguage);

i18n.on('languageChanged', (lng) => {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lng;
  }
});

export default i18n;
