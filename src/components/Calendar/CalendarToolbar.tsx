import { addDays, addMonths } from 'date-fns'
import type { ViewMode } from '@/types'
import { cn } from '@/utils/cn'
import { useTranslation } from 'react-i18next'

interface CalendarToolbarProps {
  currentDate: Date
  view: ViewMode
  onNavigate: (direction: 'prev' | 'next' | 'today') => void
  onViewChange: (view: ViewMode) => void
}

const VIEW_OPTIONS: { labelKey: string; value: ViewMode }[] = [
  { labelKey: 'calendar.monthShort', value: 'month' },
  { labelKey: 'calendar.weekShort', value: 'week' },
  { labelKey: 'calendar.dayShort', value: 'day' },
]

// 计算左右导航按钮的文案
function getNavLabels(
  view: ViewMode,
  currentDate: Date,
  t: (k: string, opt?: Record<string, unknown>) => string,
): {
  prev: string
  today: string
  next: string
} {
  if (view === 'month') {
    const prev = addMonths(currentDate, -1)
    const next = addMonths(currentDate, 1)
    return {
      prev: `${prev.getMonth() + 1}${t('calendar.monthShort')}`,
      today: t('calendar.thisMonth'),
      next: `${next.getMonth() + 1}${t('calendar.monthShort')}`,
    }
  }
  if (view === 'week') {
    return {
      prev: t('calendar.prevWeek'),
      today: t('calendar.thisWeek'),
      next: t('calendar.nextWeek'),
    }
  }
  // 日视图
  const prev = addDays(currentDate, -1)
  const next = addDays(currentDate, 1)
  return {
    prev: `${prev.getMonth() + 1}-${prev.getDate()}`,
    today: t('calendar.today'),
    next: `${next.getMonth() + 1}-${next.getDate()}`,
  }
}

export function CalendarToolbar({
  currentDate,
  view,
  onNavigate,
  onViewChange,
}: CalendarToolbarProps) {
  const { t } = useTranslation()
  const labels = getNavLabels(view, currentDate, t)
  // 月/周视图：左右按钮使用文字（显示具体月份/周）；日视图：保持紧凑文字
  const navBtnClass =
    'px-2.5 py-1 text-xs font-medium rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 transition-colors whitespace-nowrap'

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-1">
      {/* 导航按钮 */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onNavigate('prev')}
          className={navBtnClass}
          aria-label={t('calendar.prevMonth')}
        >
          {labels.prev}
        </button>
        <button onClick={() => onNavigate('today')} className="btn-primary">
          {labels.today}
        </button>
        <button
          onClick={() => onNavigate('next')}
          className={navBtnClass}
          aria-label={t('calendar.nextMonth')}
        >
          {labels.next}
        </button>
      </div>

      {/* 视图切换 */}
      <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
        {VIEW_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onViewChange(opt.value)}
            className={cn(
              'px-4 py-1.5 text-sm font-medium rounded-md transition-all',
              view === opt.value
                ? 'bg-brand-500 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100',
            )}
          >
            {t(opt.labelKey)}
          </button>
        ))}
      </div>
    </div>
  )
}
