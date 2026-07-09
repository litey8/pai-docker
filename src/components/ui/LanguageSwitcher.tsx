// 语言切换器：在中文 / 英文间切换
import { useTranslation } from 'react-i18next'
import { changeLanguage } from '@/i18n'

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { i18n } = useTranslation()
  // 订阅 i18n 以在语言切换时触发重渲染
  const current: 'zh' | 'en' = i18n.language === 'en' ? 'en' : 'zh'

  const toggle = () => {
    const next = current === 'zh' ? 'en' : 'zh'
    changeLanguage(next)
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={toggle}
        className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
        title={current === 'zh' ? 'Switch to English' : '切换到中文'}
      >
        {current === 'zh' ? 'EN' : '中'}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
    >
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.77 16.39 3 19.25"
        />
      </svg>
      {current === 'zh' ? 'EN' : '中文'}
    </button>
  )
}
