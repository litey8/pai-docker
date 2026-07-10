// BI 数据看板 —— 复用报表后端，汇总营收 / 课时消耗 / 报名数 / 转化率 + 营收趋势明细
import { useEffect, useState } from 'react'
import type { ReportQuery } from '@/types'
import { getReport, getLeads } from '@/api/admin'
import {
  Button,
  EmptyState,
  LoadingBlock,
  SubPageHeader,
  inputClass,
  toast,
} from '@/components/ui'

interface DashboardAdminProps {
  onBack: () => void
}

interface SummaryData {
  revenue: number
  hoursConsumed: number
  enrollmentCount: number
  leadsCount: number
  conversionRate: number | null // 报名数 / 线索数（无线索时为 null）
}

interface TrendRow {
  key: string
  revenue: number
  count: number
}

// 取本月日期范围：startDate=月初，endDate=月末
function currentMonthRange(): { startDate: string; endDate: string } {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth() // 0-based
  const start = new Date(y, m, 1)
  const end = new Date(y, m + 1, 0) // 当月最后一天
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return { startDate: fmt(start), endDate: fmt(end) }
}

function formatYuan(v: number): string {
  return '¥' + (Number.isFinite(v) ? v.toFixed(2) : '0.00')
}

function formatPercent(rate: number | null): string {
  if (rate === null) return '—'
  return (rate * 100).toFixed(1) + '%'
}

export function DashboardAdmin({ onBack }: DashboardAdminProps) {
  const init = currentMonthRange()
  const [startDate, setStartDate] = useState(init.startDate)
  const [endDate, setEndDate] = useState(init.endDate)

  const [summary, setSummary] = useState<SummaryData | null>(null)
  const [trend, setTrend] = useState<TrendRow[]>([])
  const [loading, setLoading] = useState(true)
  // 查询触发器：点「查询」自增；改日期不自动查
  const [queryTick, setQueryTick] = useState(0)

  async function load() {
    setLoading(true)
    try {
      const baseQuery = { startDate, endDate }
      // 并发拉取：营收 / 课时消耗 / 报名数 / 营收按月趋势 / 线索数
      const [revRes, hoursRes, enrollRes, trendRes, leads] = await Promise.all([
        getReport({ type: 'revenue', ...baseQuery } as ReportQuery),
        getReport({ type: 'hours-consumption', ...baseQuery } as ReportQuery),
        getReport({ type: 'enrollment-stats', ...baseQuery } as ReportQuery),
        getReport({ type: 'revenue', ...baseQuery, groupBy: 'month' } as ReportQuery),
        getLeads(),
      ])

      if (revRes.code !== 0) throw new Error(revRes.message || '营收查询失败')
      if (hoursRes.code !== 0) throw new Error(hoursRes.message || '课时消耗查询失败')
      if (enrollRes.code !== 0) throw new Error(enrollRes.message || '报名统计查询失败')
      if (trendRes.code !== 0) throw new Error(trendRes.message || '趋势查询失败')

      const revenue = Number(revRes.data.summary?.revenue ?? 0)
      const hoursConsumed = Number(hoursRes.data.summary?.consumed ?? 0)
      const enrollmentCount = Number(enrollRes.data.summary?.count ?? 0)
      const leadsCount = Array.isArray(leads) ? leads.length : 0
      const conversionRate =
        leadsCount > 0 ? enrollmentCount / leadsCount : null

      setSummary({ revenue, hoursConsumed, enrollmentCount, leadsCount, conversionRate })

      const trendRows: TrendRow[] = (trendRes.data.rows || []).map((r) => ({
        key: String(r.key ?? ''),
        revenue: Number(r.revenue ?? 0),
        count: Number(r.count ?? 0),
      }))
      setTrend(trendRows)
    } catch (e) {
      toast.error((e as Error).message || '加载看板失败')
      setSummary(null)
      setTrend([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // startDate/endDate 故意不列入依赖：改日期不自动查询
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryTick])

  const handleQuery = () => setQueryTick((t) => t + 1)

  return (
    <div className="min-h-screen bg-slate-50">
      <SubPageHeader title={'数据看板'} onBack={onBack} />

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        {/* 日期筛选 */}
        <section className="card p-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 w-40">
              <span className="text-xs text-slate-500">{'开始日期'}</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1 w-40">
              <span className="text-xs text-slate-500">{'结束日期'}</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={inputClass}
              />
            </label>
            <Button variant="primary" loading={loading} onClick={handleQuery}>
              {'查询'}
            </Button>
          </div>
        </section>

        {/* summary 卡片 */}
        {loading ? (
          <LoadingBlock />
        ) : summary ? (
          <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="card p-5">
              <div className="text-xs text-slate-500">{'总营收'}</div>
              <div className="text-2xl font-semibold text-slate-800 mt-1">
                {formatYuan(summary.revenue)}
              </div>
            </div>
            <div className="card p-5">
              <div className="text-xs text-slate-500">{'课时消耗'}</div>
              <div className="text-2xl font-semibold text-slate-800 mt-1">
                {summary.hoursConsumed}
              </div>
            </div>
            <div className="card p-5">
              <div className="text-xs text-slate-500">{'报名数'}</div>
              <div className="text-2xl font-semibold text-slate-800 mt-1">
                {summary.enrollmentCount}
              </div>
            </div>
            <div className="card p-5">
              <div className="text-xs text-slate-500">{'转化率'}</div>
              <div className="text-2xl font-semibold text-slate-800 mt-1">
                {formatPercent(summary.conversionRate)}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                报名 {summary.enrollmentCount} / 线索 {summary.leadsCount}
              </div>
            </div>
          </section>
        ) : (
          <EmptyState title={'暂无数据'} description="尝试调整日期范围后重新查询" />
        )}

        {/* 营收趋势明细（按月） */}
        {loading ? (
          <LoadingBlock label="加载趋势…" />
        ) : trend.length > 0 ? (
          <section className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-700">{'营收趋势'}（按月）</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs">
                    <th className="text-left font-medium px-4 py-2.5 whitespace-nowrap">月份</th>
                    <th className="text-left font-medium px-4 py-2.5 whitespace-nowrap">营收(¥)</th>
                    <th className="text-left font-medium px-4 py-2.5 whitespace-nowrap">笔数</th>
                  </tr>
                </thead>
                <tbody>
                  {trend.map((r) => (
                    <tr key={r.key} className="border-t border-slate-100">
                      <td className="px-4 py-2.5 text-slate-700 whitespace-nowrap">
                        {r.key || '—'}
                      </td>
                      <td className="px-4 py-2.5 text-slate-700 whitespace-nowrap">
                        {formatYuan(r.revenue)}
                      </td>
                      <td className="px-4 py-2.5 text-slate-700 whitespace-nowrap">{r.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : (
          !loading && (
            <EmptyState title="暂无趋势数据" description="所选日期范围内无营收记录" />
          )
        )}
      </main>
    </div>
  )
}
