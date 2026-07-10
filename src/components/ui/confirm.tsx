// 全局确认对话框 —— 命令式调用，替代浏览器原生 confirm()
// 用法：import { confirmDialog } from '@/components/ui'
//       const ok = await confirmDialog({ title:'删除学员？', message:'该操作不可恢复', danger:true })
//       危险操作可要求输入确认文本：confirmDialog({ ..., requireText: student.name })
import { useState, useEffect, useCallback } from 'react'
import { cn } from '@/utils/cn'

interface ConfirmOptions {
  title?: string
  message?: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
  // 需输入指定文本才可确认（用于极危险操作，如删除学员）
  requireText?: string
}

interface ConfirmState extends ConfirmOptions {
  resolve: (ok: boolean) => void
}

let current: ConfirmState | null = null
let setter: ((s: ConfirmState | null) => void) | null = null

// 命令式调用，返回 Promise<boolean>：true=确认，false=取消
export function confirmDialog(opts: ConfirmOptions = {}): Promise<boolean> {
  return new Promise((resolve) => {
    current = { ...opts, resolve }
    setter?.(current)
  })
}

export function ConfirmHost() {
  const [state, setState] = useState<ConfirmState | null>(null)
  const [text, setText] = useState('')

  useEffect(() => {
    setter = setState
    return () => {
      setter = null
    }
  }, [])

  // 弹出时重置输入
  useEffect(() => {
    setText('')
  }, [state])

  const close = useCallback(
    (ok: boolean) => {
      const s = state
      setState(null)
      current = null
      s?.resolve(ok)
    },
    [state],
  )

  // ESC 取消
  useEffect(() => {
    if (!state) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [state, close])

  if (!state) return null

  const requireText = state.requireText
  const canConfirm = !requireText || text === requireText

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/40 animate-[fadeIn_0.1s_ease-out]"
      onClick={() => close(false)}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-[fadeIn_0.15s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部图标 + 标题 */}
        <div className="px-5 pt-5 pb-2 text-center">
          <div
            className={cn(
              'w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-3',
              state.danger ? 'bg-rose-50 text-rose-500' : 'bg-brand-50 text-brand-500',
            )}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d={
                  state.danger
                    ? 'M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z'
                    : 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
                }
              />
            </svg>
          </div>
          <h3 className="font-semibold text-base text-slate-800">
            {state.title || '确认'}
          </h3>
        </div>

        {/* 消息内容 */}
        {state.message && (
          <div className="px-5 pb-3 text-sm text-slate-500 text-center whitespace-pre-line">
            {state.message}
          </div>
        )}

        {/* 要求输入确认文本 */}
        {requireText && (
          <div className="px-5 pb-3">
            <p className="text-xs text-slate-500 mb-1.5 text-center">
              确认 <code className="px-1 py-0.5 bg-slate-100 rounded text-slate-700 font-mono">{requireText}</code>
            </p>
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              autoFocus
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent text-center"
            />
          </div>
        )}

        {/* 操作按钮 */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex gap-2 justify-center">
          <button
            onClick={() => close(false)}
            className="btn-ghost flex-1"
          >
            {state.cancelText || '取消'}
          </button>
          <button
            onClick={() => close(true)}
            disabled={!canConfirm}
            className={cn(
              'btn flex-1 text-white disabled:opacity-40 disabled:cursor-not-allowed',
              state.danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-brand-500 hover:bg-brand-600',
            )}
          >
            {state.confirmText || (state.danger ? '删除' : '确认')}
          </button>
        </div>
      </div>
    </div>
  )
}
