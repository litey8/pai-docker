// UI 基础组件库 —— 统一交互设计
// 在应用根挂载一次 <UIHost/> 即可启用全局 Toast / Confirm
export { toast, ToastHost } from './toast'
export { confirmDialog, ConfirmHost } from './confirm'
export { Modal } from './Modal'
export { Pagination } from './Pagination'
export { EmptyState } from './EmptyState'
export { Spinner, Loading, LoadingBlock, LoadingFullscreen, ErrorBlock } from './Loading'
export { SubPageHeader } from './SubPageHeader'
export { Field, inputClass } from './Field'
export { Button } from './Button'

import { ToastHost } from './toast'
import { ConfirmHost } from './confirm'
import { Button } from './Button'

// 全局宿主：挂载一次即可启用 toast / confirmDialog 命令式调用
export function UIHost() {
  return (
    <>
      <ToastHost />
      <ConfirmHost />
    </>
  )
}

// 统一「确认/取消」底部按钮组（配合 Modal 的 footer 使用）
export function ModalFooter({
  onCancel,
  onConfirm,
  cancelText = '取消',
  confirmText = '保存',
  loading = false,
  danger = false,
  confirmDisabled = false,
}: {
  onCancel: () => void
  onConfirm: () => void
  cancelText?: string
  confirmText?: string
  loading?: boolean
  danger?: boolean
  confirmDisabled?: boolean
}) {
  return (
    <>
      <Button variant="ghost" onClick={onCancel} disabled={loading}>
        {cancelText}
      </Button>
      <Button
        variant={danger ? 'danger' : 'primary'}
        onClick={onConfirm}
        loading={loading}
        disabled={confirmDisabled}
      >
        {loading ? '保存中…' : confirmText}
      </Button>
    </>
  )
}
