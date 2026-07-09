// 统一加载状态组件
// <Loading /> 行内小圈；<LoadingBlock /> 卡片占位；<LoadingFullscreen /> 全屏
import { cn } from '@/utils/cn'

export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn('animate-spin', className || 'w-4 h-4 text-brand-500')}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

export function Loading({ label = '加载中…' }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-slate-500">
      <Spinner />
      {label}
    </span>
  )
}

export function LoadingBlock({ label = '加载中…', className }: { label?: string; className?: string }) {
  return (
    <div className={`card p-16 flex flex-col items-center justify-center ${className || ''}`}>
      <Spinner className="w-8 h-8 mb-3" />
      <span className="text-sm text-slate-400">{label}</span>
    </div>
  )
}

export function LoadingFullscreen({ label = '初始化中…' }: { label?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-sm text-slate-500 flex items-center gap-2">
        <Spinner />
        {label}
      </div>
    </div>
  )
}

// 错误块：统一错误展示，带重试按钮
export function ErrorBlock({
  message = '加载失败',
  onRetry,
}: {
  message?: string
  onRetry?: () => void
}) {
  return (
    <div className="card p-16 flex flex-col items-center justify-center">
      <div className="text-rose-500 mb-2">
        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>
      <p className="text-sm text-rose-600 mb-1">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn-ghost text-xs mt-2 border border-slate-200">
          重试
        </button>
      )}
    </div>
  )
}
