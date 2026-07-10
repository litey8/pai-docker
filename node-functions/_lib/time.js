// 本地时间工具 —— 统一基于 TZ 环境变量生成可读的本地时间字符串
//
// 背景：SQLite 的 datetime('now') 与 JS 的 new Date().toISOString() 均固定返回 UTC，
// 不会随 TZ 环境变量变化，导致后台显示的时间始终是 UTC。本模块用本地时间方法
// (toLocaleString 系列，受 TZ 控制) 生成 'yyyy-MM-dd HH:mm:ss' / 'yyyy-MM-dd' 字符串，
// 供所有写入数据库的时间字段统一使用，确保全系统时间一致且符合设置的当地时区。
//
// 说明：
// - 存储统一使用本地时间字符串（无时区后缀），与历史 datetime('now') 产出的 UTC 字符串
//   在格式上完全兼容（都是 'yyyy-MM-dd HH:mm:ss'），排序、范围比较均不受影响。
// - 新旧数据可能并存（旧 UTC / 新本地），由于本系统为单时区自部署场景，差异通常为几小时，
//   不影响业务正确性；后续写入将全部为本地时间。

// 返回本地时间字符串 'yyyy-MM-dd HH:mm:ss'（受 TZ 环境变量控制）
export function nowLocal() {
  return formatLocal(new Date(), 'yyyy-MM-dd HH:mm:ss')
}

// 返回本地日期字符串 'yyyy-MM-dd'（受 TZ 环境变量控制）
export function todayLocal() {
  return formatLocal(new Date(), 'yyyy-MM-dd')
}

// 将任意 Date 格式化为本地时间字符串
// 支持 pattern: 'yyyy-MM-dd HH:mm:ss' | 'yyyy-MM-dd' | 'yyyy-MM-dd HH:mm'
export function formatLocal(date, pattern = 'yyyy-MM-dd HH:mm:ss') {
  const d = date instanceof Date ? date : new Date(date)
  // 用本地方法取各分量（受 TZ 控制）
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const da = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  const s = String(d.getSeconds()).padStart(2, '0')
  if (pattern === 'yyyy-MM-dd') return `${y}-${mo}-${da}`
  if (pattern === 'yyyy-MM-dd HH:mm') return `${y}-${mo}-${da} ${h}:${mi}`
  return `${y}-${mo}-${da} ${h}:${mi}:${s}`
}

// SQLite 表达式：返回本地时间，用于建表 DEFAULT 与显式 INSERT
// datetime('now','localtime') 受 TZ 环境变量控制（经 C 库 localtime）
export const SQLITE_LOCAL_NOW = "datetime('now', 'localtime')"
