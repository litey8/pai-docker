import { useMemo, useState } from 'react'
import type { Course, BillingType, CourseStatus } from '@/types'
import { cn } from '@/utils/cn'
import { COURSE_COLOR_OPTIONS, getCourseDotClass } from '@/utils/courseColors'
import {
  Button,
  EmptyState,
  Field,
  Modal,
  ModalFooter,
  Pagination,
  SubPageHeader,
  inputClass,
} from '@/components/ui'

interface CourseAdminProps {
  courses: Course[]
  busy: boolean
  onBack: () => void
  onDelete: (course: Course) => void
  onAdd: (course: Course) => Promise<boolean>
  onUpdate: (course: Course) => Promise<boolean>
}

const PAGE_SIZE = 15

export function CourseAdmin({ courses, busy, onBack, onDelete, onAdd, onUpdate }: CourseAdminProps) {
  const [page, setPage] = useState(1)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Course | null>(null)

  const totalPages = Math.max(1, Math.ceil(courses.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageItems = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE
    return courses.slice(start, start + PAGE_SIZE)
  }, [courses, safePage])

  return (
    <div className="min-h-screen bg-slate-50">
      <SubPageHeader title="课程管理" onBack={onBack} count={courses.length} countLabel="门">
        <Button variant="primary" onClick={() => setAdding(true)} disabled={busy}>
          + 新增课程
        </Button>
      </SubPageHeader>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {courses.length === 0 ? (
          <EmptyState
            title="暂无课程"
            description="新增课程后，可在排课管理中按课程批量排课"
            action={
              <Button variant="primary" onClick={() => setAdding(true)} disabled={busy}>
                + 新增第一个课程
              </Button>
            }
          />
        ) : (
          <section className="card p-5">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 text-xs">
                    <th className="text-left py-2 px-2 font-medium">颜色</th>
                    <th className="text-left py-2 px-2 font-medium">课程名称</th>
                    <th className="text-left py-2 px-2 font-medium">教师</th>
                    <th className="text-left py-2 px-2 font-medium">地点</th>
                    <th className="text-left py-2 px-2 font-medium">默认时间</th>
                    <th className="text-left py-2 px-2 font-medium">单价</th>
                    <th className="text-left py-2 px-2 font-medium">计费</th>
                    <th className="text-left py-2 px-2 font-medium">ID</th>
                    <th className="text-right py-2 px-2 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((c) => (
                    <tr
                      key={c.id}
                      className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                    >
                      <td className="py-2.5 px-2">
                        <span
                          className={cn(
                            'inline-block w-4 h-4 rounded-full',
                            getCourseDotClass(c.color),
                          )}
                        />
                      </td>
                      <td className="py-2.5 px-2 font-medium text-slate-700">{c.name}</td>
                      <td className="py-2.5 px-2 text-slate-600">
                        {c.teacher || <span className="text-slate-300">—</span>}
                      </td>
                      <td className="py-2.5 px-2 text-slate-600">
                        {c.location || <span className="text-slate-300">—</span>}
                      </td>
                      <td className="py-2.5 px-2 text-slate-600 text-xs">
                        {c.defaultStartTime || c.defaultEndTime
                          ? `${c.defaultStartTime || '--'} - ${c.defaultEndTime || '--'}`
                          : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="py-2.5 px-2 text-slate-600 whitespace-nowrap">
                        {c.unitPrice && c.unitPrice > 0 ? (
                          <span className="text-slate-700 font-medium">¥{c.unitPrice}</span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-2 text-slate-600 text-xs">
                        {c.billingType === 'per_term' ? '按期' : c.billingType === 'per_month' ? '按月' : '按课时'}
                      </td>
                      <td className="py-2.5 px-2 text-slate-500 font-mono text-xs">{c.id}</td>
                      <td className="py-2.5 px-2 text-right whitespace-nowrap">
                        <button
                          onClick={() => setEditing(c)}
                          disabled={busy}
                          className="text-brand-600 hover:text-brand-700 text-xs font-medium mr-3 disabled:opacity-50"
                        >
                          编辑
                        </button>
                        <button
                          onClick={() => onDelete(c)}
                          disabled={busy}
                          className="text-rose-600 hover:text-rose-700 text-xs font-medium disabled:opacity-50"
                        >
                          删除
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
              total={courses.length}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          </section>
        )}
      </main>

      {/* 新增弹窗 */}
      {adding && (
        <CourseEditModal
          onClose={() => setAdding(false)}
          onSubmit={onAdd}
        />
      )}

      {/* 编辑弹窗 */}
      {editing && (
        <CourseEditModal
          course={editing}
          onClose={() => setEditing(null)}
          onSubmit={onUpdate}
        />
      )}
    </div>
  )
}

// ===== 新增/编辑课程弹窗 =====
interface CourseEditModalProps {
  course?: Course // 有值 = 编辑模式；无值 = 新增模式
  onClose: () => void
  onSubmit: (course: Course) => Promise<boolean>
}

// 默认时间：小时 + 分钟两个独立 select
// 分钟以 5 分钟为单位：00, 05, 10, ..., 55
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0'))
const MINUTE_5MIN_OPTIONS = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'))

// 将任意 HH:mm 对齐到最近的 5 分钟刻度（向下取整）
// 用于编辑模式加载历史数据时规整化（如 "09:03" -> "09:00"）
function alignTo5Min(time: string): string {
  if (!time || !/^\d{2}:\d{2}$/.test(time)) return time
  const [h, m] = time.split(':').map(Number)
  const alignedM = Math.floor(m / 5) * 5
  return `${String(h).padStart(2, '0')}:${String(alignedM).padStart(2, '0')}`
}

// 从 "HH:mm" 中拆出小时与分钟（无值时返回空串）
function splitTime(time: string): { h: string; m: string } {
  if (!time || !/^\d{2}:\d{2}$/.test(time)) return { h: '', m: '' }
  const [h, m] = time.split(':')
  return { h, m }
}

function CourseEditModal({ course, onClose, onSubmit }: CourseEditModalProps) {
  const isEdit = !!course
  const [form, setForm] = useState<Course>(
    course
      ? {
          ...course,
          // 编辑模式：将历史时间对齐到 5 分钟刻度，确保 select 能匹配
          defaultStartTime: alignTo5Min(course.defaultStartTime || ''),
          defaultEndTime: alignTo5Min(course.defaultEndTime || ''),
          unitPrice: course.unitPrice ?? 0,
          billingType: course.billingType || 'per_lesson',
          capacity: course.capacity ?? 0,
          status: course.status || 'active',
          term: course.term || '',
          category: course.category || '',
          description: course.description || '',
        }
      : {
          // 新增模式：id 留空，由后端生成回填
          id: '',
          name: '',
          teacher: '',
          location: '',
          color: 'blue',
          defaultStartTime: '',
          defaultEndTime: '',
          unitPrice: 0,
          billingType: 'per_lesson',
          capacity: 0,
          status: 'active',
          term: '',
          category: '',
          description: '',
        },
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  // 局部更新表单，同时清除对应字段的错误
  const update = (patch: Partial<Course>) => {
    setForm((f) => ({ ...f, ...patch }))
    setErrors((e) => {
      const next = { ...e }
      for (const k of Object.keys(patch)) delete next[k]
      // 时间字段错误统一挂在 time 上
      if (patch.defaultStartTime !== undefined || patch.defaultEndTime !== undefined) {
        delete next.time
      }
      return next
    })
  }

  // 计费方式：从 select 字符串收敛到联合类型
  const setBillingType = (value: string) => {
    if (value === 'per_lesson' || value === 'per_term' || value === 'per_month') {
      update({ billingType: value })
    }
  }

  // 状态：从 select 字符串收敛到联合类型
  const setStatus = (value: string) => {
    if (value === 'active' || value === 'inactive') {
      update({ status: value })
    }
  }

  // 时间字段局部变更：小时与分钟分别选择，合成 "HH:mm" 写回
  // 全空视为未设置；半选时保留中间态（如 "09:"），由 validate 的格式校验拦截
  const handleTimeChange = (
    field: 'defaultStartTime' | 'defaultEndTime',
    part: 'h' | 'm',
    value: string,
  ) => {
    const current = splitTime(form[field] || '')
    const next = { ...current, [part]: value }
    const merged = next.h === '' && next.m === '' ? '' : `${next.h}:${next.m}`
    const patch: Partial<Course> = {}
    patch[field] = merged
    update(patch)
  }

  const validate = (): boolean => {
    const e: Record<string, string> = {}
    if (!form.name.trim()) {
      e.name = '课程名称不能为空'
    }
    if (form.defaultStartTime && !/^\d{2}:\d{2}$/.test(form.defaultStartTime)) {
      e.time = '默认开始时间需同时选择小时和分钟'
    }
    if (form.defaultEndTime && !/^\d{2}:\d{2}$/.test(form.defaultEndTime)) {
      e.time = '默认结束时间需同时选择小时和分钟'
    }
    const unitPriceNum = Number(form.unitPrice)
    if (!Number.isFinite(unitPriceNum) || unitPriceNum < 0) {
      e.unitPrice = '单价需为非负数'
    }
    const capacityNum = Number(form.capacity)
    if (!Number.isFinite(capacityNum) || capacityNum < 0) {
      e.capacity = '容量需为非负数'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const submit = async () => {
    if (!validate()) return
    setSaving(true)
    const finalCourse: Course = {
      // 新增模式 id 为空串，由后端生成回填；编辑模式保留原 id
      id: form.id.trim(),
      name: form.name.trim(),
      teacher: (form.teacher || '').trim(),
      location: (form.location || '').trim(),
      color: form.color || '',
      defaultStartTime: form.defaultStartTime || '',
      defaultEndTime: form.defaultEndTime || '',
      unitPrice: Number(form.unitPrice),
      billingType: (form.billingType || 'per_lesson') as BillingType,
      capacity: Number(form.capacity),
      term: (form.term || '').trim(),
      status: (form.status || 'active') as CourseStatus,
      category: (form.category || '').trim(),
      description: (form.description || '').trim(),
    }
    const ok = await onSubmit(finalCourse)
    setSaving(false)
    if (ok) {
      onClose()
    }
  }

  return (
    <Modal
      title={isEdit ? '编辑课程' : '新增课程'}
      onClose={onClose}
      size="lg"
      footer={
        <ModalFooter
          onCancel={onClose}
          onConfirm={submit}
          loading={saving}
          confirmText={isEdit ? '保存' : '新增'}
        />
      }
    >
      <div className="space-y-4">
        {/* 课程名称 */}
        <Field label="课程名称" required error={errors.name}>
          <input
            type="text"
            className={inputClass}
            value={form.name}
            onChange={(e) => update({ name: e.target.value })}
            placeholder="如：数学提高班"
            autoFocus
          />
        </Field>

        {/* 颜色标签 */}
        <Field label="颜色标签">
          <div className="flex flex-wrap gap-2">
            {COURSE_COLOR_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => update({ color: opt.key })}
                className={cn(
                  'flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs transition-all',
                  form.color === opt.key
                    ? 'border-slate-400 bg-slate-50 ring-1 ring-slate-300'
                    : 'border-slate-200 hover:border-slate-300',
                )}
              >
                <span className={cn('inline-block w-3 h-3 rounded-full', opt.dot)} />
                {opt.label}
              </button>
            ))}
          </div>
        </Field>

        {/* 教师 */}
        <Field label="教师">
          <input
            type="text"
            className={inputClass}
            value={form.teacher || ''}
            onChange={(e) => update({ teacher: e.target.value })}
            placeholder="如：张老师"
          />
        </Field>

        {/* 地点 */}
        <Field label="地点">
          <input
            type="text"
            className={inputClass}
            value={form.location || ''}
            onChange={(e) => update({ location: e.target.value })}
            placeholder="如：A教室201"
          />
        </Field>

        {/* 默认时间：小时 + 分钟分别选择，分钟按 5 分钟刻度 */}
        <Field label="默认时间" error={errors.time} hint="分钟以 5 分钟为单位">
          <div className="flex items-center gap-2">
            {/* 开始时间：时 : 分 */}
            <select
              value={splitTime(form.defaultStartTime || '').h}
              onChange={(e) => handleTimeChange('defaultStartTime', 'h', e.target.value)}
              className={cn(inputClass, 'bg-white w-20 text-center')}
            >
              <option value="">时</option>
              {HOUR_OPTIONS.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
            <span className="text-slate-400">:</span>
            <select
              value={splitTime(form.defaultStartTime || '').m}
              onChange={(e) => handleTimeChange('defaultStartTime', 'm', e.target.value)}
              className={cn(inputClass, 'bg-white w-20 text-center')}
            >
              <option value="">分</option>
              {MINUTE_5MIN_OPTIONS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <span className="text-slate-400 px-1">-</span>
            {/* 结束时间：时 : 分 */}
            <select
              value={splitTime(form.defaultEndTime || '').h}
              onChange={(e) => handleTimeChange('defaultEndTime', 'h', e.target.value)}
              className={cn(inputClass, 'bg-white w-20 text-center')}
            >
              <option value="">时</option>
              {HOUR_OPTIONS.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
            <span className="text-slate-400">:</span>
            <select
              value={splitTime(form.defaultEndTime || '').m}
              onChange={(e) => handleTimeChange('defaultEndTime', 'm', e.target.value)}
              className={cn(inputClass, 'bg-white w-20 text-center')}
            >
              <option value="">分</option>
              {MINUTE_5MIN_OPTIONS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </Field>

        {/* 单价 */}
        <Field
          label="单价"
          error={errors.unitPrice}
          hint="报名时按此单价计费；可填 0 表示免费"
        >
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-sm">¥</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={form.unitPrice ?? 0}
              onChange={(e) => update({ unitPrice: Number(e.target.value) })}
              className={inputClass}
              placeholder="每课时单价，如 200"
            />
          </div>
        </Field>

        {/* 计费方式 */}
        <Field label="计费方式">
          <select
            className={inputClass}
            value={form.billingType || 'per_lesson'}
            onChange={(e) => setBillingType(e.target.value)}
          >
            <option value="per_lesson">按课时（点名扣减）</option>
            <option value="per_term">按期（整期收费）</option>
            <option value="per_month">按月（包月收费）</option>
          </select>
        </Field>

        {/* 容量 */}
        <Field label="容量" error={errors.capacity} hint="课程最大容纳人数">
          <input
            type="number"
            min={0}
            value={form.capacity ?? 0}
            onChange={(e) => update({ capacity: Number(e.target.value) })}
            className={inputClass}
            placeholder="如 20"
          />
        </Field>

        {/* 学期 */}
        <Field label="学期" hint="如：2024春季">
          <input
            type="text"
            className={inputClass}
            value={form.term || ''}
            onChange={(e) => update({ term: e.target.value })}
            placeholder="如：2024春季"
          />
        </Field>

        {/* 状态 */}
        <Field label="状态">
          <select
            className={inputClass}
            value={form.status || 'active'}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="active">启用</option>
            <option value="inactive">停用</option>
          </select>
        </Field>

        {/* 分类 */}
        <Field label="分类" hint="如：数学/英语/物理">
          <input
            type="text"
            className={inputClass}
            value={form.category || ''}
            onChange={(e) => update({ category: e.target.value })}
            placeholder="如：数学"
          />
        </Field>

        {/* 描述 */}
        <Field label="描述">
          <textarea
            className={cn(inputClass, 'min-h-[72px] resize-y')}
            value={form.description || ''}
            onChange={(e) => update({ description: e.target.value })}
            placeholder="课程简介、适合人群等"
            rows={3}
          />
        </Field>
      </div>
    </Modal>
  )
}
