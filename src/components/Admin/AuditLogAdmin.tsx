// 审计日志查看页（仅超管使用）—— 按模块/动作/操作者/日期筛选，服务端分页，行内展开查看 before/after
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AuditLog } from '@/types'
import { listAuditLogs } from '@/api/admin'
import {
  Button,
  EmptyState,
  LoadingBlock,
  Pagination,
  SubPageHeader,
  inputClass,
  toast,
} from '@/components/ui'

interface AuditLogAdminProps {
  onBack: () => void
}

const PAGE_SIZE = 20

// 模块选项（值与后端一致）
const MODULE_OPTIONS: { value: string; label: string }[] = [
  { value: 'students', label: '学员' },
  { value: 'courses', label: '课程' },
  { value: 'enrollments', label: '报名' },
  { value: 'transfers', label: '结转' },
  { value: 'schedules', label: '排课' },
  { value: 'attendance', label: '点名' },
  { value: 'announcement', label: '公告' },
  { value: 'admins', label: '管理员' },
  { value: 'auth', label: '登录' },
  { value: 'reports', label: '报表' },
]

// 动作选项（值与后端一致）
const ACTION_OPTIONS: { value: string; label: string }[] = [
  { value: 'create', label: '新增' },
  { value: 'update', label: '更新' },
  { value: 'delete', label: '删除' },
  { value: 'login', label: '登录' },
  { value: 'bootstrap', label: '初始化' },
]

interface LogFilters {
  module: string
  action: string
  actorId: string
  startDate: string
  endDate: string
}

const EMPTY_FILTERS: LogFilters = {
  module: '',
  action: '',
  actorId: '',
  startDate: '',
  endDate: '',
}

function moduleLabel(v: string): string {
  return MODULE_OPTIONS.find((o) => o.value === v)?.label || v
}

function actionLabel(v: string): string {
  return ACTION_OPTIONS.find((o) => o.value === v)?.label || v
}

// 动作徽章配色
function actionBadgeClass(action: string): string {
  switch (action) {
    case 'create':
      return 'bg-green-50 text-green-700'
    case 'update':
      return 'bg-blue-50 text-blue-700'
    case 'delete':
      return 'bg-rose-50 text-rose-700'
    case 'login':
      return 'bg-slate-100 text-slate-600'
    case 'bootstrap':
      return 'bg-brand-50 text-brand-700'
    default:
      return 'bg-slate-100 text-slate-500'
  }
}

// 操作者角色徽章配色
function actorRoleBadgeClass(role: string): string {
  switch (role) {
    case 'superadmin':
      return 'bg-brand-50 text-brand-700'
    case 'admin':
      return 'bg-blue-50 text-blue-700'
    case 'teacher':
      return 'bg-slate-100 text-slate-600'
    default:
      return 'bg-slate-100 text-slate-500'
  }
}

function actorRoleLabel(role: string): string {
  switch (role) {
    case 'superadmin':
      return '超管'
    case 'admin':
      return '管理员'
    case 'teacher':
      return '教师'
    default:
      return role
  }
}

// 简易日期格式化：2024-01-02T03:04:05 -> 2024-01-02 03:04:05
function fmtDate(s?: string): string {
  if (!s) return '—'
  return String(s).replace('T', ' ').slice(0, 19)
}

// 安全地格式化任意值为 JSON 字符串
function formatJson(v: unknown): string {
  if (v === undefined || v === null) return '—'
  try {
    return JSON.stringify(v, null, 2)
  } catch {
    return String(v)
  }
}

export function AuditLogAdmin({ onBack }: AuditLogAdminProps) {
  const { t } = useTranslation()
  // 草稿筛选（绑定输入控件）
  const [form, setForm] = useState<LogFilters>(EMPTY_FILTERS)
  // 已应用筛选（实际用于请求）
  const [applied, setApplied] = useState<LogFilters>(EMPTY_FILTERS)
  const [page, setPage] = useState(1)
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // 应用筛选/翻页变化时重新加载
  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const result = await listAuditLogs({
          module: applied.module || undefined,
          action: applied.action || undefined,
          actorId: applied.actorId.trim() || undefined,
          startDate: applied.startDate || undefined,
          endDate: applied.endDate || undefined,
          page,
          pageSize: PAGE_SIZE,
        })
        if (cancelled) return
        if (result.code === 0) {
          setLogs(result.data.logs)
          setTotal(result.data.total)
        } else {
          toast.error(result.message)
          setLogs([])
          setTotal(0)
        }
      } catch (e) {
        if (!cancelled) {
          toast.error((e as Error).message)
          setLogs([])
          setTotal(0)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [applied, page])

  // 模块/动作/日期变化：立即应用并回到第 1 页
  const applyField = (field: 'module' | 'action' | 'startDate' | 'endDate', value: string) => {
    setForm((f) => ({ ...f, [field]: value }))
    setApplied((f) => ({ ...f, [field]: value }))
    setPage(1)
  }

  // 操作者 ID 为文本输入，仅在点击「查询」时应用（避免逐字请求）
  const onActorIdChange = (value: string) => {
    setForm((f) => ({ ...f, actorId: value }))
  }

  const onQuery = () => {
    setApplied(form)
    setPage(1)
  }

  const onReset = () => {
    setForm(EMPTY_FILTERS)
    setApplied(EMPTY_FILTERS)
    setPage(1)
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="min-h-screen bg-slate-50">
      <SubPageHeader title={t('auditLog.title')} onBack={onBack} />

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-4">
        {/* 筛选条 */}
        <section className="card p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
            <div>
              <label className="block text-xs text-slate-500 mb-1">{t('auditLog.module')}</label>
              <select
                className={inputClass}
                value={form.module}
                onChange={(e) => applyField('module', e.target.value)}
              >
                <option value="">{t('common.all')}</option>
                {MODULE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">{t('auditLog.action')}</label>
              <select
                className={inputClass}
                value={form.action}
                onChange={(e) => applyField('action', e.target.value)}
              >
                <option value="">{t('common.all')}</option>
                {ACTION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">{t('auditLog.actor')} ID</label>
              <input
                className={inputClass}
                value={form.actorId}
                onChange={(e) => onActorIdChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onQuery()
                }}
                placeholder="可选"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">{t('common.startDate')}</label>
              <input
                type="date"
                className={inputClass}
                value={form.startDate}
                onChange={(e) => applyField('startDate', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">结束日期</label>
              <input
                type="date"
                className={inputClass}
                value={form.endDate}
                onChange={(e) => applyField('endDate', e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <Button variant="outline" onClick={onReset}>
              {t('common.reset')}
            </Button>
            <Button variant="primary" onClick={onQuery}>
              {t('common.query')}
            </Button>
          </div>
        </section>

        {/* 列表 */}
        {loading ? (
          <LoadingBlock />
        ) : logs.length === 0 ? (
          <EmptyState title={t('auditLog.noLogs')} description="筛选条件下没有记录" />
        ) : (
          <section className="card p-5">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 text-xs">
                    <th className="text-left py-2 px-2 font-medium">{t('common.time')}</th>
                    <th className="text-left py-2 px-2 font-medium">{t('auditLog.actor')}</th>
                    <th className="text-left py-2 px-2 font-medium">{t('auditLog.module')}</th>
                    <th className="text-left py-2 px-2 font-medium">{t('auditLog.action')}</th>
                    <th className="text-left py-2 px-2 font-medium">{t('auditLog.target')}</th>
                    <th className="text-left py-2 px-2 font-medium">{t('auditLog.summary')}</th>
                    <th className="text-left py-2 px-2 font-medium">IP</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => {
                    const expanded = expandedId === log.id
                    return (
                      <LogRow
                        key={log.id}
                        log={log}
                        expanded={expanded}
                        onToggle={() => setExpandedId(expanded ? null : log.id)}
                      />
                    )
                  })}
                </tbody>
              </table>
            </div>

            <Pagination
              page={page}
              totalPages={totalPages}
              total={total}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          </section>
        )}
      </main>
    </div>
  )
}

// 单行日志 + 展开详情（before/after JSON）
function LogRow({
  log,
  expanded,
  onToggle,
}: {
  log: AuditLog
  expanded: boolean
  onToggle: () => void
}) {
  const { t } = useTranslation()
  return (
    <>
      <tr
        onClick={onToggle}
        className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors"
      >
        <td className="py-2.5 px-2 text-slate-600 whitespace-nowrap">
          <span className="inline-flex items-center gap-1">
            <svg
              className={`w-3 h-3 text-slate-400 transition-transform ${expanded ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            {fmtDate(log.createdAt)}
          </span>
        </td>
        <td className="py-2.5 px-2">
          <span className="inline-flex items-center gap-1.5">
            <span className="text-slate-700 font-medium">{log.actorName}</span>
            <span
              className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${actorRoleBadgeClass(
                String(log.actorRole),
              )}`}
            >
              {actorRoleLabel(String(log.actorRole))}
            </span>
          </span>
        </td>
        <td className="py-2.5 px-2 text-slate-600">{moduleLabel(log.module)}</td>
        <td className="py-2.5 px-2">
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${actionBadgeClass(
              log.action,
            )}`}
          >
            {actionLabel(log.action)}
          </span>
        </td>
        <td className="py-2.5 px-2 text-slate-600">
          {log.targetName ? (
            <span>
              {log.targetType && (
                <span className="text-slate-400 text-xs mr-1">{log.targetType}</span>
              )}
              {log.targetName}
            </span>
          ) : log.targetId ? (
            <span className="font-mono text-xs text-slate-500">{log.targetId}</span>
          ) : (
            <span className="text-slate-300">—</span>
          )}
        </td>
        <td className="py-2.5 px-2 text-slate-600 max-w-xs truncate" title={log.summary || ''}>
          {log.summary || <span className="text-slate-300">—</span>}
        </td>
        <td className="py-2.5 px-2 text-slate-500 font-mono text-xs whitespace-nowrap">
          {log.ip || <span className="text-slate-300">—</span>}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={7} className="bg-slate-50 px-4 py-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <div className="text-xs font-medium text-slate-500 mb-1">{t('auditLog.before')} (before)</div>
                <pre className="text-xs bg-white border border-slate-200 rounded p-2 overflow-x-auto max-h-64 font-mono">
                  {formatJson(log.before)}
                </pre>
              </div>
              <div>
                <div className="text-xs font-medium text-slate-500 mb-1">{t('auditLog.after')} (after)</div>
                <pre className="text-xs bg-white border border-slate-200 rounded p-2 overflow-x-auto max-h-64 font-mono">
                  {formatJson(log.after)}
                </pre>
              </div>
            </div>
            {log.userAgent && (
              <div className="text-xs text-slate-400 mt-2 break-all">UA: {log.userAgent}</div>
            )}
          </td>
        </tr>
      )}
    </>
  )
}
