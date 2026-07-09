import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { login } from '@/api/admin'
import { Button, Field, inputClass } from '@/components/ui'

interface AdminLoginProps {
  onSuccess: () => void
  onExit: () => void
}

export function AdminLogin({ onSuccess, onExit }: AdminLoginProps) {
  const { t } = useTranslation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username) {
      setError(t('auth.usernamePlaceholder'))
      return
    }
    if (!password) {
      setError(t('auth.passwordPlaceholder'))
      return
    }
    setLoading(true)
    setError('')
    try {
      const result = await login(username, password)
      if (result.code === 0) {
        onSuccess()
      } else {
        setError(result.message)
      }
    } catch (e) {
      setError(t('common.requestFailed') + '：' + (e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        {/* 头部 */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-800 flex items-center justify-center text-white mb-4">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-slate-800">{t('auth.loginTitle')}</h1>
          <p className="text-sm text-slate-400 mt-1">请输入用户名与密码</p>
        </div>

        {/* 表单 */}
        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          <Field label={t('auth.username')} required>
            <input
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value)
                setError('')
              }}
              placeholder={t('auth.usernamePlaceholder')}
              autoFocus
              className={inputClass}
            />
          </Field>

          <Field label={t('auth.password')} required>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setError('')
              }}
              placeholder={t('auth.passwordPlaceholder')}
              className={inputClass}
            />
          </Field>

          {error && (
            <div className="bg-rose-50 border border-rose-200 rounded-md px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          )}

          <Button type="submit" variant="primary" loading={loading} className="w-full">
            {loading ? '登录中…' : t('auth.login')}
          </Button>

          <Button type="button" variant="ghost" onClick={onExit} className="w-full">
            返回首页
          </Button>
        </form>
      </div>
    </div>
  )
}
