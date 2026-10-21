import { useI18nStore } from './store';
import { allMessages, type Messages } from './messages';
import { type AppLocale, LOCALE_LABELS } from './config';

export * from './config';
export * from './store';
export * from './messages';

/**
 * React hook to get a translation function scoped to a namespace.
 * Full TypeScript autocompletion and compile-time type-safety.
 */
export function useTranslations<K extends keyof Messages>(namespace: K) {
  const locale = useI18nStore((state) => state.locale);
  const nsMessages = allMessages[locale][namespace];

  return <Key extends keyof Messages[K]>(key: Key): string => {
    const val = (nsMessages as Record<string, unknown>)[key as string];
    return typeof val === 'string' ? val : (key as string);
  };
}

/**
 * Helper to get current locale string
 */
export function useCurrentLocale(): {
  locale: AppLocale;
  label: string;
  setLocale: (l: AppLocale) => void;
  toggleLocale: () => void;
} {
  const { locale, setLocale, toggleLocale } = useI18nStore();
  return {
    locale,
    label: LOCALE_LABELS[locale],
    setLocale,
    toggleLocale,
  };
}
