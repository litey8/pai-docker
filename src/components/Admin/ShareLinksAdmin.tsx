import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { Student } from '@/types'
import { Button, EmptyState, SubPageHeader, inputClass } from '@/components/ui'

interface ShareLinksAdminProps {
  students: Student[]
  onBack: () => void
}

// 分享链接管理页
// - 遍历所有学员，为每个学员生成专属排课查看链接
// - 链接格式：{origin}/?s=学员id
// - 支持按姓名/ID 搜索过滤
// - 支持单条复制、一键复制全部
export function ShareLinksAdmin({ students, onBack }: ShareLinksAdminProps) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [copiedAll, setCopiedAll] = useState(false)

  // 站点根地址：生产环境自动获取当前域名，无需配置
  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  // 为学员生成专属链接
  const buildLink = (s: Student) =>
    `${origin}/?s=${encodeURIComponent(s.id)}`

  // 搜索过滤：按姓名或 ID 模糊匹配
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return students
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q),
    )
  }, [students, search])

  // 单条复制（格式与一键复制全部一致：姓名：链接）
  const handleCopy = async (s: Student) => {
    const text = `${s.name}：${buildLink(s)}`
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(s.id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      // clipboard API 不可用时回退到选中提示
      fallbackCopy(text)
      setCopiedId(s.id)
      setTimeout(() => setCopiedId(null), 2000)
    }
  }

  // 一键复制全部（按行格式：姓名：链接）
  const handleCopyAll = async () => {
    const text = filtered.map((s) => `${s.name}：${buildLink(s)}`).join('\n')
    try {
      await navigator.clipboard.writeText(text)
      setCopiedAll(true)
      setTimeout(() => setCopiedAll(false), 2000)
    } catch {
      fallbackCopy(text)
      setCopiedAll(true)
      setTimeout(() => setCopiedAll(false), 2000)
    }
  }

  // 回退复制方案：创建临时 textarea 触发 execCommand
  const fallbackCopy = (text: string) => {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    } catch {
      // 忽略
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <SubPageHeader title={t('shareLinks.title')} onBack={onBack} count={students.length} countLabel="人" />

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        {/* 说明 */}
        <section className="card p-4">
          <div className="text-xs text-slate-500 leading-relaxed">
            为每位学员生成专属排课查看链接，家长点击即可直接查看该学员的排课日历，无需登录或搜索。
            链接格式：<code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-mono">域名/?s=学员id</code>
          </div>
        </section>

        {/* 搜索 + 批量操作 */}
        <section className="card p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('shareLinks.searchPlaceholder')}
                className={inputClass}
              />
              <span className="text-xs text-slate-400 whitespace-nowrap">
                共 {filtered.length} 人
              </span>
            </div>
            <Button
              variant="primary"
              onClick={handleCopyAll}
              disabled={filtered.length === 0}
              className="whitespace-nowrap"
            >
              {copiedAll ? t('shareLinks.copiedAll') : t('shareLinks.copyAll')}
            </Button>
          </div>
        </section>

        {/* 链接列表 */}
        {filtered.length > 0 ? (
          <section className="card p-0 overflow-hidden">
            {/* 桌面端表格 */}
            <table className="w-full text-sm hidden sm:table">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs">
                <tr>
                  <th className="text-left py-2 px-4 font-medium">{t('student.name')}</th>
                  <th className="text-left py-2 px-4 font-medium">ID</th>
                  <th className="text-left py-2 px-4 font-medium">{t('shareLinks.title')}</th>
                  <th className="text-right py-2 px-4 font-medium">{t('common.operation')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-4 font-medium text-slate-800 whitespace-nowrap">
                      {s.name}
                    </td>
                    <td className="py-2.5 px-4 text-slate-500 font-mono text-xs">
                      {s.id}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600 text-xs font-mono break-all">
                      {buildLink(s)}
                    </td>
                    <td className="py-2.5 px-4 text-right whitespace-nowrap">
                      <button
                        onClick={() => handleCopy(s)}
                        className="btn-ghost border border-slate-200 text-xs py-1 px-2.5 hover:bg-brand-50 hover:text-brand-700 hover:border-brand-200"
                      >
                        {copiedId === s.id ? t('shareLinks.copied') : t('shareLinks.copy')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* 移动端卡片列表 */}
            <div className="sm:hidden divide-y divide-slate-100">
              {filtered.map((s) => (
                <div key={s.id} className="p-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-800 truncate">
                        {s.name}
                      </div>
                      <div className="text-xs text-slate-400 font-mono truncate">
                        {s.id}
                      </div>
                    </div>
                    <button
                      onClick={() => handleCopy(s)}
                      className="btn-ghost border border-slate-200 text-xs py-1 px-2.5 hover:bg-brand-50 hover:text-brand-700 hover:border-brand-200 flex-shrink-0"
                    >
                      {copiedId === s.id ? t('shareLinks.copied') : t('shareLinks.copy')}
                    </button>
                  </div>
                  <div className="text-xs text-slate-500 font-mono break-all bg-slate-50 rounded p-2">
                    {buildLink(s)}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : (
          <EmptyState title={students.length === 0 ? t('shareLinks.noStudents') : t('shareLinks.noMatch')} />
        )}
      </main>
    </div>
  )
}
