// 新增课程 API
// POST /api/course-add  body: { course }
import { addCourse, json } from '../_lib/store.js'
import { requirePermission } from '../_lib/auth.js'
import { writeAudit } from '../_lib/audit.js'

async function readBody(request) {
  try {
    return (await request.json()) || {}
  } catch {
    return {}
  }
}

// 校验课程记录
function validateCourse(c) {
  if (!c) throw new Error('课程数据不能为空')
  if (!c.name) throw new Error('缺少 name')
  if (typeof c.name !== 'string' || c.name.length > 64) {
    throw new Error('name 需为 1-64 字符的字符串')
  }
  if (c.teacher && typeof c.teacher !== 'string') throw new Error('teacher 需为字符串')
  if (c.location && typeof c.location !== 'string') throw new Error('location 需为字符串')
  if (c.color && typeof c.color !== 'string') throw new Error('color 需为字符串')
  if (c.defaultStartTime && !/^\d{2}:\d{2}$/.test(c.defaultStartTime)) {
    throw new Error('defaultStartTime 格式应为 HH:mm')
  }
  if (c.defaultEndTime && !/^\d{2}:\d{2}$/.test(c.defaultEndTime)) {
    throw new Error('defaultEndTime 格式应为 HH:mm')
  }
  if (c.unitPrice !== undefined && c.unitPrice !== null && c.unitPrice !== '') {
    const n = Number(c.unitPrice)
    if (!Number.isFinite(n) || n < 0) throw new Error('unitPrice 需为非负数')
  }
  if (c.billingType && !['per_lesson', 'per_term', 'per_month'].includes(c.billingType)) {
    throw new Error('billingType 仅允许 per_lesson / per_term / per_month')
  }
}

export default async function onRequestPost(context) {
  const authFail = await requirePermission(context, 'courses:create')
  if (authFail) return authFail
  const { request } = context
  const body = await readBody(request)
  const { course } = body

  if (!course) {
    return json(
      { code: 1, message: '请求体需包含 course 字段', data: null },
      400,
    )
  }

  try {
    validateCourse(course)
  } catch (e) {
    return json({ code: 1, message: e.message, data: null }, 400)
  }

  try {
    const finalCourse = {
      id: course.id ? course.id.trim() : '',
      name: course.name.trim(),
      teacher: course.teacher ? course.teacher.trim() : '',
      location: course.location ? course.location.trim() : '',
      color: course.color || '',
      defaultStartTime: course.defaultStartTime || '',
      defaultEndTime: course.defaultEndTime || '',
      unitPrice: course.unitPrice !== undefined && course.unitPrice !== null && course.unitPrice !== ''
        ? Number(course.unitPrice) : 0,
      billingType: course.billingType || 'per_lesson',
      capacity: Number(course.capacity || 0),
      term: course.term || '',
      status: course.status || 'active',
      category: course.category || '',
      description: course.description || '',
    }

    const result = await addCourse(finalCourse)
    if (result.exists) {
      return json(
        { code: 1, message: `课程 id="${finalCourse.id}" 已存在，不可重复新增`, data: null },
        409,
      )
    }
    // 回填后端生成的 id，保证审计与响应一致
    if (result.course && result.course.id) finalCourse.id = result.course.id
    await writeAudit(context, {
      action: 'create',
      module: 'courses',
      targetType: 'course',
      targetId: finalCourse.id,
      targetName: finalCourse.name,
      summary: `新增课程「${finalCourse.name}」` + (finalCourse.teacher ? `（教师：${finalCourse.teacher}）` : ''),
      after: finalCourse,
    })
    return json({
      code: 0,
      message: '课程已新增',
      data: { ...result, course: finalCourse },
    })
  } catch (e) {
    console.error('[course-add] 新增异常:', e?.message || String(e))
    return json(
      { code: 1, message: '新增失败，请稍后重试', data: null },
      500,
    )
  }
}
