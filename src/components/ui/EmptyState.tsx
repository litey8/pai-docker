// 统一空状态 —— 图标 + 标题 + 描述 + 可选操作
// 用法：<EmptyState title="暂无学员" description="点击新增创建第一个学员" action={<button>新增</button>} />
import type { ReactNode } from 'react'

interface EmptyStateProps {
  title: string
  description?: string
  action?: ReactNode
  icon?: ReactNode
  className?: string
}

export function EmptyState({ title, description, action, icon, className }: EmptyStateProps) {
  return (
    <div className={`card p-10 text-center ${className || ''}`}>
      <div className="flex flex-col items-center">
        <div className="text-slate-300 mb-3">
          {icon || (
            <svg className="w-14 h-14 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
              />
            </svg>
          )}
        </div>
        <p className="text-sm text-slate-500 font-medium">{title}</p>
        {description && <p className="text-xs text-slate-400 mt-1.5 max-w-xs">{description}</p>}
        {action && <div className="mt-4">{action}</div>}
      </div>
    </div>
  )
}
