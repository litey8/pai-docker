// 审计日志写入助手：从 context.admin 提取操作者，统一写入 audit_logs
// 用法：在写操作成功后调用 await writeAudit(context, { action, module, ... })
import { addAuditLog } from './store.js'
import { getClientIp } from './auth.js'

export async function writeAudit(context, info) {
  try {
    const admin = context.admin || {}
    await addAuditLog({
      actorId: admin.id || '',
      actorName: admin.username || admin.realName || '',
      actorRole: admin.role || '',
      action: info.action || '',
      module: info.module || '',
      targetType: info.targetType || '',
      targetId: info.targetId || '',
      targetName: info.targetName || '',
      summary: info.summary || '',
      before: info.before || null,
      after: info.after || null,
      ip: getClientIp(context.request),
      userAgent: context.request.headers.get('user-agent') || '',
    })
  } catch (e) {
    console.error('[audit] 写入失败:', e?.message || String(e))
  }
}
