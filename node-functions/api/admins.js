// 管理员列表 API（仅超管）
// GET /api/admins
import { getAdmins, json } from '../_lib/store.js'
import { requirePermission } from '../_lib/auth.js'

export default async function onRequestGet(context) {
  const fail = await requirePermission(context, 'admins:view')
  if (fail) return fail
  const admins = await getAdmins()
  return json({ code: 0, message: 'ok', data: { admins } })
}
