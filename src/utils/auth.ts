// 判断是否为 401 类鉴权错误（API 层 401 会抛出 message 含"未登录"的 Error）
export function isAuthError(e: Error): boolean {
  const msg = e.message || ''
  return msg.includes('未登录') || msg.includes('登录已过期') || msg.includes('401')
}
