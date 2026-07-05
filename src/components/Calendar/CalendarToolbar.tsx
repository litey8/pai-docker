import { addDays, addMonths } from 'date-fns'
import type { ViewMode } from '@/types'
import { cn } from '@/utils/cn'

interface CalendarToolbarProps {
  currentDate: Date
  view: ViewMode
  onNavigate: (direction: 'prev' | 'next' | 'today') => void
  onViewChange: (view: ViewMode) => void
}

const VIEW_OPTIONS: { label: string; value: ViewMode }[] = [
  { label: '月', value: 'month' },
  { label: '周', value: 'week' },
  { label: '日', value: 'day' },
]

// 计算左右导航按钮的文案
// 月视图：显示上月/下月的月份（如 "6月"）；周视图：显示"上一周/下一周"；日视图：显示上一天/下一天的日期（如 "7-4"）
function getNavLabels(view: ViewMode, currentDate: Date): {
  prev: string
  today: string
  next: string
} {
  if (view === 'month') {
    const prev = addMonths(currentDate, -1)
    const next = addMonths(currentDate, 1)
    return {
      prev: `${prev.getMonth() + 1}月`,
      today: '本月',
      next: `${next.getMonth() + 1}月`,
    }
  }
  if (view === 'week') {
    return { prev: '上一周', today: '本周', next: '下一周' }
  }
  // 日视图
  const prev = addDays(currentDate, -1)
  const next = addDays(currentDate, 1)
  return {
    prev: `${prev.getMonth() + 1}-${prev.getDate()}`,
    today: '今天',
    next: `${next.getMonth() + 1}-${next.getDate()}`,
  }
}

export function CalendarToolbar({
  currentDate,
  view,
  onNavigate,
  onViewChange,
}: CalendarToolbarProps) {
  const labels = getNavLabels(view, currentDate)
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
          aria-label="上一个"
        >
          {labels.prev}
        </button>
        <button onClick={() => onNavigate('today')} className="btn-primary">
          {labels.today}
        </button>
        <button
          onClick={() => onNavigate('next')}
          className={navBtnClass}
          aria-label="下一个"
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
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}
