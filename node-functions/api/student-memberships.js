// 学员会员卡记录 API
// GET    /api/student-memberships?studentId=  -> 学员会员卡列表（含 membership_name/student_name）
// POST   /api/student-memberships  body: {studentId, membershipId, paidAmount, durationDays} -> 办卡
// DELETE /api/student-memberships?id=         -> 删除学员会员卡记录
import {
  getStudentMemberships,
  addStudentMembership,
  deleteStudentMembership,
  json,
} from '../_lib/store.js'
import { requirePermission } from '../_lib/auth.js'
import { writeAudit } from '../_lib/audit.js'

async function readBody(request) {
  try {
    return (await request.json()) || {}
  } catch {
    return {}
  }
}

// GET /api/student-memberships?studentId=
async function handleGet(context) {
  const authFail = await requirePermission(context, 'memberships:view')
  if (authFail) return authFail
  const { request } = context
  const url = new URL(request.url)
  const studentId = (url.searchParams.get('studentId') || '').trim() || undefined

  try {
    const list = await getStudentMemberships({ studentId })
    return json({ code: 0, message: 'ok', data: list })
  } catch (e) {
    console.error('[student-memberships] 查询异常:', e?.message || String(e))
    return json({ code: 1, message: '查询失败，请稍后重试', data: null }, 500)
  }
}

// POST /api/student-memberships  body: { studentId, membershipId, paidAmount, durationDays }
async function handlePost(context) {
  const authFail = await requirePermission(context, 'memberships:create')
  if (authFail) return authFail
  const { request } = context
  const sm = await readBody(request)

  if (!sm.studentId) {
    return json({ code: 1, message: '缺少 studentId', data: null }, 400)
  }
  if (!sm.membershipId) {
    return json({ code: 1, message: '缺少 membershipId', data: null }, 400)
  }

  try {
    const finalSm = {
      studentId: String(sm.studentId).trim(),
      membershipId: String(sm.membershipId).trim(),
      paidAmount: Math.max(0, Number(sm.paidAmount) || 0),
      durationDays: sm.durationDays !== undefined ? Math.max(1, Math.floor(Number(sm.durationDays) || 30)) : undefined,
      operatorId: (context.admin && context.admin.id) || '',
    }
    const result = await addStudentMembership(finalSm)
    const id = result.id

    // 查询刚创建的记录，拿到学员名/会员卡名用于审计
    let targetName = ''
    try {
      const rows = await getStudentMemberships({})
      const row = rows.find((r) => r.id === id)
      if (row) {
        targetName = `${row.studentName || ''} - ${row.membershipName || ''}`.replace(/^ - $|- $/, '').trim()
      }
    } catch {
      // 忽略查询失败，不影响主流程
    }

    await writeAudit(context, {
      action: 'create',
      module: 'memberships',
      targetType: 'student_membership',
      targetId: id,
      targetName,
      summary: `为学员办理会员卡${targetName ? '：' + targetName : ''}`,
      after: { ...finalSm, id },
    })
    return json({ code: 0, message: '办卡成功', data: { id } })
  } catch (e) {
    console.error('[student-memberships] 办卡异常:', e?.message || String(e))
    return json({ code: 1, message: '办卡失败，请稍后重试', data: null }, 500)
  }
}

// DELETE /api/student-memberships?id=
async function handleDelete(context) {
  const authFail = await requirePermission(context, 'memberships:delete')
  if (authFail) return authFail
  const { request } = context
  const url = new URL(request.url)
  const id = (url.searchParams.get('id') || '').trim()

  if (!id) {
    return json({ code: 1, message: '缺少 id', data: null }, 400)
  }

  try {
    await deleteStudentMembership(id)
    await writeAudit(context, {
      action: 'delete',
      module: 'memberships',
      targetType: 'student_membership',
      targetId: id,
      summary: `删除学员会员卡记录 ${id}`,
    })
    return json({ code: 0, message: '记录已删除', data: { ok: true } })
  } catch (e) {
    console.error('[student-memberships] 删除异常:', e?.message || String(e))
    return json({ code: 1, message: '删除失败，请稍后重试', data: null }, 500)
  }
}

export default async function onRequest(context) {
  const { request } = context
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204 })
  }
  if (request.method === 'GET') return handleGet(context)
  if (request.method === 'POST') return handlePost(context)
  if (request.method === 'DELETE') return handleDelete(context)
  return json({ code: 1, message: '不支持的请求方法', data: null }, 405)
}
