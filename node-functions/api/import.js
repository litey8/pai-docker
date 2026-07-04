// 通用数据导入 API
// POST /api/import  body: { students: [...], schedules: [...], mode: 'merge'|'replace' }
// 支持一次性导入完整学员与排课数据，自动按学员+月份分文件写入 Blob
import {
  getStudents,
  saveStudents,
  getSchedulesByMonth,
  saveSchedulesByMonth,
  clearAllSchedules,
  json,
} from '../_lib/store.js'
import { requireAuth } from '../_lib/auth.js'

// 处理 JSON 请求体
async function readBody(request) {
  try {
    const body = await request.json()
    return body || {}
  } catch {
    return {}
  }
}

// 日期格式校验 yyyy-MM-dd
function isValidDate(str) {
  return typeof str === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(str)
}

// 时间格式校验 HH:mm
function isValidTime(str) {
  return typeof str === 'string' && /^\d{2}:\d{2}$/.test(str)
}

// 全量数据校验：返回错误数组（空数组表示通过）
// finalStudents 为最终学员集合（含已有+本次），用于跨表关联校验
function validateAll(students, schedules, finalStudents) {
  const errors = []
  const studentIdSet = new Set()
  const scheduleIdSet = new Set()
  const finalStudentIds = new Set(
    (finalStudents || []).map((s) => s?.id).filter(Boolean)
  )

  // 校验学员
  if (Array.isArray(students)) {
    students.forEach((s, i) => {
      const row = i + 1
      if (!s || typeof s !== 'object') {
        errors.push(`学员第${row}条不是有效对象`)
        return
      }
      if (!s.id) errors.push(`学员第${row}条缺少 id`)
      if (!s.name) errors.push(`学员第${row}条缺少 name`)
      if (s.id) {
        if (studentIdSet.has(s.id)) {
          errors.push(`学员第${row}条 id 重复: "${s.id}"`)
        } else {
          studentIdSet.add(s.id)
        }
      }
    })
  }

  // 校验排课
  if (Array.isArray(schedules)) {
    schedules.forEach((s, i) => {
      const row = i + 1
      if (!s || typeof s !== 'object') {
        errors.push(`排课第${row}条不是有效对象`)
        return
      }
      if (!s.id) errors.push(`排课第${row}条缺少 id`)
      if (!s.studentId) errors.push(`排课第${row}条缺少 studentId`)
      if (!s.courseName) errors.push(`排课第${row}条缺少 courseName`)
      if (!s.date) {
        errors.push(`排课第${row}条缺少 date`)
      } else if (!isValidDate(s.date)) {
        errors.push(`排课第${row}条 date 格式应为 yyyy-MM-dd，当前为 "${s.date}"`)
      }
      if (s.startTime && !isValidTime(s.startTime)) {
        errors.push(`排课第${row}条 startTime 格式应为 HH:mm，当前为 "${s.startTime}"`)
      }
      if (s.endTime && !isValidTime(s.endTime)) {
        errors.push(`排课第${row}条 endTime 格式应为 HH:mm，当前为 "${s.endTime}"`)
      }
      if (s.id) {
        if (scheduleIdSet.has(s.id)) {
          errors.push(`排课第${row}条 id 重复: "${s.id}"`)
        } else {
          scheduleIdSet.add(s.id)
        }
      }
      // 跨表关联：studentId 必须在最终学员集合中存在
      if (s.studentId && finalStudentIds.size > 0 && !finalStudentIds.has(s.studentId)) {
        errors.push(`排课第${row}条 studentId="${s.studentId}" 在学员表中不存在`)
      }
    })
  }

  return errors
}

// 自动补全排课中的 studentName（若未提供）
function enrichSchedules(schedules, studentsById) {
  return schedules.map((s) => ({
    ...s,
    studentName: s.studentName || studentsById[s.studentId]?.name || '',
    startTime: s.startTime || '',
    endTime: s.endTime || '',
    teacher: s.teacher || '',
    location: s.location || '',
    note: s.note || '',
  }))
}

// 按学员+月份分组
function groupByStudentMonth(schedules) {
  const map = {}
  for (const s of schedules) {
    const month = s.date.slice(0, 7) // yyyy-MM
    const key = `${s.studentId}/${month}`
    if (!map[key]) map[key] = []
    map[key].push(s)
  }
  return map
}

export default async function onRequestPost(context) {
  // 鉴权：数据导入为写操作，必须校验 token
  const authFail = await requireAuth(context)
  if (authFail) return authFail
  const { request } = context
  const body = await readBody(request)
  const { students, schedules, mode } = body

  if (!Array.isArray(students) && !Array.isArray(schedules)) {
    return json(
      { code: 1, message: '请求体需包含 students 或 schedules 数组', data: null },
      400,
    )
  }

  // ===== 计算最终的学员集合（不写入，仅用于校验跨表关联） =====
  let finalStudents
  if (Array.isArray(students)) {
    if (mode === 'replace') {
      finalStudents = students
    } else {
      // 追加模式：合并已有学员，按 id 去重（新数据覆盖旧数据）
      const existing = await getStudents()
      const map = new Map(existing.map((s) => [s.id, s]))
      for (const s of students) map.set(s.id, s)
      finalStudents = Array.from(map.values())
    }
  } else {
    // 未提交学员数据：保留已有学员
    finalStudents = await getStudents()
  }

  // ===== 全量校验：所有校验通过后才写入，避免产生半成品数据 =====
  const errors = validateAll(students, schedules, finalStudents)
  if (errors.length > 0) {
    return json(
      {
        code: 1,
        message: `数据校验失败，共 ${errors.length} 个问题`,
        data: { errors },
      },
      400,
    )
  }

  // ===== 校验通过，开始写入 =====
  // 写入学员
  if (Array.isArray(students)) {
    await saveStudents(finalStudents)
  }

  // 写入排课
  let totalSchedules = 0
  let monthFiles = 0
  const hasSchedulesField = Array.isArray(schedules)

  if (hasSchedulesField) {
    // replace 模式：先清空所有排课，再写入新数据
    // 注意：即使 schedules 为空数组也会清空，符合「替换清空后写入」语义
    if (mode === 'replace') {
      await clearAllSchedules()
    }

    if (schedules.length > 0) {
      const studentsById = finalStudents.reduce((acc, s) => {
        acc[s.id] = s
        return acc
      }, {})
      const enriched = enrichSchedules(schedules, studentsById)
      const grouped = groupByStudentMonth(enriched)

      for (const [key, monthSchedules] of Object.entries(grouped)) {
        const [studentId, month] = key.split('/')
        if (mode === 'replace') {
          // 已清空，直接写入
          await saveSchedulesByMonth(studentId, month, monthSchedules)
        } else {
          // 追加模式：合并已有月份数据，按 id 去重
          const existing = await getSchedulesByMonth(studentId, month)
          const map = new Map(existing.map((s) => [s.id, s]))
          for (const s of monthSchedules) map.set(s.id, s)
          await saveSchedulesByMonth(studentId, month, Array.from(map.values()))
        }
        totalSchedules += monthSchedules.length
        monthFiles += 1
      }
    }
  }

  return json({
    code: 0,
    message: '数据导入成功',
    data: {
      mode: mode || 'merge',
      studentCount: finalStudents.length,
      importedStudents: Array.isArray(students) ? students.length : 0,
      importedSchedules: totalSchedules,
      monthFiles,
    },
  })
}
