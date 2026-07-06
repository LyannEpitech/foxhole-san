import { useTranslation } from 'react-i18next';
import { LANGUAGES } from '../i18n';

export function LanguageToggle() {
  const { i18n } = useTranslation();
  const current = i18n.language === 'en' ? 'en' : 'fr';

  return (
    <div className="flex rounded-lg border border-slate-600 overflow-hidden text-sm">
      {LANGUAGES.map((lang) => (
        <button
          key={lang}
          type="button"
          onClick={() => void i18n.changeLanguage(lang)}
          className={
            lang === current
              ? 'px-3 py-1 bg-amber-500 text-slate-900 font-semibold'
              : 'px-3 py-1 bg-slate-800 text-slate-300 hover:bg-slate-700'
          }
        >
          {lang.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
