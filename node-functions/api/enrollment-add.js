// 新增报名 API
// POST /api/enrollment-add  body: { enrollment }
import { addEnrollment, json } from '../_lib/store.js'
import { requireAuth } from '../_lib/auth.js'
import { genEnrollmentId } from '../_lib/id.js'

async function readBody(request) {
  try {
    return (await request.json()) || {}
  } catch {
    return {}
  }
}

// 校验报名记录
function validateEnrollment(e) {
  if (!e) throw new Error('报名数据不能为空')
  if (!e.studentId) throw new Error('缺少 studentId')
  if (!e.courseId) throw new Error('缺少 courseId')
  // 课时为非负整数
  const ph = Number(e.purchasedHours || 0)
  const gh = Number(e.giftHours || 0)
  if (!Number.isFinite(ph) || ph < 0 || !Number.isInteger(ph)) {
    throw new Error('purchasedHours 需为非负整数')
  }
  if (!Number.isFinite(gh) || gh < 0 || !Number.isInteger(gh)) {
    throw new Error('giftHours 需为非负整数')
  }
  // 注意：允许 purchasedHours=0 && giftHours=0，用于结转目标报名记录
  // 单价为非负数（允许 0，但建议 > 0）
  const up = Number(e.unitPrice || 0)
  if (!Number.isFinite(up) || up < 0) {
    throw new Error('unitPrice 需为非负数')
  }
}

export default async function onRequestPost(context) {
  const authFail = await requireAuth(context)
  if (authFail) return authFail
  const { request } = context
  const body = await readBody(request)
  const { enrollment } = body

  if (!enrollment) {
    return json({ code: 1, message: '请求体需包含 enrollment 字段', data: null }, 400)
  }

  try {
    validateEnrollment(enrollment)
  } catch (e) {
    return json({ code: 1, message: e.message, data: null }, 400)
  }

  try {
    const id = enrollment.id || genEnrollmentId()
    const purchased = Number(enrollment.purchasedHours || 0)
    const gift = Number(enrollment.giftHours || 0)
    const unitPrice = Number(enrollment.unitPrice || 0)
    const finalEnrollment = {
      id,
      studentId: enrollment.studentId.trim(),
      courseId: enrollment.courseId.trim(),
      purchasedHours: purchased,
      giftHours: gift,
      unitPrice,
      totalAmount: Number(enrollment.totalAmount ?? (purchased * unitPrice)),
      paidAmount: Number(enrollment.paidAmount ?? (purchased * unitPrice)),
      enrolledAt: enrollment.enrolledAt || new Date().toISOString(),
      note: enrollment.note ? String(enrollment.note).slice(0, 500) : '',
    }

    const result = await addEnrollment(finalEnrollment)
    if (result.exists) {
      return json({ code: 1, message: `报名 id="${id}" 已存在`, data: null }, 409)
    }
    if (result.notFound === 'student') {
      return json({ code: 1, message: '学员不存在，请先在学员管理中创建', data: null }, 404)
    }
    if (result.notFound === 'course') {
      return json({ code: 1, message: '课程不存在，请先在课程管理中创建', data: null }, 404)
    }
    return json({
      code: 0,
      message: '报名已新增',
      data: { ...result, enrollment: finalEnrollment },
    })
  } catch (e) {
    console.error('[enrollment-add] 新增异常:', e?.message || String(e))
    return json({ code: 1, message: '新增失败，请稍后重试', data: null }, 500)
  }
}
