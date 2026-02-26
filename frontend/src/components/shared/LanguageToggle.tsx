'use client';

import * as React from 'react';
import { Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function LanguageToggle() {
  const { i18n } = useTranslation();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const toggleLanguage = () => {
    const nextLang = i18n.language === 'en' ? 'fr' : 'en';
    i18n.changeLanguage(nextLang);
  };

  if (!mounted) {
    return <div className="w-16 h-10" />;
  }

  return (
    <button
      onClick={toggleLanguage}
      className="flex items-center gap-2 px-3 py-2 rounded-full border border-border/50 bg-background/50 backdrop-blur-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all shadow-sm"
      title="Toggle Language"
    >
      <Languages className="h-4 w-4" />
      <span className="uppercase text-xs font-semibold">{i18n.language || 'EN'}</span>
    </button>
  );
}
