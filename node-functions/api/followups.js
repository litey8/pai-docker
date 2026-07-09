// CRM 线索跟进记录 API
// GET  /api/followups?leadId=  -> 查询某线索的跟进历史
// POST /api/followups          -> 新增跟进  body: { leadId, content, stage }
import { getFollowups, addFollowup, json } from '../_lib/store.js'
import { requirePermission } from '../_lib/auth.js'
import { writeAudit } from '../_lib/audit.js'

const STAGES = ['new', 'contacted', 'trial', 'intentioned', 'signed', 'lost']

async function readBody(request) {
  try {
    return (await request.json()) || {}
  } catch {
    return {}
  }
}

function corsOk() {
  return new Response(null, { status: 204 })
}

// GET /api/followups?leadId=
async function handleGet(context) {
  const fail = await requirePermission(context, 'leads:view')
  if (fail) return fail
  const url = new URL(context.request.url)
  const leadId = (url.searchParams.get('leadId') || '').trim()
  if (!leadId) {
    return json({ code: 1, message: '需提供 leadId 参数', data: null }, 400)
  }
  try {
    const list = await getFollowups(leadId)
    return json({ code: 0, message: 'ok', data: list })
  } catch (e) {
    console.error('[followups] 查询异常:', e?.message || String(e))
    return json({ code: 1, message: '查询失败，请稍后重试', data: null }, 500)
  }
}

// POST /api/followups  body: { leadId, content, stage }
async function handlePost(context, request) {
  const fail = await requirePermission(context, 'leads:update')
  if (fail) return fail
  const body = await readBody(request)
  const { leadId, content, stage } = body || {}
  if (!leadId) {
    return json({ code: 1, message: '缺少 leadId', data: null }, 400)
  }
  if (!content || typeof content !== 'string' || !content.trim()) {
    return json({ code: 1, message: '跟进内容不能为空', data: null }, 400)
  }
  if (stage && !STAGES.includes(stage)) {
    return json({ code: 1, message: `stage 需为 ${STAGES.join('/')} 之一`, data: null }, 400)
  }

  const operatorId = context.admin?.id || ''
  try {
    const fu = {
      leadId,
      content: content.trim(),
      stage: STAGES.includes(stage) ? stage : '',
      operatorId,
    }
    const result = await addFollowup(fu)
    await writeAudit(context, {
      action: 'followup',
      module: 'leads',
      targetType: 'lead',
      targetId: leadId,
      targetName: '',
      summary: '跟进线索',
      after: { ...fu, id: result.id },
    })
    return json({ code: 0, message: '跟进已记录', data: { id: result.id } })
  } catch (e) {
    console.error('[followups] 新增异常:', e?.message || String(e))
    return json({ code: 1, message: '保存失败，请稍后重试', data: null }, 500)
  }
}

export default async function onRequest(context) {
  const { request } = context
  if (request.method === 'OPTIONS') return corsOk()
  if (request.method === 'GET') return handleGet(context)
  if (request.method === 'POST') return handlePost(context, request)
  return json(
    { code: 1, message: '不支持的请求方法，请使用 GET 或 POST', data: null },
    405,
  )
}
