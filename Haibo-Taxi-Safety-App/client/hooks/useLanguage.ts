import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LANGUAGES, LanguageCode } from "@/i18n";

const LANG_KEY = "@haibo_language";

export function useLanguage() {
  const { i18n, t } = useTranslation();

  const currentLang = (i18n.language || "en") as LanguageCode;

  const setLanguage = useCallback(
    async (code: LanguageCode) => {
      await i18n.changeLanguage(code);
      await AsyncStorage.setItem(LANG_KEY, code);
    },
    [i18n],
  );

  return { currentLang, setLanguage, languages: LANGUAGES, t };
}

export async function restoreSavedLanguage(i18n: { changeLanguage: (lng: string) => any }) {
  try {
    const saved = await AsyncStorage.getItem(LANG_KEY);
    if (saved && LANGUAGES.some((l) => l.code === saved)) {
      await i18n.changeLanguage(saved);
    }
  } catch {}
}
