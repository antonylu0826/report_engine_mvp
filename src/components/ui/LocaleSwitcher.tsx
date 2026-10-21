import React from 'react';
import { Globe } from 'lucide-react';
import { useCurrentLocale, LOCALE_LABELS } from '@/i18n';
import { Button } from '@/components/ui/button';

export const LocaleSwitcher: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { locale, toggleLocale } = useCurrentLocale();

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={toggleLocale}
      className={`h-8 px-2.5 text-xs space-x-1.5 font-medium border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 ${className}`}
      title={locale === 'zh-TW' ? 'Switch to English' : '切換為繁體中文'}
    >
      <Globe className="h-3.5 w-3.5 text-slate-500" />
      <span>{LOCALE_LABELS[locale]}</span>
    </Button>
  );
};
