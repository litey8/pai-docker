// 统一按钮组件 —— 支持 loading 状态与变体
// 用法：
//   <Button variant="primary" loading={saving} onClick={...}>保存</Button>
//   <Button variant="danger">删除</Button>
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/utils/cn'
import { Spinner } from './Loading'

type Variant = 'primary' | 'ghost' | 'danger' | 'outline'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  loading?: boolean
  children: ReactNode
}

const VARIANT: Record<Variant, string> = {
  primary: 'bg-brand-500 text-white hover:bg-brand-600',
  ghost: 'text-slate-600 hover:bg-slate-100',
  danger: 'bg-rose-600 text-white hover:bg-rose-700',
  outline: 'text-slate-600 border border-slate-200 hover:bg-slate-50',
}

export function Button({ variant = 'primary', loading, children, className, disabled, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cn(
        'btn',
        VARIANT[variant],
        'disabled:opacity-50 disabled:cursor-not-allowed',
        className,
      )}
    >
      {loading && <Spinner className="w-3.5 h-3.5 mr-1.5" />}
      {children}
    </button>
  )
}
