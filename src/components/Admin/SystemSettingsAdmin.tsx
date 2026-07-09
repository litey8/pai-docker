// 系统设置二级页面：修改项目名称等系统配置
import { useState, useEffect } from 'react'
import { getConfig } from '@/api'
import { updateConfig } from '@/api/admin'
import { setAppName as setAppNameConfig } from '@/config'

interface SystemSettingsAdminProps {
  // 配置变更后通知父级刷新（如项目名称变更需更新页头）
  onConfigChanged?: (appName: string) => void
  onBack: () => void
  busy: boolean
  setBusy: (b: boolean) => void
  showToast: (type: 'success' | 'error' | 'info', message: string) => void
}

export function SystemSettingsAdmin({
  onConfigChanged,
  onBack,
  busy,
  setBusy,
  showToast,
}: SystemSettingsAdminProps) {
  const [appName, setAppName] = useState('')
  const [originalAppName, setOriginalAppName] = useState('')
  const [loading, setLoading] = useState(true)

  // 进入页面时加载当前配置
  useEffect(() => {
    let active = true
    getConfig()
      .then((cfg) => {
        if (!active) return
        setAppName(cfg.appName)
        setOriginalAppName(cfg.appName)
      })
      .catch(() => {
        if (active) showToast('error', '加载配置失败')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const dirty = appName !== originalAppName

  const handleSave = async () => {
    const trimmed = appName.trim()
    if (!trimmed) {
      showToast('error', '项目名称不能为空')
      return
    }
    if (trimmed.length > 50) {
      showToast('error', '项目名称不能超过 50 个字符')
      return
    }
    setBusy(true)
    try {
      const result = await updateConfig({ appName: trimmed })
      if (result.code === 0) {
        setOriginalAppName(trimmed)
        setAppNameConfig(trimmed)
        onConfigChanged?.(trimmed)
        showToast('success', '项目名称已更新')
      } else {
        showToast('error', result.message || '保存失败')
      }
    } catch (e) {
      showToast('error', '请求失败：' + (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const handleReset = () => {
    setAppName(originalAppName)
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* 顶部栏 */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="btn-ghost -ml-2 px-2"
              title="返回"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <h1 className="text-lg font-semibold text-slate-800">系统设置</h1>
          </div>
          <div className="flex items-center gap-2">
            {dirty && !busy && (
              <button onClick={handleReset} className="btn-ghost text-sm">
                撤销
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={!dirty || busy}
              className="btn-primary text-sm py-1.5 px-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? '保存中…' : '保存'}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {loading ? (
          <div className="card p-16 flex flex-col items-center justify-center">
            <div className="w-8 h-8 border-2 border-slate-200 border-t-brand-500 rounded-full animate-spin mb-2" />
            <span className="text-sm text-slate-400">加载中…</span>
          </div>
        ) : (
          <>
            {/* 项目名称设置 */}
            <section className="card p-5">
              <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2 mb-1">
                <span className="w-1 h-4 bg-brand-500 rounded"></span>
                项目名称
              </h2>
              <p className="text-xs text-slate-500 mb-4 ml-3">
                显示在首页标题、页脚与浏览器标签页。修改后立即生效，无需重启服务。
              </p>
              <div className="ml-3">
                <input
                  type="text"
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                  placeholder="请输入项目名称"
                  maxLength={50}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
                />
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-xs text-slate-400">
                    {appName.length}/50
                  </span>
                  {dirty && (
                    <span className="text-xs text-amber-600">未保存的修改</span>
                  )}
                </div>
              </div>
            </section>

            {/* 说明 */}
            <section className="card p-5 bg-slate-50 border-slate-200">
              <div className="flex gap-2.5 text-sm text-slate-600">
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="space-y-1 text-xs">
                  <p className="font-medium text-slate-600">配置说明</p>
                  <ul className="space-y-0.5 text-slate-500">
                    <li>· 所有配置存储在 SQLite 数据库中，容器重建后仍保留</li>
                    <li>· 项目名称修改后，已打开的页面需刷新才能看到更新</li>
                    <li>· 后续将支持更多系统配置项（如主题色、时区等）</li>
                  </ul>
                </div>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  )
}
