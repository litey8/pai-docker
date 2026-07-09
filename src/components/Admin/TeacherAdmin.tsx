// 教师端管理页 —— 课后反馈 + 教师绩效 两个 Tab
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Feedback, TeacherPerformance } from '@/types'
import {
  getFeedback,
  updateFeedback,
  deleteFeedback,
  getTeacherPerformance,
} from '@/api/admin'
import {
  Button,
  EmptyState,
  Field,
  Modal,
  ModalFooter,
  Pagination,
  SubPageHeader,
  LoadingBlock,
  inputClass,
  toast,
  confirmDialog,
} from '@/components/ui'
import { cn } from '@/utils/cn'

interface TeacherAdminProps {
  onBack: () => void
}

type TabKey = 'feedback' | 'performance'

const FEEDBACK_PAGE_SIZE = 10

// 评分星标：rating 为 0-5，用 ★/☆ 渲染（小数先四舍五入）
function renderStars(rating: number): string {
  const r = Math.max(0, Math.min(5, Math.round(rating)))
  return '★'.repeat(r) + '☆'.repeat(5 - r)
}

// 文本截断（用于反馈内容预览）
function truncate(s: string, n = 30): string {
  return s.length > n ? s.slice(0, n) + '…' : s
}

const TAB_DEFS: { key: TabKey; labelKey: string }[] = [
  { key: 'feedback', labelKey: 'teacher.feedbackTab' },
  { key: 'performance', labelKey: 'teacher.performanceTab' },
]

export function TeacherAdmin({ onBack }: TeacherAdminProps) {
  const { t } = useTranslation()
  const [tab, setTab] = useState<TabKey>('feedback')

  return (
    <div className="min-h-screen bg-slate-50">
      <SubPageHeader title={t('teacher.title')} onBack={onBack} />

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        {/* Tab 切换 */}
        <div className="flex gap-1">
          {TAB_DEFS.map((tabDef) => {
            const active = tabDef.key === tab
            return (
              <button
                key={tabDef.key}
                onClick={() => setTab(tabDef.key)}
                className={cn(
                  'px-4 py-2 text-sm rounded-md whitespace-nowrap transition-colors',
                  active
                    ? 'bg-brand-500 text-white'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50',
                )}
              >
                {t(tabDef.labelKey)}
              </button>
            )
          })}
        </div>

        {tab === 'feedback' ? <FeedbackPanel /> : <PerformancePanel />}
      </main>
    </div>
  )
}

// ============ Tab1：课后反馈 ============
function FeedbackPanel() {
  const { t } = useTranslation()
  const [list, setList] = useState<Feedback[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<Feedback | null>(null)
  const [editContent, setEditContent] = useState('')
  const [editRating, setEditRating] = useState(5)
  const [saving, setSaving] = useState(false)

  const totalPages = Math.max(1, Math.ceil(list.length / FEEDBACK_PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * FEEDBACK_PAGE_SIZE
  const pageItems = list.slice(start, start + FEEDBACK_PAGE_SIZE)

  const load = async () => {
    setLoading(true)
    try {
      const data = await getFeedback()
      setList(data)
    } catch (e) {
      toast.error((e as Error).message || '加载反馈失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const openEdit = (fb: Feedback) => {
    setEditing(fb)
    setEditContent(fb.content || '')
    setEditRating(fb.rating ?? 5)
  }

  const closeEdit = () => setEditing(null)

  const saveEdit = async () => {
    if (!editing) return
    setSaving(true)
    try {
      const result = await updateFeedback(editing.id, {
        content: editContent,
        rating: editRating,
      })
      if (result.code === 0) {
        toast.success('反馈已更新')
        closeEdit()
        await load()
      } else {
        toast.error(result.message || '更新失败')
      }
    } catch (e) {
      toast.error((e as Error).message || '更新失败')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (fb: Feedback) => {
    const ok = await confirmDialog({
      title: t('teacher.deleteFeedbackTitle'),
      message: t('teacher.deleteFeedbackMessage'),
      danger: true,
      confirmText: t('common.confirm'),
    })
    if (!ok) return
    try {
      const result = await deleteFeedback(fb.id)
      if (result.code === 0) {
        toast.success(t('common.deleteSuccess'))
        await load()
      } else {
        toast.error(result.message || '删除失败')
      }
    } catch (e) {
      toast.error((e as Error).message || '删除失败')
    }
  }

  return (
    <>
      {loading ? (
        <LoadingBlock />
      ) : list.length === 0 ? (
        <EmptyState title={t('teacher.noFeedback')} description="教师提交课后反馈后将在此展示" />
      ) : (
        <section className="card p-5">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 text-xs">
                  <th className="text-left py-2 px-2 font-medium whitespace-nowrap">{t('teacher.date')}</th>
                  <th className="text-left py-2 px-2 font-medium whitespace-nowrap">{t('teacher.student')}</th>
                  <th className="text-left py-2 px-2 font-medium whitespace-nowrap">{t('teacher.course')}</th>
                  <th className="text-left py-2 px-2 font-medium whitespace-nowrap">{t('teacher.teacher')}</th>
                  <th className="text-left py-2 px-2 font-medium whitespace-nowrap">{t('teacher.rating')}</th>
                  <th className="text-left py-2 px-2 font-medium">{t('teacher.content')}</th>
                  <th className="text-right py-2 px-2 font-medium whitespace-nowrap">{t('common.operation')}</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((fb) => (
                  <tr
                    key={fb.id}
                    className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                  >
                    <td className="py-2 px-2 text-slate-600 whitespace-nowrap">{fb.date || '—'}</td>
                    <td className="py-2 px-2 text-slate-700 whitespace-nowrap">{fb.studentName || '—'}</td>
                    <td className="py-2 px-2 text-slate-600 whitespace-nowrap">{fb.courseId || fb.teacherName || '—'}</td>
                    <td className="py-2 px-2 text-slate-600 whitespace-nowrap">{fb.teacherName || '—'}</td>
                    <td className="py-2 px-2 text-amber-500 whitespace-nowrap" title={`${fb.rating} 星`}>
                      {renderStars(fb.rating)}
                    </td>
                    <td className="py-2 px-2 text-slate-600 max-w-xs" title={fb.content}>
                      {fb.content ? truncate(fb.content) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="py-2 px-2 text-right whitespace-nowrap">
                      <button
                        onClick={() => openEdit(fb)}
                        className="text-brand-600 hover:text-brand-700 text-xs"
                      >
                        {t('common.edit')}
                      </button>
                      <button
                        onClick={() => handleDelete(fb)}
                        className="text-rose-600 hover:text-rose-700 text-xs ml-3"
                      >
                        {t('common.delete')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            page={safePage}
            totalPages={totalPages}
            total={list.length}
            pageSize={FEEDBACK_PAGE_SIZE}
            onPageChange={setPage}
          />
        </section>
      )}

      {/* 编辑反馈弹窗 */}
      {editing && (
        <Modal
          title="编辑反馈"
          size="md"
          onClose={closeEdit}
          footer={
            <ModalFooter
              loading={saving}
              onCancel={closeEdit}
              onConfirm={saveEdit}
              confirmText={t('common.save')}
            />
          }
        >
          <div className="space-y-4">
            <div className="text-xs text-slate-400">
              {editing.studentName || '—'} · {editing.date || '—'}
            </div>
            <Field label={t('teacher.content')}>
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={4}
                maxLength={2000}
                placeholder="请输入课后反馈内容"
                className={cn(inputClass, 'resize-y')}
              />
            </Field>
            <Field label={t('teacher.rating')}>
              <select
                value={editRating}
                onChange={(e) => setEditRating(Number(e.target.value))}
                className={inputClass}
              >
                {[0, 1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n} 星（{renderStars(n)}）
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </Modal>
      )}
    </>
  )
}

// ============ Tab2：教师绩效 ============
function PerformancePanel() {
  const { t } = useTranslation()
  const [rows, setRows] = useState<TeacherPerformance[]>([])
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  // 查询触发器：点「查询」按钮自增；改日期不自动查
  const [queryTick, setQueryTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const data = await getTeacherPerformance({
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        })
        if (cancelled) return
        setRows(data)
      } catch (e) {
        if (cancelled) return
        toast.error((e as Error).message || '加载绩效失败')
        setRows([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
    // startDate/endDate 故意不列入依赖：改日期不自动查询
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryTick])

  const handleQuery = () => setQueryTick((t) => t + 1)

  return (
    <>
      {/* 日期筛选区 */}
      <section className="card p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 w-40">
            <span className="text-xs text-slate-500">{t('common.startDate')}</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 w-40">
            <span className="text-xs text-slate-500">{t('common.endDate')}</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={inputClass}
            />
          </label>
          <Button variant="primary" loading={loading} onClick={handleQuery}>
            {t('common.query')}
          </Button>
        </div>
      </section>

      {/* 结果区 */}
      {loading ? (
        <LoadingBlock />
      ) : rows.length === 0 ? (
        <EmptyState title={t('teacher.noPerformance')} description="尝试调整日期范围后重新查询" />
      ) : (
        <section className="card p-5">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 text-xs">
                  <th className="text-left py-2 px-2 font-medium whitespace-nowrap">{t('teacher.teacher')}</th>
                  <th className="text-left py-2 px-2 font-medium whitespace-nowrap">{t('teacher.scheduleCount')}</th>
                  <th className="text-left py-2 px-2 font-medium whitespace-nowrap">{t('teacher.attendedCount')}</th>
                  <th className="text-left py-2 px-2 font-medium whitespace-nowrap">{t('teacher.attendanceRate')}</th>
                  <th className="text-left py-2 px-2 font-medium whitespace-nowrap">{t('teacher.avgRating')}</th>
                  <th className="text-left py-2 px-2 font-medium whitespace-nowrap">{t('teacher.feedbackCount')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const sc = row.schedule_count || 0
                  const ac = row.attended_count || 0
                  const rate = sc > 0 ? `${((ac / sc) * 100).toFixed(1)}%` : '—'
                  return (
                    <tr
                      key={row.teacher_id || row.teacher_name}
                      className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                    >
                      <td className="py-2 px-2 text-slate-700 whitespace-nowrap">{row.teacher_name || '—'}</td>
                      <td className="py-2 px-2 text-slate-600 whitespace-nowrap">{sc}</td>
                      <td className="py-2 px-2 text-slate-600 whitespace-nowrap">{ac}</td>
                      <td className="py-2 px-2 text-slate-600 whitespace-nowrap">{rate}</td>
                      <td className="py-2 px-2 whitespace-nowrap">
                        {row.avg_rating === null ? (
                          <span className="text-slate-300">—</span>
                        ) : (
                          <span className="text-amber-500" title={row.avg_rating.toFixed(1)}>
                            {renderStars(row.avg_rating)}
                            <span className="ml-1 text-slate-400">({row.avg_rating.toFixed(1)})</span>
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-slate-600 whitespace-nowrap">{row.feedback_count || 0}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  )
}
