// 时间工具 —— 统一以 UTC 存储时间
//
// 设计原则：
// - 数据库统一存储 UTC 时间字符串（'yyyy-MM-dd HH:mm:ss'），与 SQLite datetime('now') 一致
// - 不受服务器 TZ 环境变量影响，部署在任何地区都存储同一基准时间
// - 前端显示时按浏览器本地时区转换（国内访问即显示北京时间）
//
// 说明：
// - SQLite 表 DEFAULT 使用 datetime('now')（UTC）
// - JS 写入用 nowUtc()，返回 'yyyy-MM-dd HH:mm:ss' 的 UTC 字符串
// - 纯日期字段（如排课 date、有效期 expiredAt、生日 birthday）不参与时区转换，
//   按业务语义直接存储用户输入的日期字符串

// 返回当前 UTC 时间字符串 'yyyy-MM-dd HH:mm:ss'
export function nowUtc() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ')
}

// 返回当前 UTC 日期字符串 'yyyy-MM-dd'
export function todayUtc() {
  return new Date().toISOString().slice(0, 10)
}
