import i18next from "i18next"
import { initReactI18next } from "react-i18next"

import en from "./locales/en.json"
import zhCN from "./locales/zh-CN.json"

export type AppLanguage = "zh-CN" | "en"

export const APP_LANGUAGE_STORAGE_KEY = "app-language"

const resources = {
  "zh-CN": { translation: zhCN },
  en: { translation: en },
}

// 检测链:localStorage("app-language") → navigator.language(zh* → zh-CN,否则 en)→ fallbackLng zh-CN
function detectAppLanguage(): AppLanguage {
  const stored = localStorage.getItem(APP_LANGUAGE_STORAGE_KEY)
  if (stored === "zh-CN" || stored === "en") {
    return stored
  }
  const browserLanguage = navigator.language.toLowerCase()
  return browserLanguage.startsWith("zh") ? "zh-CN" : "en"
}

// 持久化 + <html lang> 同步 + 切换当前语言
export function setAppLanguage(language: AppLanguage) {
  localStorage.setItem(APP_LANGUAGE_STORAGE_KEY, language)
  document.documentElement.lang = language
  return i18next.changeLanguage(language)
}

void i18next.use(initReactI18next).init({
  resources,
  lng: detectAppLanguage(),
  fallbackLng: "zh-CN",
  interpolation: { escapeValue: false },
})

document.documentElement.lang = i18next.language
