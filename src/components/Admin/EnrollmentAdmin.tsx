import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Course, Enrollment, EnrollmentStatus, Student } from '@/types'
import { cn } from '@/utils/cn'
import { getCourseDotClass } from '@/utils/courseColors'
import {
  addEnrollment,
  deleteEnrollment,
  listEnrollments,
  updateEnrollment,
} from '@/api/admin'

interface EnrollmentAdminProps {
  students: Student[]
  courses: Course[]
  busy: boolean // 父级全局忙碌状态，禁用按钮
  onBack: () => void
  showToast: (type: 'success' | 'error' | 'info', message: string) => void
  onAuthError: (e: Error) => void // 401 等错误处理
}

const PAGE_SIZE = 15

const STATUS_OPTIONS: { value: '' | EnrollmentStatus; label: string }[] = [
  { value: '', label: '全部状态' },
  { value: 'active', label: '进行中' },
  { value: 'settled', label: '已结转' },
  { value: 'finished', label: '已结课' },
]

// 金额格式化：整数显示 ¥200，非整数显示 ¥200.50
function formatMoney(value: number): string {
  if (!Number.isFinite(value)) return '¥0'
  return Number.isInteger(value) ? `¥${value}` : `¥${value.toFixed(2)}`
}

// 四舍五入到 2 位小数，避免浮点比较误差
function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// ISO 时间格式化为 yyyy-MM-dd HH:mm
function formatDateTime(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// 判断是否为 401 类鉴权错误（API 层 401 会抛出 message 含"未登录"的 Error）
function isAuthError(e: Error): boolean {
  const msg = e.message || ''
  return msg.includes('未登录') || msg.includes('登录已过期') || msg.includes('401')
}

export function EnrollmentAdmin({
  students,
  courses,
  busy,
  onBack,
  showToast,
  onAuthError,
}: EnrollmentAdminProps) {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStudentId, setFilterStudentId] = useState('')
  const [filterStatus, setFilterStatus] = useState<'' | EnrollmentStatus>('')
  const [page, setPage] = useState(1)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Enrollment | null>(null)
  // 本地操作忙碌（删除进行中），与父级 busy 共同禁用按钮
  const [localBusy, setLocalBusy] = useState(false)

  const actionDisabled = busy || localBusy

  // 学员/课程 id → 对象映射，用于列表展示名称
  const studentMap = useMemo(() => new Map(students.map((s) => [s.id, s])), [students])
  const courseMap = useMemo(() => new Map(courses.map((c) => [c.id, c])), [courses])

  // 加载报名记录（按当前筛选条件）
  const loadEnrollments = useCallback(async () => {
    setLoading(true)
    try {
      const result = await listEnrollments({
        studentId: filterStudentId || undefined,
        status: filterStatus || undefined,
      })
      if (result.code === 0) {
        setEnrollments(result.data.enrollments)
      } else {
        showToast('error', result.message || '加载报名记录失败')
        setEnrollments([])
      }
    } catch (e) {
      const err = e as Error
      if (isAuthError(err)) {
        onAuthError(err)
      } else {
        showToast('error', '加载报名记录失败：' + err.message)
      }
      setEnrollments([])
    } finally {
      setLoading(false)
    }
  }, [filterStudentId, filterStatus, showToast, onAuthError])

  // mount 及筛选变化时自动加载
  useEffect(() => {
    loadEnrollments()
  }, [loadEnrollments])

  // 筛选变化时回到第一页
  useEffect(() => {
    setPage(1)
  }, [filterStudentId, filterStatus])

  // 按报名时间升序排列（后端已升序返回，前端再保险排一次）
  const sorted = useMemo(() => {
    return [...enrollments].sort((a, b) =>
      (a.enrolledAt || '').localeCompare(b.enrolledAt || ''),
    )
  }, [enrollments])

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageItems = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE
    return sorted.slice(start, start + PAGE_SIZE)
  }, [sorted, safePage])

  // 删除报名：二次确认
  const handleDelete = async (e: Enrollment) => {
    const studentName = studentMap.get(e.studentId)?.name || e.studentId
    const courseName = courseMap.get(e.courseId)?.name || e.courseId
    const step1 = confirm(
      `确认删除「${studentName}」在「${courseName}」的报名记录？\n此操作不可恢复！`,
    )
    if (!step1) return
    const step2 = confirm('再次确认：真的要删除该报名记录吗？')
    if (!step2) return
    setLocalBusy(true)
    try {
      const result = await deleteEnrollment(e.id)
      if (result.code === 0) {
        showToast('success', '报名已删除')
        await loadEnrollments()
      } else {
        showToast('error', result.message || '删除失败')
      }
    } catch (err) {
      const error = err as Error
      if (isAuthError(error)) {
        onAuthError(error)
      } else {
        showToast('error', '删除失败：' + error.message)
      }
    } finally {
      setLocalBusy(false)
    }
  }

  const inputClass =
    'w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent'

  return (
    <div className="min-h-screen bg-slate-50">
      {/* 顶部栏 */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="text-slate-500 hover:text-slate-700 text-sm flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              返回后台
            </button>
            <span className="text-slate-300">/</span>
            <h1 className="text-base font-semibold text-slate-800">报名管理</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 hidden sm:block">共 {sorted.length} 条报名</span>
            <button
              onClick={() => setAdding(true)}
              disabled={actionDisabled}
              className="btn-primary text-sm py-1.5 px-3 disabled:opacity-50"
            >
              + 新增报名
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* 筛选区 */}
        <section className="card p-4 mb-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500">学员</label>
              <select
                value={filterStudentId}
                onChange={(e) => setFilterStudentId(e.target.value)}
                className={cn(inputClass, 'bg-white w-48')}
              >
                <option value="">全部学员</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.grade ? `（${s.grade}）` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500">状态</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as '' | EnrollmentStatus)}
                className={cn(inputClass, 'bg-white w-32')}
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* 列表区 */}
        {loading ? (
          <div className="card p-10 text-center text-sm text-slate-500">加载中…</div>
        ) : sorted.length === 0 ? (
          <div className="card p-10 text-center">
            <div className="text-slate-400 text-sm mb-2">暂无报名记录</div>
            <p className="text-xs text-slate-400 mb-4">可调整上方筛选条件，或新增一条报名记录</p>
            <button
              onClick={() => setAdding(true)}
              disabled={actionDisabled}
              className="btn-primary text-sm py-1.5 px-3 disabled:opacity-50"
            >
              + 新增报名
            </button>
          </div>
        ) : (
          <section className="card p-5">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 text-xs">
                    <th className="text-left py-2 px-2 font-medium">学员</th>
                    <th className="text-left py-2 px-2 font-medium">课程</th>
                    <th className="text-left py-2 px-2 font-medium">状态</th>
                    <th className="text-right py-2 px-2 font-medium">购课</th>
                    <th className="text-right py-2 px-2 font-medium">赠课</th>
                    <th className="text-left py-2 px-2 font-medium">剩余课时</th>
                    <th className="text-right py-2 px-2 font-medium">单价</th>
                    <th className="text-right py-2 px-2 font-medium">应付</th>
                    <th className="text-right py-2 px-2 font-medium">实付</th>
                    <th className="text-left py-2 px-2 font-medium">报名时间</th>
                    <th className="text-right py-2 px-2 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((e) => {
                    const student = studentMap.get(e.studentId)
                    const course = courseMap.get(e.courseId)
                    return (
                      <tr
                        key={e.id}
                        className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                      >
                        <td className="py-2.5 px-2 font-medium text-slate-700 whitespace-nowrap">
                          {student ? (
                            student.name
                          ) : (
                            <span className="text-slate-300">{e.studentId}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-2 text-slate-700">
                          <div className="flex items-center gap-1.5 whitespace-nowrap">
                            <span
                              className={cn(
                                'inline-block w-2.5 h-2.5 rounded-full flex-shrink-0',
                                getCourseDotClass(course?.color),
                              )}
                            />
                            {course ? (
                              course.name
                            ) : (
                              <span className="text-slate-300">{e.courseId}</span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-2">
                          <StatusBadge status={e.status} />
                        </td>
                        <td className="py-2.5 px-2 text-right text-slate-700 whitespace-nowrap font-medium">
                          {e.purchasedHours}
                        </td>
                        <td className="py-2.5 px-2 text-right text-slate-600 whitespace-nowrap">
                          {e.giftHours > 0 ? (
                            e.giftHours
                          ) : (
                            <span className="text-slate-300">0</span>
                          )}
                        </td>
                        <td className="py-2.5 px-2">{renderRemaining(e)}</td>
                        <td className="py-2.5 px-2 text-right text-slate-600 whitespace-nowrap">
                          {formatMoney(e.unitPrice)}
                        </td>
                        <td className="py-2.5 px-2 text-right text-slate-600 whitespace-nowrap">
                          {formatMoney(e.totalAmount)}
                        </td>
                        <td className="py-2.5 px-2 text-right text-slate-600 whitespace-nowrap">
                          {formatMoney(e.paidAmount)}
                        </td>
                        <td className="py-2.5 px-2 text-slate-500 text-xs whitespace-nowrap">
                          {formatDateTime(e.enrolledAt)}
                        </td>
                        <td className="py-2.5 px-2 text-right whitespace-nowrap">
                          <button
                            onClick={() => setEditing(e)}
                            disabled={actionDisabled}
                            className="text-brand-600 hover:text-brand-700 text-xs font-medium mr-3 disabled:opacity-50"
                          >
                            编辑
                          </button>
                          <button
                            onClick={() => handleDelete(e)}
                            disabled={actionDisabled}
                            className="text-rose-600 hover:text-rose-700 text-xs font-medium disabled:opacity-50"
                          >
                            删除
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* 分页 */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
                <span className="text-xs text-slate-400">
                  第 {safePage} / {totalPages} 页 · 每页 {PAGE_SIZE} 条
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={safePage <= 1}
                    className="btn-ghost border border-slate-200 text-xs py-1 px-2.5 disabled:opacity-40"
                  >
                    上一页
                  </button>
                  {renderPageButtons(safePage, totalPages, setPage)}
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safePage >= totalPages}
                    className="btn-ghost border border-slate-200 text-xs py-1 px-2.5 disabled:opacity-40"
                  >
                    下一页
                  </button>
                </div>
              </div>
            )}
          </section>
        )}
      </main>

      {/* 新增弹窗 */}
      {adding && (
        <EnrollmentEditModal
          students={students}
          courses={courses}
          onClose={() => setAdding(false)}
          onSaved={async () => {
            await loadEnrollments()
          }}
          showToast={showToast}
          onAuthError={onAuthError}
        />
      )}

      {/* 编辑弹窗 */}
      {editing && (
        <EnrollmentEditModal
          students={students}
          courses={courses}
          enrollment={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            await loadEnrollments()
          }}
          showToast={showToast}
          onAuthError={onAuthError}
        />
      )}
    </div>
  )
}

// 状态标签
function StatusBadge({ status }: { status: EnrollmentStatus }) {
  if (status === 'active') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-green-50 text-green-700 border border-green-200">
        进行中
      </span>
    )
  }
  if (status === 'settled') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-600 border border-slate-200">
        已结转
      </span>
    )
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-amber-50 text-amber-700 border border-amber-200">
      已结课
    </span>
  )
}

// 剩余课时展示：剩余 X（付费 a + 赠课 b），为 0 时 rose 高亮并标注"已用完"
function renderRemaining(e: Enrollment) {
  const rem = e.remainingPaidHours + e.remainingGiftHours
  const usedUp = rem <= 0
  return (
    <div className="whitespace-nowrap">
      <span className={usedUp ? 'text-rose-600 font-medium' : 'text-slate-700 font-medium'}>
        剩余 {rem}
      </span>
      <span className="text-slate-400 text-xs">
        （付费 {e.remainingPaidHours} + 赠课 {e.remainingGiftHours}）
      </span>
      {usedUp && <span className="ml-1 text-xs text-rose-500">已用完</span>}
    </div>
  )
}

// 渲染页码按钮：始终显示首页、末页、当前页前后 2 页，其余用省略号
function renderPageButtons(
  current: number,
  total: number,
  setPage: (p: number) => void,
) {
  const buttons: (number | '...')[] = []
  const around = 2
  for (let i = 1; i <= total; i++) {
    if (
      i === 1 ||
      i === total ||
      (i >= current - around && i <= current + around)
    ) {
      buttons.push(i)
    } else if (buttons[buttons.length - 1] !== '...') {
      buttons.push('...')
    }
  }
  return buttons.map((b, idx) => {
    if (b === '...') {
      return (
        <span key={`e${idx}`} className="text-slate-400 text-xs px-1.5 select-none">
          …
        </span>
      )
    }
    return (
      <button
        key={b}
        onClick={() => setPage(b)}
        className={
          b === current
            ? 'btn-primary text-xs py-1 px-2.5'
            : 'btn-ghost border border-slate-200 text-xs py-1 px-2.5'
        }
      >
        {b}
      </button>
    )
  })
}

// ===== 新增/编辑报名弹窗（共用） =====
interface EnrollmentEditModalProps {
  students: Student[]
  courses: Course[]
  enrollment?: Enrollment // 有值 = 编辑模式；无值 = 新增模式
  onClose: () => void
  onSaved: () => Promise<void> // 成功后刷新列表（await 完成后再关闭弹窗）
  showToast: (type: 'success' | 'error' | 'info', message: string) => void
  onAuthError: (e: Error) => void
}

interface EnrollmentForm {
  studentId: string
  courseId: string
  purchasedHours: string
  giftHours: string
  unitPrice: string
  paidAmount: string
  status: EnrollmentStatus
  note: string
}

function EnrollmentEditModal({
  students,
  courses,
  enrollment,
  onClose,
  onSaved,
  showToast,
  onAuthError,
}: EnrollmentEditModalProps) {
  const isEdit = !!enrollment
  const courseMap = useMemo(() => new Map(courses.map((c) => [c.id, c])), [courses])

  const [form, setForm] = useState<EnrollmentForm>(() => {
    if (enrollment) {
      return {
        studentId: enrollment.studentId,
        courseId: enrollment.courseId,
        purchasedHours: String(enrollment.purchasedHours ?? 0),
        giftHours: String(enrollment.giftHours ?? 0),
        unitPrice: String(enrollment.unitPrice ?? 0),
        paidAmount: String(enrollment.paidAmount ?? 0),
        status: enrollment.status,
        note: enrollment.note || '',
      }
    }
    return {
      studentId: '',
      courseId: '',
      purchasedHours: '',
      giftHours: '0',
      unitPrice: '',
      paidAmount: '',
      status: 'active',
      note: '',
    }
  })
  // 实付金额是否被用户手动改过：
  // 新增模式默认未触碰 → 随购课/单价实时同步默认值（=购课×单价）；
  // 编辑模式默认已触碰 → 保留已存储的实付金额，不自动覆盖
  const [paidTouched, setPaidTouched] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // 应付金额预览 = 购课课时 × 单价（实时计算）
  const previewTotal =
    (parseInt(form.purchasedHours, 10) || 0) * (Number(form.unitPrice) || 0)

  const inputClass =
    'w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent'

  const setField = <K extends keyof EnrollmentForm>(field: K, value: EnrollmentForm[K]) => {
    setForm((f) => ({ ...f, [field]: value }))
    setError('')
  }

  // 选课程：自动带入该课程单价；若实付未被手动改，同步默认实付
  const handleCourseChange = (courseId: string) => {
    const c = courseMap.get(courseId)
    const up = c?.unitPrice ?? 0
    setForm((f) => {
      const next: EnrollmentForm = { ...f, courseId, unitPrice: String(up) }
      if (!paidTouched) {
        const ph = parseInt(f.purchasedHours, 10)
        if (Number.isFinite(ph) && ph >= 0) {
          next.paidAmount = String(ph * up)
        }
      }
      return next
    })
    setError('')
  }

  // 改购课课时：若实付未被手动改，同步默认实付
  const handlePurchasedChange = (val: string) => {
    setForm((f) => {
      const next: EnrollmentForm = { ...f, purchasedHours: val }
      if (!paidTouched) {
        const ph = parseInt(val, 10)
        const up = Number(f.unitPrice)
        if (Number.isFinite(ph) && Number.isFinite(up)) {
          next.paidAmount = String(ph * up)
        }
      }
      return next
    })
    setError('')
  }

  // 改单价：若实付未被手动改，同步默认实付
  const handleUnitPriceChange = (val: string) => {
    setForm((f) => {
      const next: EnrollmentForm = { ...f, unitPrice: val }
      if (!paidTouched) {
        const ph = parseInt(f.purchasedHours, 10)
        const up = Number(val)
        if (Number.isFinite(ph) && Number.isFinite(up)) {
          next.paidAmount = String(ph * up)
        }
      }
      return next
    })
    setError('')
  }

  // 手动改实付金额：标记已触碰，不再自动同步
  const handlePaidChange = (val: string) => {
    setPaidTouched(true)
    setForm((f) => ({ ...f, paidAmount: val }))
    setError('')
  }

  const handleSave = async () => {
    setError('')

    // 学员/课程必选（新增模式）
    if (!isEdit) {
      if (!form.studentId) {
        setError('请选择学员')
        return
      }
      if (!form.courseId) {
        setError('请选择课程')
        return
      }
    }

    // 购课课时：必填、非负整数
    if (form.purchasedHours.trim() === '') {
      setError('请填写购课课时')
      return
    }
    const phNum = Number(form.purchasedHours)
    if (!Number.isFinite(phNum) || phNum < 0 || !Number.isInteger(phNum)) {
      setError('购课课时需为非负整数')
      return
    }

    // 赠课课时：非负整数（空视为 0）
    const ghNum = form.giftHours.trim() === '' ? 0 : Number(form.giftHours)
    if (!Number.isFinite(ghNum) || ghNum < 0 || !Number.isInteger(ghNum)) {
      setError('赠课课时需为非负整数')
      return
    }

    // 注意：允许购课=0 且 赠课=0，用于创建结转目标报名记录

    // 单价：非负数（空视为 0）
    const upNum = form.unitPrice.trim() === '' ? 0 : Number(form.unitPrice)
    if (!Number.isFinite(upNum) || upNum < 0) {
      setError('单价需为非负数')
      return
    }

    // 实付金额：非负数（空视为 0）
    const paidNum = form.paidAmount.trim() === '' ? 0 : Number(form.paidAmount)
    if (!Number.isFinite(paidNum) || paidNum < 0) {
      setError('实付金额需为非负数')
      return
    }

    setSaving(true)
    try {
      // 统一处理 API 结果：code===0 视为成功
      const applyResult = (r: { code: number; message: string }, successMsg: string): boolean => {
        if (r.code === 0) {
          showToast('success', successMsg)
          return true
        }
        setError(r.message || '操作失败')
        return false
      }

      let ok = false
      if (isEdit && enrollment) {
        // 编辑：传入 { id, purchasedHours, giftHours, unitPrice, paidAmount, status, note }
        // 课时为「绝对值」语义，后端按差值调整剩余
        const r = await updateEnrollment({
          id: enrollment.id,
          purchasedHours: phNum,
          giftHours: ghNum,
          unitPrice: upNum,
          paidAmount: paidNum,
          status: form.status,
          note: form.note.trim(),
        })
        ok = applyResult(r, '报名已更新')
      } else {
        // 新增：不传 id（后端生成）、不传 status/remainingPaidHours/remainingGiftHours/
        // totalAmount/enrolledAt/createdAt（后端计算/默认）。
        // paidAmount：仅当用户实付与默认应付（购课×单价）不一致时传入以覆盖默认值，
        // 一致时不传，由后端按默认值处理。
        const addPayload: Parameters<typeof addEnrollment>[0] = {
          studentId: form.studentId,
          courseId: form.courseId,
          purchasedHours: phNum,
          giftHours: ghNum,
          unitPrice: upNum,
          note: form.note.trim(),
        }
        const defaultPaid = round2(phNum * upNum)
        if (round2(paidNum) !== defaultPaid) {
          addPayload.paidAmount = round2(paidNum)
        }
        const r = await addEnrollment(addPayload)
        ok = applyResult(r, '报名已新增')
      }

      if (ok) {
        await onSaved()
        onClose()
      }
    } catch (e) {
      const err = e as Error
      if (isAuthError(err)) {
        onAuthError(err)
      } else {
        setError(err.message || '操作失败')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-xl">
          <h3 className="font-semibold text-base text-slate-800">
            {isEdit ? '编辑报名' : '新增报名'}
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors p-1"
            aria-label="关闭"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 内容 */}
        <div className="px-5 py-4 space-y-4">
          {/* 必填说明 */}
          <div className="text-xs text-slate-400">
            <span className="text-rose-500">*</span> 为必填项
            {isEdit && <span className="ml-2">学员/课程不可修改</span>}
          </div>

          {/* 新增模式：学员/课程缺失时提示 */}
          {!isEdit && (students.length === 0 || courses.length === 0) && (
            <div className="bg-amber-50 border border-amber-200 rounded-md px-3 py-2 text-xs text-amber-700">
              {students.length === 0 && '暂无学员数据，请先在学员管理中新增。'}
              {students.length === 0 && courses.length === 0 && ' '}
              {courses.length === 0 && '暂无课程数据，请先在课程管理中新增。'}
            </div>
          )}

          {/* 学员 */}
          <div className="flex items-start gap-4">
            <span className="text-sm text-slate-400 w-20 flex-shrink-0 pt-2">
              <span className="text-rose-500 mr-0.5">*</span>学员
            </span>
            <select
              value={form.studentId}
              onChange={(e) => setField('studentId', e.target.value)}
              className={cn(inputClass, 'bg-white')}
              disabled={isEdit}
              autoFocus={!isEdit}
            >
              <option value="">请选择学员</option>
              {/* 编辑模式下，若学员已被删除，补充显示其 id */}
              {isEdit && !students.some((s) => s.id === form.studentId) && form.studentId && (
                <option value={form.studentId}>{form.studentId}（已缺失）</option>
              )}
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.grade ? `（${s.grade}）` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* 课程 */}
          <div className="flex items-start gap-4">
            <span className="text-sm text-slate-400 w-20 flex-shrink-0 pt-2">
              <span className="text-rose-500 mr-0.5">*</span>课程
            </span>
            <select
              value={form.courseId}
              onChange={(e) => handleCourseChange(e.target.value)}
              className={cn(inputClass, 'bg-white')}
              disabled={isEdit}
            >
              <option value="">请选择课程</option>
              {/* 编辑模式下，若课程已被删除，补充显示其 id */}
              {isEdit && !courses.some((c) => c.id === form.courseId) && form.courseId && (
                <option value={form.courseId}>{form.courseId}（已缺失）</option>
              )}
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {typeof c.unitPrice === 'number' && c.unitPrice > 0
                    ? `（¥${c.unitPrice}/课时）`
                    : ''}
                </option>
              ))}
            </select>
          </div>

          {/* 编辑模式：当前剩余（只读） */}
          {isEdit && enrollment && (
            <div className="flex items-start gap-4">
              <span className="text-sm text-slate-400 w-20 flex-shrink-0 pt-2">当前剩余</span>
              <div className="flex-1 pt-2 text-sm text-slate-600">
                付费剩余 {enrollment.remainingPaidHours} + 赠课剩余 {enrollment.remainingGiftHours}
                {' = '}
                {enrollment.remainingPaidHours + enrollment.remainingGiftHours}
              </div>
            </div>
          )}

          {/* 编辑模式：状态 */}
          {isEdit && (
            <div className="flex items-start gap-4">
              <span className="text-sm text-slate-400 w-20 flex-shrink-0 pt-2">状态</span>
              <select
                value={form.status}
                onChange={(e) => setField('status', e.target.value as EnrollmentStatus)}
                className={cn(inputClass, 'bg-white')}
              >
                <option value="active">进行中</option>
                <option value="settled">已结转</option>
                <option value="finished">已结课</option>
              </select>
            </div>
          )}

          {/* 购课课时 */}
          <div className="flex items-start gap-4">
            <span className="text-sm text-slate-400 w-20 flex-shrink-0 pt-2">
              <span className="text-rose-500 mr-0.5">*</span>购课课时
            </span>
            <div className="flex-1 space-y-1">
              <input
                type="number"
                min={0}
                step={1}
                value={form.purchasedHours}
                onChange={(e) => handlePurchasedChange(e.target.value)}
                className={inputClass}
                placeholder="如：40"
              />
              <div className="text-xs text-slate-400">
                {isEdit
                  ? '修改购课课时将按差额调整剩余；如原 40 改为 50，剩余 +10'
                  : '报名的付费购课课时，点名时按课时扣减'}
              </div>
            </div>
          </div>

          {/* 赠课课时 */}
          <div className="flex items-start gap-4">
            <span className="text-sm text-slate-400 w-20 flex-shrink-0 pt-2">赠课课时</span>
            <input
              type="number"
              min={0}
              step={1}
              value={form.giftHours}
              onChange={(e) => setField('giftHours', e.target.value)}
              className={inputClass}
              placeholder="默认 0"
            />
          </div>

          {/* 单价 */}
          <div className="flex items-start gap-4">
            <span className="text-sm text-slate-400 w-20 flex-shrink-0 pt-2">
              <span className="text-rose-500 mr-0.5">*</span>单价
            </span>
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-slate-400 text-sm">¥</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.unitPrice}
                  onChange={(e) => handleUnitPriceChange(e.target.value)}
                  className={cn(inputClass, 'flex-1')}
                  placeholder="每课时单价，如 200"
                />
              </div>
              <div className="text-xs text-slate-400">
                {isEdit ? '修改单价不影响已扣减的历史，仅影响后续显示' : '报名时锁定单价；可填 0 表示免费'}
              </div>
            </div>
          </div>

          {/* 实付金额 */}
          <div className="flex items-start gap-4">
            <span className="text-sm text-slate-400 w-20 flex-shrink-0 pt-2">实付金额</span>
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-slate-400 text-sm">¥</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.paidAmount}
                  onChange={(e) => handlePaidChange(e.target.value)}
                  className={cn(inputClass, 'flex-1')}
                  placeholder="默认等于应付金额"
                />
              </div>
              <div className="text-xs text-slate-400">
                默认等于应付金额；如折扣或欠款可在此修改
              </div>
            </div>
          </div>

          {/* 应付金额（只读预览） */}
          <div className="flex items-start gap-4">
            <span className="text-sm text-slate-400 w-20 flex-shrink-0 pt-2">应付金额</span>
            <div className="flex-1 pt-2 text-sm text-slate-700 font-medium">
              {formatMoney(previewTotal)}
              <span className="ml-2 text-xs text-slate-400 font-normal">= 购课课时 × 单价</span>
            </div>
          </div>

          {/* 备注 */}
          <div className="flex items-start gap-4">
            <span className="text-sm text-slate-400 w-20 flex-shrink-0 pt-2">备注</span>
            <textarea
              value={form.note}
              onChange={(e) => setField('note', e.target.value)}
              rows={3}
              className={inputClass}
              placeholder="可选，如：续费、赠课原因等"
            />
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="bg-rose-50 border border-rose-200 rounded-md px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          )}
        </div>

        {/* 底部操作 */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex justify-end gap-2 sticky bottom-0">
          <button onClick={onClose} className="btn-ghost">
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={cn('btn-primary', saving && 'opacity-50')}
          >
            {saving ? '保存中…' : isEdit ? '保存' : '新增'}
          </button>
        </div>
      </div>
    </div>
  )
}