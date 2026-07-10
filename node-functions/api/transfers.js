// 结转流水查询 API
// GET /api/transfers              -> 全部结转流水（按时间倒序）
// GET /api/transfers?studentId=   -> 按学员筛选
import { getTransfers, json } from '../_lib/store.js'
import { requirePermission } from '../_lib/auth.js'

export default async function onRequestGet(context) {
  const authFail = await requirePermission(context, 'transfers:view')
  if (authFail) return authFail
  const { request } = context
  const url = new URL(request.url)
  const studentId = (url.searchParams.get('studentId') || '').trim() || undefined

  try {
    const transfers = await getTransfers({ studentId })
    return json({ code: 0, message: 'ok', data: { transfers, total: transfers.length } })
  } catch (e) {
    console.error('[transfers] 查询异常:', e?.message || String(e))
    return json({ code: 1, message: '查询失败，请稍后重试', data: null }, 500)
  }
}
