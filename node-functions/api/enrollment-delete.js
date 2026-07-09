// 删除报名 API
// DELETE /api/enrollment-delete  body: { id }
import { deleteEnrollment, json } from '../_lib/store.js'
import { requireAuth } from '../_lib/auth.js'

async function readBody(request) {
  try {
    return (await request.json()) || {}
  } catch {
    return {}
  }
}

export default async function onRequestDelete(context) {
  const authFail = await requireAuth(context)
  if (authFail) return authFail
  const { request } = context
  const body = await readBody(request)
  const { id } = body

  if (!id) {
    return json({ code: 1, message: '缺少 id', data: null }, 400)
  }

  try {
    const result = await deleteEnrollment(id)
    if (!result.deleted) {
      return json({ code: 1, message: `报名 id="${id}" 不存在`, data: null }, 404)
    }
    return json({ code: 0, message: '报名已删除', data: result })
  } catch (e) {
    console.error('[enrollment-delete] 删除异常:', e?.message || String(e))
    return json({ code: 1, message: '删除失败，请稍后重试', data: null }, 500)
  }
}
