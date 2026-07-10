// 时区显示工具 —— 将后端存储的 UTC 时间字符串转换为浏览器本地时区显示
//
// 设计原则：
// - 后端统一存储 UTC（datetime('now') / nowUtc() 产出 'yyyy-MM-dd HH:mm:ss' 无时区后缀的 UTC 字符串）
// - 前端显示时按浏览器本地时区转换（国内访问即北京时间，海外访问即当地时间）
// - 服务器部署在任意地区都不影响，显示时间由访问者的浏览器时区决定
//
// 字段分类：
// - 时间戳字段（created_at / enrolled_at / updated_at / 审计时间 / 备份时间）：UTC 存储 → 本地显示
// - 纯日期字段（排课 date / expiredAt / birthday）：按业务语义存储用户输入值，不做时区转换

/**
 * 将后端存储的 UTC 时间字符串解析为 Date 对象。
 * 后端格式为 'yyyy-MM-dd HH:mm:ss' 或 'yyyy-MM-ddTHH:mm:ss' 或 'yyyy-MM-dd'（均无时区后缀，按 UTC 处理）。
 * 传空值返回 null。
 */
export function parseUtc(value: string | null | undefined): Date | null {
  if (!value) return null
  // 兼容 'yyyy-MM-dd HH:mm:ss' / 'yyyy-MM-ddTHH:mm:ss' / 'yyyy-MM-dd'
  // 把空格分隔符换成 T，再补 Z 后缀，让 JS 按 UTC 解析
  const normalized = value.replace(' ', 'T')
  // 已带时区（Z 或 +xx:xx）则原样解析
  if (/([zZ]|[+-]\d{2}:?\d{2})$/.test(normalized)) {
    const d = new Date(normalized)
    return Number.isNaN(d.getTime()) ? null : d
  }
  const d = new Date(normalized + 'Z')
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * 将 UTC 时间字符串格式化为本地时区的 'yyyy-MM-dd HH:mm' 显示。
 * 用于审计日志、报名时间等列表展示。
 */
export function fmtDateTime(value: string | null | undefined): string {
  const d = parseUtc(value)
  if (!d) return '—'
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const da = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${mo}-${da} ${h}:${mi}`
}

/**
 * 将 UTC 时间字符串格式化为本地时区的 'yyyy-MM-dd HH:mm:ss' 显示（含秒）。
 */
export function fmtDateTimeFull(value: string | null | undefined): string {
  const d = parseUtc(value)
  if (!d) return '—'
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const da = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  const s = String(d.getSeconds()).padStart(2, '0')
  return `${y}-${mo}-${da} ${h}:${mi}:${s}`
}

/**
 * 将 UTC 时间字符串格式化为本地时区的 'yyyy-MM-dd' 日期显示。
 * 用于带时间的字段只展示日期的场景。
 */
export function fmtDate(value: string | null | undefined): string {
  const d = parseUtc(value)
  if (!d) return '—'
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const da = String(d.getDate()).padStart(2, '0')
  return `${y}-${mo}-${da}`
}

/**
 * 获取浏览器当前时区显示名（如 'Asia/Shanghai (UTC+8)'）。
 * 用于界面提示用户当前显示所基于的时区。
 */
export function browserTimezoneLabel(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    const offset = -new Date().getTimezoneOffset() / 60
    const sign = offset >= 0 ? '+' : ''
    return `${tz} (UTC${sign}${offset})`
  } catch {
    return 'UTC'
  }
}
