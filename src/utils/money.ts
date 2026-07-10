// 金额格式化：四舍五入到 2 位，整数显示 ¥200，非整数显示 ¥200.50
export function formatMoney(value: number): string {
  if (!Number.isFinite(value)) return '¥0'
  const rounded = Math.round(value * 100) / 100
  return '¥' + (Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2))
}

// 四舍五入到 2 位小数，避免浮点比较误差
export function round2(n: number): number {
  return Math.round(n * 100) / 100
}
