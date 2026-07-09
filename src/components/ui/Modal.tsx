// 通用模态框外壳 —— 统一所有弹窗的头部/内容/底部布局与交互
// 用法：
//   <Modal title="新增学员" onClose={...} footer={<><button>取消</button><button>保存</button></>}>
//     ...表单内容...
//   </Modal>
import { useEffect, type ReactNode } from 'react'
import { cn } from '@/utils/cn'

interface ModalProps {
  title: ReactNode
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
  // 关闭时是否拦截（如未保存提示）；返回 false 阻止关闭
  beforeClose?: () => boolean
}

const SIZE: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
}

export function Modal({ title, onClose, children, footer, size = 'md', beforeClose }: ModalProps) {
  const handleClose = () => {
    if (beforeClose && !beforeClose()) return
    onClose()
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }
    document.addEventListener('keydown', handler)
    // 弹出时锁定背景滚动
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handler)
      document.body.style.overflow = prev
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      className="fixed inset-0 z-[105] flex items-center justify-center p-4 bg-black/40 animate-[fadeIn_0.1s_ease-out]"
      onClick={handleClose}
    >
      <div
        className={cn(
          'bg-white rounded-xl shadow-2xl w-full max-h-[90vh] flex flex-col animate-[fadeIn_0.15s_ease-out]',
          SIZE[size],
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
          <h3 className="font-semibold text-base text-slate-800">{title}</h3>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-600 transition-colors p-1 -mr-1"
            aria-label="关闭"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 内容区：可滚动 */}
        <div className="px-5 py-4 overflow-y-auto flex-1">{children}</div>

        {/* 底部操作 */}
        {footer && (
          <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex justify-end gap-2 flex-shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
