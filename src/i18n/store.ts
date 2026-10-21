import { create } from 'zustand';
import { defaultLocale, type AppLocale, locales } from './config';

interface I18nState {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  toggleLocale: () => void;
}

const STORAGE_KEY = 'report_engine_locale';

function getInitialLocale(): AppLocale {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(STORAGE_KEY) as AppLocale | null;
    if (saved && locales.includes(saved)) {
      return saved;
    }
    // Check browser language
    const navLang = navigator.language.toLowerCase();
    if (navLang.startsWith('zh')) {
      return 'zh-TW';
    }
    if (navLang.startsWith('en')) {
      return 'en';
    }
  }
  return defaultLocale;
}

export const useI18nStore = create<I18nState>((set, get) => ({
  locale: getInitialLocale(),
  setLocale: (locale) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, locale);
    }
    set({ locale });
  },
  toggleLocale: () => {
    const current = get().locale;
    const next = current === 'zh-TW' ? 'en' : 'zh-TW';
    get().setLocale(next);
  },
}));
