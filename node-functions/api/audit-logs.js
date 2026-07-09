// 审计日志查询 API（仅超管）
// GET /api/audit-logs?actorId=&module=&targetType=&targetId=&action=&startDate=&endDate=&page=&pageSize=
import { getAuditLogs, json } from '../_lib/store.js'
import { requirePermission } from '../_lib/auth.js'

export default async function onRequestGet(context) {
  const fail = await requirePermission(context, 'audit:view')
  if (fail) return fail
  const url = new URL(context.request.url)
  const params = {
    actorId: url.searchParams.get('actorId') || '',
    module: url.searchParams.get('module') || '',
    targetType: url.searchParams.get('targetType') || '',
    targetId: url.searchParams.get('targetId') || '',
    action: url.searchParams.get('action') || '',
    startDate: url.searchParams.get('startDate') || '',
    endDate: url.searchParams.get('endDate') || '',
    page: Number(url.searchParams.get('page') || '1') || 1,
    pageSize: Number(url.searchParams.get('pageSize') || '20') || 20,
  }
  const result = await getAuditLogs(params)
  return json({ code: 0, message: 'ok', data: result })
}
