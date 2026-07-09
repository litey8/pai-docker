import { useCallback, useEffect, useState } from 'react'
import type { Coupon } from '@/types'
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
import { getCoupons, addCoupon, updateCoupon, deleteCoupon } from '@/api/admin'

interface CouponAdminProps {
  onBack: () => void
}

// 可编辑字段（不含后端生成/维护的 id/createdAt/usedCount）
type CouponForm = Omit<Coupon, 'id' | 'createdAt' | 'usedCount'>

export function CouponAdmin({ onBack }: CouponAdminProps) {
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Coupon | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const list = await getCoupons()
      setCoupons(list)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '加载优惠券失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleAdd = async (data: CouponForm): Promise<boolean> => {
    setBusy(true)
    try {
      const result = await addCoupon(data)
      if (result.code === 0) {
        toast.success('优惠券已创建')
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

  const handleUpdate = async (id: string, data: CouponForm): Promise<boolean> => {
    setBusy(true)
    try {
      const result = await updateCoupon(id, data)
      if (result.code === 0) {
        toast.success('优惠券已更新')
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

  const handleDelete = async (c: Coupon) => {
    const ok = await confirmDialog({
      title: '删除优惠券？',
      message: `确认删除优惠券「${c.name}」？该操作不可恢复。`,
      danger: true,
      confirmText: '确认删除',
    })
    if (!ok) return
    setBusy(true)
    try {
      const result = await deleteCoupon(c.id)
      if (result.code === 0) {
        toast.success('优惠券已删除')
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

  return (
    <div className="min-h-screen bg-slate-50">
      <SubPageHeader title="优惠券管理" onBack={onBack} count={coupons.length} countLabel="张">
        <Button variant="primary" onClick={() => setAdding(true)} disabled={busy}>
          + 新增优惠券
        </Button>
      </SubPageHeader>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {loading ? (
          <LoadingBlock />
        ) : coupons.length === 0 ? (
          <EmptyState
            title="暂无优惠券"
            description="新增优惠券后，可在报名/结算时使用"
            action={
              <Button variant="primary" onClick={() => setAdding(true)} disabled={busy}>
                + 新增第一张优惠券
              </Button>
            }
          />
        ) : (
          <section className="card p-5">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 text-xs">
                    <th className="text-left py-2 px-2 font-medium">优惠码</th>
                    <th className="text-left py-2 px-2 font-medium">名称</th>
                    <th className="text-left py-2 px-2 font-medium">类型</th>
                    <th className="text-left py-2 px-2 font-medium">优惠值</th>
                    <th className="text-left py-2 px-2 font-medium">使用</th>
                    <th className="text-left py-2 px-2 font-medium">有效期</th>
                    <th className="text-left py-2 px-2 font-medium">状态</th>
                    <th className="text-right py-2 px-2 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {coupons.map((c) => (
                    <tr
                      key={c.id}
                      className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                    >
                      <td className="py-2.5 px-2 font-mono text-xs text-slate-600">
                        {c.code || <span className="text-slate-300">—</span>}
                      </td>
                      <td className="py-2.5 px-2 font-medium text-slate-700">{c.name}</td>
                      <td className="py-2.5 px-2 text-slate-600 text-xs">
                        {c.type === 'discount' ? '折扣' : '满减'}
                      </td>
                      <td className="py-2.5 px-2 text-slate-600 whitespace-nowrap">
                        {c.type === 'discount' ? `${c.value}%` : `¥${c.value}`}
                        {c.type === 'amount' && c.minAmount > 0 && (
                          <span className="text-xs text-slate-400 ml-1">满{c.minAmount}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-2 text-slate-600 text-xs whitespace-nowrap">
                        {c.usageLimit > 0
                          ? `${c.usedCount}/${c.usageLimit}`
                          : <span className="text-slate-300">不限</span>}
                      </td>
                      <td className="py-2.5 px-2 text-slate-600 text-xs whitespace-nowrap">
                        {c.validFrom || c.validTo
                          ? `${c.validFrom || '?'} ~ ${c.validTo || '?'}`
                          : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="py-2.5 px-2">
                        <span
                          className={cn(
                            'inline-block px-2 py-0.5 rounded-full text-xs',
                            c.status === 'active'
                              ? 'bg-green-50 text-green-600'
                              : 'bg-slate-100 text-slate-400',
                          )}
                        >
                          {c.status === 'active' ? '启用' : '停用'}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-right whitespace-nowrap">
                        <button
                          onClick={() => setEditing(c)}
                          disabled={busy}
                          className="text-brand-600 hover:text-brand-700 text-xs font-medium mr-3 disabled:opacity-50"
                        >
                          编辑
                        </button>
                        <button
                          onClick={() => handleDelete(c)}
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
          </section>
        )}
      </main>

      {adding && (
        <CouponEditModal onClose={() => setAdding(false)} onSubmit={handleAdd} />
      )}
      {editing && (
        <CouponEditModal
          coupon={editing}
          onClose={() => setEditing(null)}
          onSubmit={(data) => handleUpdate(editing.id, data)}
        />
      )}
    </div>
  )
}

// ===== 新增/编辑优惠券弹窗 =====
interface CouponEditModalProps {
  coupon?: Coupon // 有值 = 编辑模式；无值 = 新增模式
  onClose: () => void
  onSubmit: (data: CouponForm) => Promise<boolean>
}

function CouponEditModal({ coupon, onClose, onSubmit }: CouponEditModalProps) {
  const isEdit = !!coupon
  const [form, setForm] = useState<CouponForm>(
    coupon
      ? {
          code: coupon.code || '',
          name: coupon.name,
          type: coupon.type,
          value: coupon.value,
          minAmount: coupon.minAmount,
          validFrom: coupon.validFrom || '',
          validTo: coupon.validTo || '',
          usageLimit: coupon.usageLimit,
          status: coupon.status,
          remark: coupon.remark || '',
        }
      : {
          code: '',
          name: '',
          type: 'discount',
          value: 0,
          minAmount: 0,
          validFrom: '',
          validTo: '',
          usageLimit: 0,
          status: 'active',
          remark: '',
        },
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const update = (patch: Partial<CouponForm>) => {
    setForm((f) => ({ ...f, ...patch }))
    setErrors((e) => {
      const next = { ...e }
      for (const k of Object.keys(patch)) delete next[k]
      return next
    })
  }

  const setType = (value: string) => {
    if (value === 'discount' || value === 'amount') update({ type: value })
  }

  const setStatus = (value: string) => {
    if (value === 'active' || value === 'disabled') update({ status: value })
  }

  const validate = (): boolean => {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = '名称不能为空'
    const valueNum = Number(form.value)
    if (!Number.isFinite(valueNum) || valueNum < 0) {
      e.value = '优惠值需为非负数'
    } else if (form.type === 'discount' && valueNum > 100) {
      e.value = '折扣比例不能超过 100'
    }
    const minNum = Number(form.minAmount)
    if (!Number.isFinite(minNum) || minNum < 0) e.minAmount = '门槛金额需为非负数'
    const usageNum = Number(form.usageLimit)
    if (!Number.isFinite(usageNum) || usageNum < 0) e.usageLimit = '使用次数需为非负数'
    if (form.validFrom && form.validTo && form.validFrom > form.validTo) {
      e.validTo = '结束日期不能早于开始日期'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const submit = async () => {
    if (!validate()) return
    setSaving(true)
    const data: CouponForm = {
      code: form.code.trim(),
      name: form.name.trim(),
      type: form.type,
      value: Number(form.value),
      minAmount: Number(form.minAmount),
      validFrom: form.validFrom,
      validTo: form.validTo,
      usageLimit: Number(form.usageLimit),
      status: form.status,
      remark: form.remark.trim(),
    }
    const ok = await onSubmit(data)
    setSaving(false)
    if (ok) onClose()
  }

  return (
    <Modal
      title={isEdit ? '编辑优惠券' : '新增优惠券'}
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
        {/* 优惠码 */}
        <Field label="优惠码" hint="留空则由系统生成">
          <input
            type="text"
            className={inputClass}
            value={form.code}
            onChange={(e) => update({ code: e.target.value })}
            placeholder="如：NEW100"
            autoFocus
          />
        </Field>

        {/* 名称 */}
        <Field label="名称" required error={errors.name}>
          <input
            type="text"
            className={inputClass}
            value={form.name}
            onChange={(e) => update({ name: e.target.value })}
            placeholder="如：新用户满减券"
          />
        </Field>

        {/* 类型 */}
        <Field label="类型">
          <select
            className={inputClass}
            value={form.type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="discount">折扣（按比例）</option>
            <option value="amount">满减（按金额）</option>
          </select>
        </Field>

        {/* 优惠值 */}
        <Field
          label="优惠值"
          required
          error={errors.value}
          hint={form.type === 'discount' ? '折扣百分比，如 85 表示 8.5 折' : '减免金额，单位元'}
        >
          <div className="flex items-center gap-2">
            {form.type === 'amount' && <span className="text-slate-400 text-sm">¥</span>}
            <input
              type="number"
              min={0}
              step={form.type === 'discount' ? 1 : 0.01}
              value={form.value}
              onChange={(e) => update({ value: Number(e.target.value) })}
              className={inputClass}
            />
            {form.type === 'discount' && <span className="text-slate-400 text-sm">%</span>}
          </div>
        </Field>

        {/* 使用门槛 */}
        <Field label="使用门槛" error={errors.minAmount} hint="满减券的最低消费金额，0 表示无门槛">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-sm">¥</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={form.minAmount}
              onChange={(e) => update({ minAmount: Number(e.target.value) })}
              className={inputClass}
            />
          </div>
        </Field>

        {/* 有效期 */}
        <div className="flex items-start gap-4">
          <Field label="开始日期" className="flex-1">
            <input
              type="date"
              className={inputClass}
              value={form.validFrom}
              onChange={(e) => update({ validFrom: e.target.value })}
            />
          </Field>
          <Field label="结束日期" error={errors.validTo} className="flex-1">
            <input
              type="date"
              className={inputClass}
              value={form.validTo}
              onChange={(e) => update({ validTo: e.target.value })}
            />
          </Field>
        </div>

        {/* 使用次数 */}
        <Field label="使用次数" error={errors.usageLimit} hint="0 表示不限次数">
          <input
            type="number"
            min={0}
            value={form.usageLimit}
            onChange={(e) => update({ usageLimit: Number(e.target.value) })}
            className={inputClass}
          />
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

        {/* 备注 */}
        <Field label="备注">
          <textarea
            className={cn(inputClass, 'min-h-[72px] resize-y')}
            value={form.remark}
            onChange={(e) => update({ remark: e.target.value })}
            rows={3}
            placeholder="可选说明"
          />
        </Field>
      </div>
    </Modal>
  )
}
