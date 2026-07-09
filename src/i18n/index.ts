// i18n 初始化配置
// 支持中文（zh）/ 英文（en），语言偏好存储于 localStorage
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { zh } from './locales/zh'
import { en } from './locales/en'

const LANG_KEY = 'app_lang'

// 读取语言偏好：localStorage > 浏览器语言 > 默认中文
function detectLang(): string {
  try {
    const saved = localStorage.getItem(LANG_KEY)
    if (saved === 'zh' || saved === 'en') return saved
  } catch {
    // 忽略
  }
  const browserLang = typeof navigator !== 'undefined' ? navigator.language : 'zh'
  return browserLang.startsWith('zh') ? 'zh' : 'en'
}

i18n.use(initReactI18next).init({
  resources: {
    zh: { translation: zh },
    en: { translation: en },
  },
  lng: detectLang(),
  fallbackLng: 'zh',
  interpolation: {
    // React 已自动转义，无需额外转义
    escapeValue: false,
  },
})

// 切换语言并持久化
export function changeLanguage(lang: 'zh' | 'en') {
  i18n.changeLanguage(lang)
  try {
    localStorage.setItem(LANG_KEY, lang)
  } catch {
    // 忽略
  }
}

export function getCurrentLang(): 'zh' | 'en' {
  return i18n.language === 'en' ? 'en' : 'zh'
}

export default i18n
