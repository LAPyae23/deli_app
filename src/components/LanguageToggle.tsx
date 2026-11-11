'use client';

import { Languages } from 'lucide-react';
import { setLang, useT } from '@/lib/i18n';

/** Switch between English and Myanmar; the button shows the other language's name. */
export default function LanguageToggle({ collapsed = false, className = '' }: { collapsed?: boolean; className?: string }) {
  const { t, lang } = useT();
  return (
    <button
      type="button"
      onClick={() => setLang(lang === 'en' ? 'my' : 'en')}
      title={collapsed ? t('lang.label') : undefined}
      aria-label={lang === 'en' ? 'Switch to Myanmar' : 'Switch to English'}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground ${
        collapsed ? 'justify-center px-0' : ''
      } ${className}`}
    >
      <Languages className="h-4 w-4 flex-shrink-0" />
      {!collapsed && <span>{t('lang.label')}</span>}
    </button>
  );
}
