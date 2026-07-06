import i18n from 'i18next';
import { initReactI18next, useTranslation } from 'react-i18next';
import type { LocalizedString } from '../types/domain';
import en from './en.json';
import fr from './fr.json';

export const LANGUAGES = ['fr', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    fr: { translation: fr },
  },
  lng: 'fr',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

/** Returns a helper that picks the right language out of a LocalizedString. */
export function useLocalized(): (s: LocalizedString) => string {
  const { i18n: instance } = useTranslation();
  const lang: Language = instance.language === 'en' ? 'en' : 'fr';
  return (s) => s[lang];
}

export default i18n;
