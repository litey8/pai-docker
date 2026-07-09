// 计费方式
// per_lesson 按课时（默认，报名填购课课时，点名按课时扣减）
// per_term   按期（整期收费，预留）
// per_month  按月（包月收费，预留）
export type BillingType = 'per_lesson' | 'per_term' | 'per_month'

// 报名记录状态
// active   进行中
// settled  已结转（剩余价值已转移到其他报名记录）
// finished 已结课
export type EnrollmentStatus = 'active' | 'settled' | 'finished'

// 结转方式
// amount 按金额折算（默认）：源剩余价值按单价折算金额，再除以目标单价得到目标课时
// hours  按课时平移：付费→付费，赠课→赠课
export type TransferMode = 'amount' | 'hours'

// 学员信息
export interface Student {
  id: string
  name: string
  grade?: string
  // 以下字段保留兼容，但已降级为只读汇总，不再由点名维护
  // 课时实际由报名记录 enrollment 维护，前端展示请使用 enrollment 汇总
  hours?: number
  remainingHours?: number
}

// 课程信息
export interface Course {
  id: string
  name: string
  teacher?: string
  location?: string
  color?: string // 颜色标签 key，如 'blue'/'green'
  defaultStartTime?: string // HH:mm
  defaultEndTime?: string // HH:mm
  unitPrice?: number // 每课时单价（元）
  billingType?: BillingType // 计费方式，默认 per_lesson
}

// 排课记录
export interface Schedule {
  id: string
  studentId: string
  studentName: string
  courseId?: string // 关联课程 id（历史记录可能为空）
  courseName: string
  teacher: string
  location: string
  date: string // yyyy-MM-dd
  startTime: string // HH:mm
  endTime: string // HH:mm
  note?: string
  color?: string // 从课程带过来的颜色标签 key
  attended?: boolean // 出勤状态：true=到课，false=缺勤，undefined=未点名
}

// 报名记录（计费核心）
// 一个学员可对同一课程有多条报名记录（续费场景）；点名时按最早且有剩余的 active 记录扣减
export interface Enrollment {
  id: string
  studentId: string
  courseId: string
  status: EnrollmentStatus
  purchasedHours: number // 付费购课课时
  giftHours: number // 赠课课时
  remainingPaidHours: number // 付费剩余
  remainingGiftHours: number // 赠课剩余
  unitPrice: number // 报名时锁定的单价
  totalAmount: number // 应付总额 = purchasedHours * unitPrice
  paidAmount: number // 实付金额
  enrolledAt: string // 报名时间 ISO
  note?: string
  createdAt?: string
}

// 结转流水
export interface Transfer {
  id: string
  studentId: string
  fromEnrollmentId: string
  toEnrollmentId: string
  mode: TransferMode
  transferredHours: number // 结转的源课时数
  transferredAmount: number // 结转的金额（元）
  leftoverAmount: number // 按金额结转时除不尽的零头（元）
  fromUnitPrice: number
  toUnitPrice: number
  note?: string
  createdAt?: string
}

// 学员报名汇总（前端展示用）
export interface EnrollmentSummary {
  count: number // 报名课程数（active）
  purchasedHours: number
  giftHours: number
  remainingHours: number // 付费剩余 + 赠课剩余
  remainingPaidHours: number
  remainingGiftHours: number
  totalAmount: number
  paidAmount: number
}

// 日历视图模式
export type ViewMode = 'month' | 'week' | 'day'

// API 响应
export interface ApiResponse<T> {
  code: number
  message: string
  data: T
}

// 学员查询结果
export interface StudentSearchResult {
  students: Student[]
}

// 排课查询结果
export interface ScheduleQueryResult {
  schedules: Schedule[]
}

// 按日期分组的排课
export type SchedulesByDate = Record<string, Schedule[]>

// 日历单元格数据
export interface CalendarCell {
  date: Date
  isCurrentMonth: boolean
  isToday: boolean
  schedules: Schedule[]
}
