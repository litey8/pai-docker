// 会员卡管理 API
// GET    /api/memberships?status=          -> 会员卡列表（可按状态筛选）
// POST   /api/memberships  body: membership -> 新增会员卡
// PUT    /api/memberships  body: {id,...patch} -> 更新会员卡
// DELETE /api/memberships?id=              -> 删除会员卡
import { getMemberships, addMembership, updateMembership, deleteMembership, json } from '../_lib/store.js'
import { requirePermission } from '../_lib/auth.js'
import { writeAudit } from '../_lib/audit.js'

async function readBody(request) {
  try {
    return (await request.json()) || {}
  } catch {
    return {}
  }
}

// 校验会员卡字段
function validateMembership(m) {
  if (!m) throw new Error('会员卡数据不能为空')
  if (!m.name || typeof m.name !== 'string') {
    throw new Error('缺少 name 或格式不正确')
  }
  if (m.type && !['monthly', 'termly', 'yearly', 'count'].includes(m.type)) {
    throw new Error('type 需为 monthly/termly/yearly/count')
  }
  if (m.status && !['active', 'disabled'].includes(m.status)) {
    throw new Error('status 需为 active 或 disabled')
  }
  if (m.price !== undefined && (Number(m.price) < 0 || !Number.isFinite(Number(m.price)))) {
    throw new Error('price 需为非负数')
  }
}

// GET /api/memberships?status=
async function handleGet(context) {
  const authFail = await requirePermission(context, 'memberships:view')
  if (authFail) return authFail
  const { request } = context
  const url = new URL(request.url)
  const status = (url.searchParams.get('status') || '').trim() || undefined

  try {
    const list = await getMemberships({ status })
    return json({ code: 0, message: 'ok', data: list })
  } catch (e) {
    console.error('[memberships] 查询异常:', e?.message || String(e))
    return json({ code: 1, message: '查询失败，请稍后重试', data: null }, 500)
  }
}

// POST /api/memberships  body: membership
async function handlePost(context) {
  const authFail = await requirePermission(context, 'memberships:create')
  if (authFail) return authFail
  const { request } = context
  const m = await readBody(request)

  try {
    validateMembership(m)
  } catch (e) {
    return json({ code: 1, message: e.message, data: null }, 400)
  }

  try {
    const finalMembership = {
      name: m.name.trim(),
      type: m.type || 'monthly',
      durationDays: Math.max(1, Math.floor(Number(m.durationDays) || 30)),
      price: Math.max(0, Number(m.price) || 0),
      status: m.status || 'active',
      benefits: m.benefits || '',
      remark: m.remark || '',
    }
    const result = await addMembership(finalMembership)
    const id = result.id
    await writeAudit(context, {
      action: 'create',
      module: 'memberships',
      targetType: 'membership',
      targetId: id,
      targetName: finalMembership.name,
      summary: `新增会员卡 ${finalMembership.name}`,
      after: { ...finalMembership, id },
    })
    return json({ code: 0, message: '会员卡已创建', data: { id } })
  } catch (e) {
    console.error('[memberships] 新增异常:', e?.message || String(e))
    return json({ code: 1, message: '新增失败，请稍后重试', data: null }, 500)
  }
}

// PUT /api/memberships  body: { id, ...patch }
async function handlePut(context) {
  const authFail = await requirePermission(context, 'memberships:update')
  if (authFail) return authFail
  const { request } = context
  const body = await readBody(request)
  const { id, ...patch } = body

  if (!id) {
    return json({ code: 1, message: '缺少 id', data: null }, 400)
  }

  try {
    validateMembership(patch)
  } catch (e) {
    return json({ code: 1, message: e.message, data: null }, 400)
  }

  try {
    await updateMembership(id, patch)
    await writeAudit(context, {
      action: 'update',
      module: 'memberships',
      targetType: 'membership',
      targetId: id,
      targetName: patch.name || '',
      summary: `更新会员卡 ${patch.name || id}`,
      after: patch,
    })
    return json({ code: 0, message: '会员卡已更新', data: { id } })
  } catch (e) {
    console.error('[memberships] 更新异常:', e?.message || String(e))
    return json({ code: 1, message: '更新失败，请稍后重试', data: null }, 500)
  }
}

// DELETE /api/memberships?id=
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
    await deleteMembership(id)
    await writeAudit(context, {
      action: 'delete',
      module: 'memberships',
      targetType: 'membership',
      targetId: id,
      summary: `删除会员卡 ${id}`,
    })
    return json({ code: 0, message: '会员卡已删除', data: { ok: true } })
  } catch (e) {
    console.error('[memberships] 删除异常:', e?.message || String(e))
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
