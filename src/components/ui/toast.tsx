// 全局 Toast —— 命令式调用，在应用根挂载一次 <ToastHost/> 即可在任意位置使用
// 用法：import { toast } from '@/components/ui'
//       toast.success('已保存') / toast.error('失败') / toast.info('提示') / toast.warning('注意')
import { useState, useEffect, useCallback } from 'react'
import { cn } from '@/utils/cn'

type ToastType = 'success' | 'error' | 'info' | 'warning'

interface ToastItem {
  id: number
  type: ToastType
  message: string
}

let items: ToastItem[] = []
let listeners: Array<(items: ToastItem[]) => void> = []
let seq = 0

function emit() {
  for (const l of listeners) l(items)
}

function push(type: ToastType, message: string, duration = 3500) {
  const id = ++seq
  items = [...items, { id, type, message }]
  emit()
  if (duration > 0) {
    window.setTimeout(() => dismiss(id), duration)
  }
  return id
}

function dismiss(id: number) {
  items = items.filter((t) => t.id !== id)
  emit()
}

export const toast = {
  success: (msg: string, dur?: number) => push('success', msg, dur),
  error: (msg: string, dur?: number) => push('error', msg, dur),
  info: (msg: string, dur?: number) => push('info', msg, dur),
  warning: (msg: string, dur?: number) => push('warning', msg, dur),
  dismiss,
}

const ICONS: Record<ToastType, JSX.Element> = {
  success: (
    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  ),
  error: (
    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  info: (
    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  warning: (
    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" />
    </svg>
  ),
}

const BORDER: Record<ToastType, string> = {
  success: 'border-l-green-500',
  error: 'border-l-rose-500',
  info: 'border-l-brand-500',
  warning: 'border-l-amber-500',
}

const ICON_COLOR: Record<ToastType, string> = {
  success: 'text-green-500',
  error: 'text-rose-500',
  info: 'text-brand-500',
  warning: 'text-amber-500',
}

// 在应用根挂载一次：<ToastHost/>
export function ToastHost() {
  const [list, setList] = useState<ToastItem[]>(items)
  useEffect(() => {
    listeners.push(setList)
    return () => {
      listeners = listeners.filter((l) => l !== setList)
    }
  }, [])
  const handleDismiss = useCallback((id: number) => dismiss(id), [])
  if (list.length === 0) return null
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-2 pointer-events-none w-full max-w-sm px-4">
      {list.map((t) => (
        <div
          key={t.id}
          className={cn(
            'pointer-events-auto flex items-center gap-2.5 w-full px-4 py-2.5 rounded-lg shadow-lg border border-l-4 border-slate-200 bg-white text-slate-700 text-sm animate-[fadeIn_0.15s_ease-out]',
            BORDER[t.type],
          )}
        >
          <span className={ICON_COLOR[t.type]}>{ICONS[t.type]}</span>
          <span className="flex-1 break-words">{t.message}</span>
          <button
            onClick={() => handleDismiss(t.id)}
            className="text-slate-300 hover:text-slate-500 transition-colors flex-shrink-0"
            aria-label="关闭"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  )
}
