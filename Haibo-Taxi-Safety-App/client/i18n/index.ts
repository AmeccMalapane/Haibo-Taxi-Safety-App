import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";
import zu from "./locales/zu.json";
import st from "./locales/st.json";

// Supported languages — add more SA official languages over time.
// The key matches the ISO 639-1 code (en, zu, st, af, xh, etc.).
export const LANGUAGES = [
  { code: "en", label: "English", nativeLabel: "English" },
  { code: "zu", label: "isiZulu", nativeLabel: "isiZulu" },
  { code: "st", label: "Sesotho", nativeLabel: "Sesotho" },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]["code"];

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    zu: { translation: zu },
    st: { translation: st },
  },
  lng: "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
  compatibilityJSON: "v4",
});

export default i18n;
