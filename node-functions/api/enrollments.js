// 报名记录查询 API
// GET /api/enrollments              -> 全部报名记录（按报名时间升序）
// GET /api/enrollments?studentId=   -> 按学员筛选
// GET /api/enrollments?courseId=    -> 按课程筛选
// GET /api/enrollments?status=active -> 按状态筛选
import { getEnrollments, getEnrollmentSummaries, json } from '../_lib/store.js'
import { requireAuth } from '../_lib/auth.js'

export default async function onRequestGet(context) {
  const authFail = await requireAuth(context)
  if (authFail) return authFail
  const { request } = context
  const url = new URL(request.url)
  const studentId = (url.searchParams.get('studentId') || '').trim() || undefined
  const courseId = (url.searchParams.get('courseId') || '').trim() || undefined
  const status = (url.searchParams.get('status') || '').trim() || undefined

  try {
    const enrollments = await getEnrollments({ studentId, courseId, status })
    return json({ code: 0, message: 'ok', data: { enrollments, total: enrollments.length } })
  } catch (e) {
    console.error('[enrollments] 查询异常:', e?.message || String(e))
    return json({ code: 1, message: '查询失败，请稍后重试', data: null }, 500)
  }
}
