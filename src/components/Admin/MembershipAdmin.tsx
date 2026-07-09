import { useCallback, useEffect, useState } from 'react'
import type { Membership, StudentMembership, Student } from '@/types'
import { cn } from '@/utils/cn'
import {
  Button,
  EmptyState,
  Field,
  Modal,
  ModalFooter,
  SubPageHeader,
  LoadingBlock,
  inputClass,
  toast,
  confirmDialog,
} from '@/components/ui'
import {
  getMemberships,
  addMembership,
  updateMembership,
  deleteMembership,
  getStudentMemberships,
  addStudentMembership,
  deleteStudentMembership,
} from '@/api/admin'

interface MembershipAdminProps {
  students: Student[]
  onBack: () => void
}

// 可编辑字段（不含后端生成/维护的 id/createdAt）
type MembershipForm = Omit<Membership, 'id' | 'createdAt'>

const MEMBERSHIP_TYPE_LABEL: Record<Membership['type'], string> = {
  monthly: '月卡',
  termly: '期卡',
  yearly: '年卡',
  count: '次卡',
}

export function MembershipAdmin({ students, onBack }: MembershipAdminProps) {
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [studentMemberships, setStudentMemberships] = useState<StudentMembership[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Membership | null>(null)
  const [granting, setGranting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [mList, smList] = await Promise.all([
        getMemberships(),
        getStudentMemberships(),
      ])
      setMemberships(mList)
      setStudentMemberships(smList)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '加载会员卡数据失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // ===== 会员卡类型 CRUD =====
  const handleAdd = async (data: MembershipForm): Promise<boolean> => {
    setBusy(true)
    try {
      const result = await addMembership(data)
      if (result.code === 0) {
        toast.success('会员卡已创建')
        await load()
        return true
      }
      toast.error(result.message || '创建失败')
      return false
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '创建失败')
      return false
    } finally {
      setBusy(false)
    }
  }

  const handleUpdate = async (id: string, data: MembershipForm): Promise<boolean> => {
    setBusy(true)
    try {
      const result = await updateMembership(id, data)
      if (result.code === 0) {
        toast.success('会员卡已更新')
        await load()
        return true
      }
      toast.error(result.message || '更新失败')
      return false
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '更新失败')
      return false
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (m: Membership) => {
    const ok = await confirmDialog({
      title: '删除会员卡？',
      message: `确认删除会员卡「${m.name}」？已办理该卡的学员记录不受影响，但将无法再新增办理。`,
      danger: true,
      confirmText: '确认删除',
    })
    if (!ok) return
    setBusy(true)
    try {
      const result = await deleteMembership(m.id)
      if (result.code === 0) {
        toast.success('会员卡已删除')
        await load()
      } else {
        toast.error(result.message || '删除失败')
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '删除失败')
    } finally {
      setBusy(false)
    }
  }

  // ===== 学员办卡 =====
  const handleGrant = async (input: {
    studentId: string
    membershipId: string
    paidAmount: number
    durationDays: number
  }): Promise<boolean> => {
    setBusy(true)
    try {
      const result = await addStudentMembership(input)
      if (result.code === 0) {
        toast.success('办卡成功')
        await load()
        return true
      }
      toast.error(result.message || '办卡失败')
      return false
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '办卡失败')
      return false
    } finally {
      setBusy(false)
    }
  }

  const handleDeleteStudentMembership = async (sm: StudentMembership) => {
    const ok = await confirmDialog({
      title: '删除办卡记录？',
      message: `确认删除「${sm.studentName || '该学员'}」的「${sm.membershipName || ''}」办卡记录？该操作不可恢复。`,
      danger: true,
      confirmText: '确认删除',
    })
    if (!ok) return
    setBusy(true)
    try {
      const result = await deleteStudentMembership(sm.id)
      if (result.code === 0) {
        toast.success('记录已删除')
        await load()
      } else {
        toast.error(result.message || '删除失败')
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '删除失败')
    } finally {
      setBusy(false)
    }
  }

  const activeMemberships = memberships.filter((m) => m.status === 'active')

  return (
    <div className="min-h-screen bg-slate-50">
      <SubPageHeader title="会员卡管理" onBack={onBack}>
        <Button
          variant="primary"
          onClick={() => setGranting(true)}
          disabled={busy || loading || activeMemberships.length === 0 || students.length === 0}
        >
          + 学员办卡
        </Button>
      </SubPageHeader>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-8">
        {loading ? (
          <LoadingBlock />
        ) : (
          <>
            {/* ===== 区域一：会员卡类型管理 ===== */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-slate-700">
                  会员卡类型
                  <span className="ml-2 text-xs text-slate-400 font-normal">
                    共 {memberships.length} 种
                  </span>
                </h2>
                <Button variant="outline" onClick={() => setAdding(true)} disabled={busy}>
                  + 新增会员卡
                </Button>
              </div>

              {memberships.length === 0 ? (
                <EmptyState
                  title="暂无会员卡类型"
                  description="新增会员卡类型后，可为学员办理会员卡"
                  action={
                    <Button variant="primary" onClick={() => setAdding(true)} disabled={busy}>
                      + 新增第一种会员卡
                    </Button>
                  }
                />
              ) : (
                <div className="card p-5">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500 text-xs">
                          <th className="text-left py-2 px-2 font-medium">名称</th>
                          <th className="text-left py-2 px-2 font-medium">类型</th>
                          <th className="text-left py-2 px-2 font-medium">有效天数</th>
                          <th className="text-left py-2 px-2 font-medium">价格</th>
                          <th className="text-left py-2 px-2 font-medium">状态</th>
                          <th className="text-left py-2 px-2 font-medium">权益</th>
                          <th className="text-left py-2 px-2 font-medium">备注</th>
                          <th className="text-right py-2 px-2 font-medium">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {memberships.map((m) => (
                          <tr
                            key={m.id}
                            className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                          >
                            <td className="py-2.5 px-2 font-medium text-slate-700">{m.name}</td>
                            <td className="py-2.5 px-2 text-slate-600 text-xs">
                              {MEMBERSHIP_TYPE_LABEL[m.type] || m.type}
                            </td>
                            <td className="py-2.5 px-2 text-slate-600 whitespace-nowrap">
                              {m.durationDays} 天
                            </td>
                            <td className="py-2.5 px-2 text-slate-700 font-medium whitespace-nowrap">
                              ¥{m.price}
                            </td>
                            <td className="py-2.5 px-2">
                              <span
                                className={cn(
                                  'inline-block px-2 py-0.5 rounded-full text-xs',
                                  m.status === 'active'
                                    ? 'bg-green-50 text-green-600'
                                    : 'bg-slate-100 text-slate-400',
                                )}
                              >
                                {m.status === 'active' ? '启用' : '停用'}
                              </span>
                            </td>
                            <td className="py-2.5 px-2 text-slate-600 text-xs max-w-[160px] truncate">
                              {m.benefits || <span className="text-slate-300">—</span>}
                            </td>
                            <td className="py-2.5 px-2 text-slate-600 text-xs max-w-[140px] truncate">
                              {m.remark || <span className="text-slate-300">—</span>}
                            </td>
                            <td className="py-2.5 px-2 text-right whitespace-nowrap">
                              <button
                                onClick={() => setEditing(m)}
                                disabled={busy}
                                className="text-brand-600 hover:text-brand-700 text-xs font-medium mr-3 disabled:opacity-50"
                              >
                                编辑
                              </button>
                              <button
                                onClick={() => handleDelete(m)}
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
                </div>
              )}
            </section>

            {/* ===== 区域二：学员会员卡记录 ===== */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-slate-700">
                  学员会员卡记录
                  <span className="ml-2 text-xs text-slate-400 font-normal">
                    共 {studentMemberships.length} 条
                  </span>
                </h2>
              </div>

              {studentMemberships.length === 0 ? (
                <EmptyState
                  title="暂无办卡记录"
                  description="点击「学员办卡」为学员办理会员卡"
                  action={
                    activeMemberships.length === 0 || students.length === 0 ? undefined : (
                      <Button variant="primary" onClick={() => setGranting(true)} disabled={busy}>
                        + 学员办卡
                      </Button>
                    )
                  }
                />
              ) : (
                <div className="card p-5">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500 text-xs">
                          <th className="text-left py-2 px-2 font-medium">学员</th>
                          <th className="text-left py-2 px-2 font-medium">卡名</th>
                          <th className="text-left py-2 px-2 font-medium">类型</th>
                          <th className="text-left py-2 px-2 font-medium">状态</th>
                          <th className="text-left py-2 px-2 font-medium">开始</th>
                          <th className="text-left py-2 px-2 font-medium">到期</th>
                          <th className="text-left py-2 px-2 font-medium">实付</th>
                          <th className="text-right py-2 px-2 font-medium">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {studentMemberships.map((sm) => (
                          <tr
                            key={sm.id}
                            className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                          >
                            <td className="py-2.5 px-2 font-medium text-slate-700">
                              {sm.studentName || <span className="text-slate-300">—</span>}
                            </td>
                            <td className="py-2.5 px-2 text-slate-600">
                              {sm.membershipName || <span className="text-slate-300">—</span>}
                            </td>
                            <td className="py-2.5 px-2 text-slate-600 text-xs">
                              {sm.membershipType
                                ? MEMBERSHIP_TYPE_LABEL[sm.membershipType as Membership['type']] || sm.membershipType
                                : <span className="text-slate-300">—</span>}
                            </td>
                            <td className="py-2.5 px-2">
                              <span
                                className={cn(
                                  'inline-block px-2 py-0.5 rounded-full text-xs',
                                  sm.status === 'active'
                                    ? 'bg-green-50 text-green-600'
                                    : 'bg-slate-100 text-slate-400',
                                )}
                              >
                                {sm.status === 'active' ? '有效' : '已过期'}
                              </span>
                            </td>
                            <td className="py-2.5 px-2 text-slate-600 text-xs whitespace-nowrap">
                              {sm.startedAt || <span className="text-slate-300">—</span>}
                            </td>
                            <td className="py-2.5 px-2 text-slate-600 text-xs whitespace-nowrap">
                              {sm.expiredAt || <span className="text-slate-300">—</span>}
                            </td>
                            <td className="py-2.5 px-2 text-slate-700 font-medium whitespace-nowrap">
                              ¥{sm.paidAmount}
                            </td>
                            <td className="py-2.5 px-2 text-right whitespace-nowrap">
                              <button
                                onClick={() => handleDeleteStudentMembership(sm)}
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
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {adding && (
        <MembershipEditModal onClose={() => setAdding(false)} onSubmit={handleAdd} />
      )}
      {editing && (
        <MembershipEditModal
          membership={editing}
          onClose={() => setEditing(null)}
          onSubmit={(data) => handleUpdate(editing.id, data)}
        />
      )}
      {granting && (
        <GrantModal
          students={students}
          memberships={activeMemberships}
          onClose={() => setGranting(false)}
          onSubmit={handleGrant}
        />
      )}
    </div>
  )
}

// ===== 新增/编辑会员卡弹窗 =====
interface MembershipEditModalProps {
  membership?: Membership
  onClose: () => void
  onSubmit: (data: MembershipForm) => Promise<boolean>
}

function MembershipEditModal({ membership, onClose, onSubmit }: MembershipEditModalProps) {
  const isEdit = !!membership
  const [form, setForm] = useState<MembershipForm>(
    membership
      ? {
          name: membership.name,
          type: membership.type,
          durationDays: membership.durationDays,
          price: membership.price,
          status: membership.status,
          benefits: membership.benefits || '',
          remark: membership.remark || '',
        }
      : {
          name: '',
          type: 'monthly',
          durationDays: 30,
          price: 0,
          status: 'active',
          benefits: '',
          remark: '',
        },
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const update = (patch: Partial<MembershipForm>) => {
    setForm((f) => ({ ...f, ...patch }))
    setErrors((e) => {
      const next = { ...e }
      for (const k of Object.keys(patch)) delete next[k]
      return next
    })
  }

  const setType = (value: string) => {
    if (value === 'monthly' || value === 'termly' || value === 'yearly' || value === 'count') {
      update({ type: value })
    }
  }

  const setStatus = (value: string) => {
    if (value === 'active' || value === 'disabled') update({ status: value })
  }

  const validate = (): boolean => {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = '名称不能为空'
    const durationNum = Number(form.durationDays)
    if (!Number.isFinite(durationNum) || durationNum < 1) {
      e.durationDays = '有效天数需为不小于 1 的整数'
    }
    const priceNum = Number(form.price)
    if (!Number.isFinite(priceNum) || priceNum < 0) e.price = '价格需为非负数'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const submit = async () => {
    if (!validate()) return
    setSaving(true)
    const data: MembershipForm = {
      name: form.name.trim(),
      type: form.type,
      durationDays: Math.max(1, Math.floor(Number(form.durationDays))),
      price: Number(form.price),
      status: form.status,
      benefits: form.benefits.trim(),
      remark: form.remark.trim(),
    }
    const ok = await onSubmit(data)
    setSaving(false)
    if (ok) onClose()
  }

  return (
    <Modal
      title={isEdit ? '编辑会员卡' : '新增会员卡'}
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
        {/* 名称 */}
        <Field label="名称" required error={errors.name}>
          <input
            type="text"
            className={inputClass}
            value={form.name}
            onChange={(e) => update({ name: e.target.value })}
            placeholder="如：月度畅学卡"
            autoFocus
          />
        </Field>

        {/* 类型 */}
        <Field label="类型">
          <select
            className={inputClass}
            value={form.type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="monthly">月卡</option>
            <option value="termly">期卡</option>
            <option value="yearly">年卡</option>
            <option value="count">次卡</option>
          </select>
        </Field>

        {/* 有效天数 */}
        <Field label="有效天数" required error={errors.durationDays} hint="自办卡日起有效的天数">
          <input
            type="number"
            min={1}
            value={form.durationDays}
            onChange={(e) => update({ durationDays: Number(e.target.value) })}
            className={inputClass}
          />
        </Field>

        {/* 价格 */}
        <Field label="价格" required error={errors.price} hint="该会员卡的标准售价">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-sm">¥</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={form.price}
              onChange={(e) => update({ price: Number(e.target.value) })}
              className={inputClass}
            />
          </div>
        </Field>

        {/* 状态 */}
        <Field label="状态">
          <select
            className={inputClass}
            value={form.status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="active">启用</option>
            <option value="disabled">停用</option>
          </select>
        </Field>

        {/* 权益 */}
        <Field label="权益" hint="该会员卡包含的权益说明">
          <textarea
            className={cn(inputClass, 'min-h-[72px] resize-y')}
            value={form.benefits}
            onChange={(e) => update({ benefits: e.target.value })}
            rows={3}
            placeholder="如：不限次上课、赠 2 节体验课"
          />
        </Field>

        {/* 备注 */}
        <Field label="备注">
          <textarea
            className={cn(inputClass, 'min-h-[60px] resize-y')}
            value={form.remark}
            onChange={(e) => update({ remark: e.target.value })}
            rows={2}
            placeholder="可选说明"
          />
        </Field>
      </div>
    </Modal>
  )
}

// ===== 学员办卡弹窗 =====
interface GrantModalProps {
  students: Student[]
  memberships: Membership[] // 仅启用
  onClose: () => void
  onSubmit: (input: {
    studentId: string
    membershipId: string
    paidAmount: number
    durationDays: number
  }) => Promise<boolean>
}

function GrantModal({ students, memberships, onClose, onSubmit }: GrantModalProps) {
  const [studentId, setStudentId] = useState('')
  const [membershipId, setMembershipId] = useState('')
  const [paidAmount, setPaidAmount] = useState(0)
  const [durationDays, setDurationDays] = useState(0)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const onMembershipChange = (id: string) => {
    setMembershipId(id)
    setErrors((e) => ({ ...e, membershipId: '' }))
    const m = memberships.find((x) => x.id === id)
    if (m) {
      setDurationDays(m.durationDays)
      setPaidAmount(m.price)
    }
  }

  const onStudentChange = (id: string) => {
    setStudentId(id)
    setErrors((e) => ({ ...e, studentId: '' }))
  }

  const validate = (): boolean => {
    const e: Record<string, string> = {}
    if (!studentId) e.studentId = '请选择学员'
    if (!membershipId) e.membershipId = '请选择会员卡'
    const paidNum = Number(paidAmount)
    if (!Number.isFinite(paidNum) || paidNum < 0) e.paidAmount = '实付金额需为非负数'
    const durNum = Number(durationDays)
    if (!Number.isFinite(durNum) || durNum < 1) e.durationDays = '有效天数需为不小于 1 的整数'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const submit = async () => {
    if (!validate()) return
    setSaving(true)
    const ok = await onSubmit({
      studentId,
      membershipId,
      paidAmount: Number(paidAmount),
      durationDays: Math.max(1, Math.floor(Number(durationDays))),
    })
    setSaving(false)
    if (ok) onClose()
  }

  const noStudents = students.length === 0
  const noMemberships = memberships.length === 0

  return (
    <Modal
      title="学员办卡"
      onClose={onClose}
      size="md"
      footer={
        <ModalFooter
          onCancel={onClose}
          onConfirm={submit}
          loading={saving}
          confirmText="确认办卡"
          confirmDisabled={noStudents || noMemberships}
        />
      }
    >
      <div className="space-y-4">
        {noStudents && (
          <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
            暂无学员数据，请先在学员管理中新增学员。
          </div>
        )}
        {noMemberships && (
          <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
            暂无可办理的会员卡，请先新增并启用会员卡类型。
          </div>
        )}

        {/* 选择学员 */}
        <Field label="学员" required error={errors.studentId}>
          <select
            className={inputClass}
            value={studentId}
            onChange={(e) => onStudentChange(e.target.value)}
            disabled={noStudents}
          >
            <option value="">请选择学员</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}{s.id ? `（${s.id}）` : ''}
              </option>
            ))}
          </select>
        </Field>

        {/* 选择会员卡 */}
        <Field label="会员卡" required error={errors.membershipId}>
          <select
            className={inputClass}
            value={membershipId}
            onChange={(e) => onMembershipChange(e.target.value)}
            disabled={noMemberships}
          >
            <option value="">请选择会员卡</option>
            {memberships.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}（{MEMBERSHIP_TYPE_LABEL[m.type]} / ¥{m.price} / {m.durationDays}天）
              </option>
            ))}
          </select>
        </Field>

        {/* 实付金额 */}
        <Field label="实付金额" required error={errors.paidAmount} hint="默认取会员卡标准价格，可按实际调整">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-sm">¥</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={paidAmount}
              onChange={(e) => setPaidAmount(Number(e.target.value))}
              className={inputClass}
            />
          </div>
        </Field>

        {/* 有效天数 */}
        <Field label="有效天数" required error={errors.durationDays} hint="默认取会员卡有效天数，自今日起计算到期日">
          <input
            type="number"
            min={1}
            value={durationDays}
            onChange={(e) => setDurationDays(Number(e.target.value))}
            className={inputClass}
          />
        </Field>
      </div>
    </Modal>
  )
}
