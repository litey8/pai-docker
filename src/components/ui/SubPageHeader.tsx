// 后台二级页面统一外壳：返回 + 面包屑 + 标题 + 计数 + 操作区
// 用法：
//   <SubPageHeader title="学员管理" onBack={...} count={students.length}>
//     <button>新增</button>
//   </SubPageHeader>
import type { ReactNode } from 'react'

interface SubPageHeaderProps {
  title: string
  onBack: () => void
  backLabel?: string
  count?: number
  countLabel?: string
  children?: ReactNode
}

export function SubPageHeader({
  title,
  onBack,
  backLabel = '返回后台',
  count,
  countLabel = '条',
  children,
}: SubPageHeaderProps) {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBack}
            className="text-slate-500 hover:text-slate-700 text-sm flex items-center gap-1 flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {backLabel}
          </button>
          <span className="text-slate-300 flex-shrink-0">/</span>
          <h1 className="text-base font-semibold text-slate-800 truncate">{title}</h1>
          {count !== undefined && (
            <span className="text-xs text-slate-400 hidden sm:block flex-shrink-0">
              共 {count} {countLabel}
            </span>
          )}
        </div>
        {children && <div className="flex items-center gap-3 flex-shrink-0">{children}</div>}
      </div>
    </header>
  )
}
