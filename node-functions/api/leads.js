// CRM 线索 API
// GET    /api/leads?stage=&assignedTo=  -> 查询线索列表（可按阶段/负责人筛选）
// POST   /api/leads                     -> 新增线索  body: { lead }
// PUT    /api/leads                     -> 更新线索  body: { id, ...patch }
// DELETE /api/leads?id=                 -> 删除线索
import { getLeads, addLead, updateLead, deleteLead, json } from '../_lib/store.js'
import { requirePermission } from '../_lib/auth.js'
import { writeAudit } from '../_lib/audit.js'

// 线索阶段合法值
const STAGES = ['new', 'contacted', 'trial', 'intentioned', 'signed', 'lost']

async function readBody(request) {
  try {
    return (await request.json()) || {}
  } catch {
    return {}
  }
}

// 预检放行（同源部署）
function corsOk() {
  return new Response(null, { status: 204 })
}

// GET /api/leads?stage=&assignedTo=
async function handleGet(context) {
  const fail = await requirePermission(context, 'leads:view')
  if (fail) return fail
  const url = new URL(context.request.url)
  const stage = (url.searchParams.get('stage') || '').trim()
  const assignedTo = (url.searchParams.get('assignedTo') || '').trim()
  const list = await getLeads({
    stage: STAGES.includes(stage) ? stage : '',
    assignedTo,
  })
  return json({ code: 0, message: 'ok', data: list })
}

// POST /api/leads  body: { lead }
async function handlePost(context, request) {
  const fail = await requirePermission(context, 'leads:create')
  if (fail) return fail
  const body = await readBody(request)
  const lead = body.lead || body
  if (!lead || typeof lead !== 'object') {
    return json({ code: 1, message: '请求体需包含 lead 字段', data: null }, 400)
  }
  if (!lead.name || typeof lead.name !== 'string') {
    return json({ code: 1, message: '缺少 name', data: null }, 400)
  }
  if (lead.stage && !STAGES.includes(lead.stage)) {
    return json({ code: 1, message: `stage 需为 ${STAGES.join('/')} 之一`, data: null }, 400)
  }

  const finalLead = {
    name: lead.name.trim(),
    phone: lead.phone || '',
    grade: lead.grade || '',
    source: lead.source || '',
    stage: STAGES.includes(lead.stage) ? lead.stage : 'new',
    intention: lead.intention || '',
    assignedTo: lead.assignedTo || '',
    remark: lead.remark || '',
  }

  try {
    const result = await addLead(finalLead)
    await writeAudit(context, {
      action: 'create',
      module: 'leads',
      targetType: 'lead',
      targetId: result.id,
      targetName: finalLead.name,
      summary: `新增线索 ${finalLead.name}`,
      after: { ...finalLead, id: result.id },
    })
    return json({ code: 0, message: '线索已新增', data: { ...finalLead, id: result.id } })
  } catch (e) {
    console.error('[leads] 新增异常:', e?.message || String(e))
    return json({ code: 1, message: '新增失败，请稍后重试', data: null }, 500)
  }
}

// PUT /api/leads  body: { id, ...patch }
// stage / converted 变化需在审计中记录
async function handlePut(context, request) {
  const fail = await requirePermission(context, 'leads:update')
  if (fail) return fail
  const body = await readBody(request)
  const { id, ...patch } = body
  if (!id) {
    return json({ code: 1, message: '缺少 id', data: null }, 400)
  }
  if (patch.stage !== undefined && !STAGES.includes(patch.stage)) {
    return json({ code: 1, message: `stage 需为 ${STAGES.join('/')} 之一`, data: null }, 400)
  }

  // 取更新前快照，用于审计对比与「不存在」判定
  let before = null
  let beforeName = ''
  try {
    const all = await getLeads()
    before = all.find((l) => l.id === id) || null
    beforeName = before ? before.name : ''
  } catch {
    // 忽略读取异常，交由 updateLead 抛出
  }

  try {
    await updateLead(id, patch)
  } catch (e) {
    if (String(e?.message || '').includes('不存在')) {
      return json({ code: 1, message: `线索 id="${id}" 不存在`, data: null }, 404)
    }
    console.error('[leads] 更新异常:', e?.message || String(e))
    return json({ code: 1, message: '更新失败，请稍后重试', data: null }, 500)
  }

  // 拼接审计摘要：基础「更新线索」+ stage/converted 变化提示
  const parts = [`更新线索 ${beforeName || id}`]
  if (before && patch.stage !== undefined && patch.stage !== before.stage) {
    parts.push(`阶段 ${before.stage}→${patch.stage}`)
  }
  if (before && patch.converted !== undefined && !!patch.converted !== !!before.converted) {
    parts.push(patch.converted ? '已标记转化为学员' : '取消转化标记')
  }

  await writeAudit(context, {
    action: 'update',
    module: 'leads',
    targetType: 'lead',
    targetId: id,
    targetName: beforeName || id,
    summary: parts.join('，'),
    before: before || null,
    after: { ...(before || {}), ...patch, id },
  })
  return json({ code: 0, message: '线索已更新', data: { id } })
}

// DELETE /api/leads?id=
async function handleDelete(context) {
  const fail = await requirePermission(context, 'leads:delete')
  if (fail) return fail
  const url = new URL(context.request.url)
  const id = (url.searchParams.get('id') || '').trim()
  if (!id) {
    return json({ code: 1, message: '需提供 id 参数', data: null }, 400)
  }

  let leadName = ''
  try {
    const all = await getLeads()
    leadName = all.find((l) => l.id === id)?.name || ''
  } catch {
    // 忽略
  }

  try {
    await deleteLead(id)
  } catch (e) {
    console.error('[leads] 删除异常:', e?.message || String(e))
    return json({ code: 1, message: '删除失败，请稍后重试', data: null }, 500)
  }

  await writeAudit(context, {
    action: 'delete',
    module: 'leads',
    targetType: 'lead',
    targetId: id,
    targetName: leadName || id,
    summary: `删除线索 ${leadName || id}`,
  })
  return json({ code: 0, message: '线索已删除', data: { ok: true } })
}

export default async function onRequest(context) {
  const { request } = context
  if (request.method === 'OPTIONS') return corsOk()
  if (request.method === 'GET') return handleGet(context)
  if (request.method === 'POST') return handlePost(context, request)
  if (request.method === 'PUT') return handlePut(context, request)
  if (request.method === 'DELETE') return handleDelete(context)
  return json(
    { code: 1, message: '不支持的请求方法，请使用 GET/POST/PUT/DELETE', data: null },
    405,
  )
}
