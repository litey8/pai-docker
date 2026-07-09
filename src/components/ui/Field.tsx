// 表单字段外壳 —— 统一 label + 控件 + 提示 + 错误 的布局
// 用法：
//   <Field label="姓名" required hint="如：张伟">
//     <input className={inputClass} ... />
//   </Field>
import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'

interface FieldProps {
  label: string
  required?: boolean
  hint?: ReactNode
  error?: string
  // label 宽度，默认 w-20
  labelWidth?: string
  children: ReactNode
  className?: string
}

// 统一的输入框样式常量，供各表单复用
export const inputClass =
  'w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-400'

export function Field({ label, required, hint, error, labelWidth = 'w-20', children, className }: FieldProps) {
  return (
    <div className={cn('flex items-start gap-4', className)}>
      <span className={cn('text-sm text-slate-500 flex-shrink-0 pt-2', labelWidth)}>
        {required && <span className="text-rose-500 mr-0.5">*</span>}
        {label}
      </span>
      <div className="flex-1 min-w-0 space-y-1">
        {children}
        {hint && !error && <div className="text-xs text-slate-400">{hint}</div>}
        {error && <div className="text-xs text-rose-500">{error}</div>}
      </div>
    </div>
  )
}
