// 时区显示工具 —— 将后端存储的 UTC 时间字符串按项目设置的时区显示
//
// 设计原则：
// - 后端统一存储 UTC（datetime('now') / nowUtc() 产出 'yyyy-MM-dd HH:mm:ss' 无时区后缀的 UTC 字符串）
// - 前端按项目配置的时区显示（默认 Asia/Shanghai），与访问者浏览器时区无关
// - 服务器部署在任意地区、用户在任意地区访问，看到的时间都是项目设置时区的时间
//
// 字段分类：
// - 时间戳字段（created_at / enrolled_at / updated_at / 审计时间 / 备份时间）：UTC 存储 → 项目时区显示
// - 纯日期字段（排课 date / expiredAt / birthday）：按业务语义存储用户输入值，不做时区转换

// 项目显示时区（由 App 启动时从后端配置加载并设置，默认 Asia/Shanghai）
let displayTimezone = 'Asia/Shanghai'

export function setDisplayTimezone(tz: string): void {
  if (tz && tz.trim()) {
    try {
      Intl.DateTimeFormat('en-US', { timeZone: tz.trim() })
      displayTimezone = tz.trim()
    } catch {
      // 非法时区标识，保持默认
    }
  }
}

export function getDisplayTimezone(): string {
  return displayTimezone
}

/**
 * 将后端存储的 UTC 时间字符串解析为 Date 对象。
 * 后端格式为 'yyyy-MM-dd HH:mm:ss' 或 'yyyy-MM-ddTHH:mm:ss' 或 'yyyy-MM-dd'（均无时区后缀，按 UTC 处理）。
 * 传空值返回 null。
 */
export function parseUtc(value: string | null | undefined): Date | null {
  if (!value) return null
  const normalized = value.replace(' ', 'T')
  if (/([zZ]|[+-]\d{2}:?\d{2})$/.test(normalized)) {
    const d = new Date(normalized)
    return Number.isNaN(d.getTime()) ? null : d
  }
  const d = new Date(normalized + 'Z')
  return Number.isNaN(d.getTime()) ? null : d
}

// 用 Intl.DateTimeFormat 在目标时区下提取各分量，再手工拼接成 'yyyy-MM-dd HH:mm' 等格式
function partsInTz(d: Date): { y: string; mo: string; da: string; h: string; mi: string; s: string } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: displayTimezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  const parts = fmt.formatToParts(d)
  const map: Record<string, string> = {}
  for (const p of parts) {
    if (p.type !== 'literal') map[p.type] = p.value
  }
  // hour12: false 在某些环境可能返回 '24'，规整为 '00'
  const h = map.hour === '24' ? '00' : (map.hour || '00')
  return { y: map.year || '1970', mo: map.month || '01', da: map.day || '01', h, mi: map.minute || '00', s: map.second || '00' }
}

/**
 * 将 UTC 时间字符串格式化为项目时区的 'yyyy-MM-dd HH:mm' 显示。
 */
export function fmtDateTime(value: string | null | undefined): string {
  const d = parseUtc(value)
  if (!d) return '—'
  const p = partsInTz(d)
  return `${p.y}-${p.mo}-${p.da} ${p.h}:${p.mi}`
}

/**
 * 将 UTC 时间字符串格式化为项目时区的 'yyyy-MM-dd HH:mm:ss' 显示（含秒）。
 */
export function fmtDateTimeFull(value: string | null | undefined): string {
  const d = parseUtc(value)
  if (!d) return '—'
  const p = partsInTz(d)
  return `${p.y}-${p.mo}-${p.da} ${p.h}:${p.mi}:${p.s}`
}

/**
 * 将 UTC 时间字符串格式化为项目时区的 'yyyy-MM-dd' 日期显示。
 */
export function fmtDate(value: string | null | undefined): string {
  const d = parseUtc(value)
  if (!d) return '—'
  const p = partsInTz(d)
  return `${p.y}-${p.mo}-${p.da}`
}

/**
 * 获取项目显示时区的标签（如 'Asia/Shanghai'）。
 */
export function timezoneLabel(): string {
  return displayTimezone
}
