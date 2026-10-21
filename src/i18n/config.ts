export const locales = ['zh-TW', 'en'] as const;
export type AppLocale = (typeof locales)[number];
export const defaultLocale: AppLocale = 'zh-TW';

export const LOCALE_LABELS: Record<AppLocale, string> = {
  'zh-TW': '繁體中文',
  en: 'English',
};
