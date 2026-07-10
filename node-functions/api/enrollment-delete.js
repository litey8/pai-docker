// 删除报名 API
// DELETE /api/enrollment-delete  body: { id }
import { deleteEnrollment, getStudentById, getCourseById, json } from '../_lib/store.js'
import { requirePermission } from '../_lib/auth.js'
import { writeAudit } from '../_lib/audit.js'

async function readBody(request) {
  try {
    return (await request.json()) || {}
  } catch {
    return {}
  }
}

export default async function onRequestDelete(context) {
  const authFail = await requirePermission(context, 'enrollments:delete')
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
    const before = result.before || null
    // 从 before 快照中提取学员名/课程名，让审计能定位到具体对象
    let studentName = before?.studentId || id
    let courseName = before?.courseId || ''
    try {
      if (before?.studentId) {
        const s = await getStudentById(before.studentId)
        if (s) studentName = s.name
      }
      if (before?.courseId) {
        const c = await getCourseById(before.courseId)
        if (c) courseName = c.name
      }
    } catch {}
    const targetName = `${studentName} ${courseName}`.trim()
    await writeAudit(context, {
      action: 'delete',
      module: 'enrollments',
      targetType: 'enrollment',
      targetId: id,
      targetName,
      summary: `删除报名「${targetName}」`,
      before,
    })
    return json({ code: 0, message: '报名已删除', data: result })
  } catch (e) {
    console.error('[enrollment-delete] 删除异常:', e?.message || String(e))
    return json({ code: 1, message: '删除失败，请稍后重试', data: null }, 500)
  }
}
