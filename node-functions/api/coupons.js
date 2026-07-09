// 优惠券管理 API
// GET    /api/coupons?status=          -> 优惠券列表（可按状态筛选）
// POST   /api/coupons  body: coupon     -> 新增优惠券
// PUT    /api/coupons  body: {id,...patch} -> 更新优惠券
// DELETE /api/coupons?id=              -> 删除优惠券
import { getCoupons, addCoupon, updateCoupon, deleteCoupon, json } from '../_lib/store.js'
import { requirePermission } from '../_lib/auth.js'
import { writeAudit } from '../_lib/audit.js'

async function readBody(request) {
  try {
    return (await request.json()) || {}
  } catch {
    return {}
  }
}

// 校验优惠券字段
function validateCoupon(c) {
  if (!c) throw new Error('优惠券数据不能为空')
  if (!c.name || typeof c.name !== 'string') {
    throw new Error('缺少 name 或格式不正确')
  }
  if (c.type && !['discount', 'amount'].includes(c.type)) {
    throw new Error('type 需为 discount 或 amount')
  }
  if (c.status && !['active', 'disabled'].includes(c.status)) {
    throw new Error('status 需为 active 或 disabled')
  }
  if (c.value !== undefined && (Number(c.value) < 0 || !Number.isFinite(Number(c.value)))) {
    throw new Error('value 需为非负数')
  }
}

// GET /api/coupons?status=
async function handleGet(context) {
  const authFail = await requirePermission(context, 'coupons:view')
  if (authFail) return authFail
  const { request } = context
  const url = new URL(request.url)
  const status = (url.searchParams.get('status') || '').trim() || undefined

  try {
    const list = await getCoupons({ status })
    return json({ code: 0, message: 'ok', data: list })
  } catch (e) {
    console.error('[coupons] 查询异常:', e?.message || String(e))
    return json({ code: 1, message: '查询失败，请稍后重试', data: null }, 500)
  }
}

// POST /api/coupons  body: coupon
async function handlePost(context) {
  const authFail = await requirePermission(context, 'coupons:create')
  if (authFail) return authFail
  const { request } = context
  const coupon = await readBody(request)

  try {
    validateCoupon(coupon)
  } catch (e) {
    return json({ code: 1, message: e.message, data: null }, 400)
  }

  try {
    const finalCoupon = {
      code: (coupon.code || '').trim(),
      name: coupon.name.trim(),
      type: coupon.type || 'discount',
      value: Math.max(0, Number(coupon.value) || 0),
      minAmount: Math.max(0, Number(coupon.minAmount) || 0),
      validFrom: coupon.validFrom || '',
      validTo: coupon.validTo || '',
      usageLimit: Math.max(0, Math.floor(Number(coupon.usageLimit) || 0)),
      status: coupon.status || 'active',
      remark: coupon.remark || '',
    }
    const result = await addCoupon(finalCoupon)
    const id = result.id
    await writeAudit(context, {
      action: 'create',
      module: 'coupons',
      targetType: 'coupon',
      targetId: id,
      targetName: finalCoupon.name,
      summary: `新增优惠券 ${finalCoupon.name}`,
      after: { ...finalCoupon, id },
    })
    return json({ code: 0, message: '优惠券已创建', data: { id } })
  } catch (e) {
    console.error('[coupons] 新增异常:', e?.message || String(e))
    return json({ code: 1, message: '新增失败，请稍后重试', data: null }, 500)
  }
}

// PUT /api/coupons  body: { id, ...patch }
async function handlePut(context) {
  const authFail = await requirePermission(context, 'coupons:update')
  if (authFail) return authFail
  const { request } = context
  const body = await readBody(request)
  const { id, ...patch } = body

  if (!id) {
    return json({ code: 1, message: '缺少 id', data: null }, 400)
  }

  try {
    validateCoupon(patch)
  } catch (e) {
    return json({ code: 1, message: e.message, data: null }, 400)
  }

  try {
    await updateCoupon(id, patch)
    await writeAudit(context, {
      action: 'update',
      module: 'coupons',
      targetType: 'coupon',
      targetId: id,
      targetName: patch.name || '',
      summary: `更新优惠券 ${patch.name || id}`,
      after: patch,
    })
    return json({ code: 0, message: '优惠券已更新', data: { id } })
  } catch (e) {
    console.error('[coupons] 更新异常:', e?.message || String(e))
    return json({ code: 1, message: '更新失败，请稍后重试', data: null }, 500)
  }
}

// DELETE /api/coupons?id=
async function handleDelete(context) {
  const authFail = await requirePermission(context, 'coupons:delete')
  if (authFail) return authFail
  const { request } = context
  const url = new URL(request.url)
  const id = (url.searchParams.get('id') || '').trim()

  if (!id) {
    return json({ code: 1, message: '缺少 id', data: null }, 400)
  }

  try {
    await deleteCoupon(id)
    await writeAudit(context, {
      action: 'delete',
      module: 'coupons',
      targetType: 'coupon',
      targetId: id,
      summary: `删除优惠券 ${id}`,
    })
    return json({ code: 0, message: '优惠券已删除', data: { ok: true } })
  } catch (e) {
    console.error('[coupons] 删除异常:', e?.message || String(e))
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
  if (request.method === 'PUT') return handlePut(context)
  if (request.method === 'DELETE') return handleDelete(context)
  return json({ code: 1, message: '不支持的请求方法', data: null }, 405)
}
