// SQLite 存储层
// 数据组织：
//   students     表 -> 学员
//   courses      表 -> 课程（含单价 unit_price、计费方式 billing_type）
//   schedules    表 -> 排课（按 student_id + date 索引查询）
//   enrollments  表 -> 报名记录（学员×课程，按课程独立计费；赠课后扣）
//   transfers    表 -> 结转流水（按金额 / 按课时）
//   announcement 表 -> 公告（单行）
//   admin        表 -> 超管账号（为后期多账号体系预留）
// 注：项目名称、token 签名密钥等高频读取的系统配置存于 config.json，不占 DB
//
// 计费模型说明：
// - 课时不再挂在学员身上，而是挂在「报名记录 enrollment」上，按课程独立核算
// - 一个学员可报名多个课程（多条 enrollment）；同一课程可多次续费报名
// - enrollment 拆分付费课时(purchased_hours)与赠课(gift_hours)，剩余分别记录
// - 点名扣减规则：赠课后扣 —— 到课先扣付费剩余，扣完再扣赠课；改缺勤先回退赠课
// - 结转：把源 enrollment 剩余价值转移到目标 enrollment，支持按金额(default)/按课时
// - students.hours / remaining_hours 字段保留但降级为只读汇总，不再由点名维护
import Database from 'better-sqlite3'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { mkdirSync } from 'node:fs'
import { genScheduleId, genEnrollmentId, genTransferId } from './id.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

// 数据目录：优先环境变量，否则项目根 data/
const DATA_DIR = process.env.DATA_DIR
  || join(__dirname, '..', '..', 'data')
mkdirSync(DATA_DIR, { recursive: true })

const DB_PATH = join(DATA_DIR, 'pai.db')

// 单例连接
let dbInstance = null
export function getDb() {
  if (dbInstance) return dbInstance
  const db = new Database(DB_PATH)
  // WAL 模式：读不阻塞写，并发友好
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  // 建表
  db.exec(`
    CREATE TABLE IF NOT EXISTS students (
      id              TEXT PRIMARY KEY,
      name            TEXT NOT NULL,
      grade           TEXT DEFAULT '',
      hours           INTEGER,
      remaining_hours INTEGER,
      created_at      TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS courses (
      id                 TEXT PRIMARY KEY,
      name               TEXT NOT NULL,
      teacher            TEXT DEFAULT '',
      location           TEXT DEFAULT '',
      color              TEXT DEFAULT '',
      default_start_time TEXT DEFAULT '',
      default_end_time   TEXT DEFAULT '',
      unit_price         REAL DEFAULT 0,
      billing_type       TEXT DEFAULT 'per_lesson',
      created_at         TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS schedules (
      id           TEXT PRIMARY KEY,
      student_id   TEXT NOT NULL,
      student_name TEXT NOT NULL,
      course_id    TEXT DEFAULT '',
      course_name  TEXT NOT NULL,
      teacher      TEXT DEFAULT '',
      location     TEXT DEFAULT '',
      date         TEXT NOT NULL,
      start_time   TEXT DEFAULT '',
      end_time     TEXT DEFAULT '',
      note         TEXT DEFAULT '',
      color        TEXT DEFAULT '',
      attended     INTEGER,
      created_at   TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_schedules_student_date ON schedules(student_id, date);
    CREATE INDEX IF NOT EXISTS idx_schedules_date ON schedules(date);
    CREATE INDEX IF NOT EXISTS idx_schedules_student ON schedules(student_id);
    CREATE INDEX IF NOT EXISTS idx_schedules_course ON schedules(course_id);

    CREATE TABLE IF NOT EXISTS enrollments (
      id                    TEXT PRIMARY KEY,
      student_id            TEXT NOT NULL,
      course_id             TEXT NOT NULL,
      status                TEXT NOT NULL DEFAULT 'active',
      purchased_hours       INTEGER NOT NULL DEFAULT 0,
      gift_hours            INTEGER NOT NULL DEFAULT 0,
      remaining_paid_hours  INTEGER NOT NULL DEFAULT 0,
      remaining_gift_hours  INTEGER NOT NULL DEFAULT 0,
      unit_price            REAL NOT NULL DEFAULT 0,
      total_amount          REAL NOT NULL DEFAULT 0,
      paid_amount           REAL NOT NULL DEFAULT 0,
      enrolled_at           TEXT,
      note                  TEXT DEFAULT '',
      created_at            TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_enrollments_student ON enrollments(student_id);
    CREATE INDEX IF NOT EXISTS idx_enrollments_course ON enrollments(course_id);
    CREATE INDEX IF NOT EXISTS idx_enrollments_student_course ON enrollments(student_id, course_id);
    CREATE INDEX IF NOT EXISTS idx_enrollments_status ON enrollments(status);

    CREATE TABLE IF NOT EXISTS transfers (
      id                    TEXT PRIMARY KEY,
      student_id            TEXT NOT NULL,
      from_enrollment_id    TEXT NOT NULL,
      to_enrollment_id      TEXT NOT NULL,
      mode                  TEXT NOT NULL,
      transferred_hours     INTEGER NOT NULL DEFAULT 0,
      transferred_amount    REAL NOT NULL DEFAULT 0,
      leftover_amount       REAL NOT NULL DEFAULT 0,
      from_unit_price       REAL NOT NULL DEFAULT 0,
      to_unit_price         REAL NOT NULL DEFAULT 0,
      note                  TEXT DEFAULT '',
      created_at            TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_transfers_student ON transfers(student_id);
    CREATE INDEX IF NOT EXISTS idx_transfers_from ON transfers(from_enrollment_id);
    CREATE INDEX IF NOT EXISTS idx_transfers_to ON transfers(to_enrollment_id);

    CREATE TABLE IF NOT EXISTS announcement (
      id         INTEGER PRIMARY KEY CHECK (id = 1),
      content    TEXT DEFAULT '',
      updated_at TEXT DEFAULT ''
    );
    INSERT OR IGNORE INTO announcement (id, content, updated_at) VALUES (1, '', '');

    CREATE TABLE IF NOT EXISTS admin (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      username        TEXT NOT NULL UNIQUE,
      password_hash   TEXT NOT NULL,
      role            TEXT NOT NULL DEFAULT 'superadmin',
      created_at      TEXT DEFAULT (datetime('now'))
    );
  `)

  // 兼容已存在的旧库：补齐 courses 新增字段（开发阶段也可直接删 db 重建）
  ensureColumn(db, 'courses', 'unit_price', 'REAL DEFAULT 0')
  ensureColumn(db, 'courses', 'billing_type', "TEXT DEFAULT 'per_lesson'")

  dbInstance = db
  return db
}

// 幂等加列：列不存在才 ADD（better-sqlite3 不支持 IF NOT EXISTS 语法）
function ensureColumn(db, table, column, def) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all()
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`)
  }
}

// ========== 输入校验（防 SQL 注入与路径遍历） ==========
function validateStorageId(id, name = 'id') {
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) {
    throw new Error(`${name} 含非法字符（仅允许字母、数字、下划线、短横线，长度 1-64）`)
  }
}
function validateMonth(month, name = 'month') {
  if (typeof month !== 'string' || !/^\d{4}-\d{2}$/.test(month)) {
    throw new Error(`${name} 格式应为 yyyy-MM`)
  }
}
function validateDate(date, name = 'date') {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`${name} 格式应为 yyyy-MM-dd`)
  }
}

// ========== 行 <-> 对象 映射 ==========
function rowToStudent(r) {
  if (!r) return null
  const s = { id: r.id, name: r.name, grade: r.grade || '' }
  if (r.hours !== null && r.hours !== undefined) s.hours = r.hours
  if (r.remaining_hours !== null && r.remaining_hours !== undefined) s.remainingHours = r.remaining_hours
  return s
}
function rowToCourse(r) {
  if (!r) return null
  return {
    id: r.id,
    name: r.name,
    teacher: r.teacher || '',
    location: r.location || '',
    color: r.color || '',
    defaultStartTime: r.default_start_time || '',
    defaultEndTime: r.default_end_time || '',
    unitPrice: typeof r.unit_price === 'number' ? r.unit_price : Number(r.unit_price || 0),
    billingType: r.billing_type || 'per_lesson',
  }
}
function rowToSchedule(r) {
  if (!r) return null
  return {
    id: r.id,
    studentId: r.student_id,
    studentName: r.student_name,
    courseId: r.course_id || '',
    courseName: r.course_name,
    teacher: r.teacher || '',
    location: r.location || '',
    date: r.date,
    startTime: r.start_time || '',
    endTime: r.end_time || '',
    note: r.note || '',
    color: r.color || '',
    attended: r.attended === null ? undefined : !!r.attended,
  }
}
function rowToEnrollment(r) {
  if (!r) return null
  return {
    id: r.id,
    studentId: r.student_id,
    courseId: r.course_id,
    status: r.status || 'active',
    purchasedHours: r.purchased_hours ?? 0,
    giftHours: r.gift_hours ?? 0,
    remainingPaidHours: r.remaining_paid_hours ?? 0,
    remainingGiftHours: r.remaining_gift_hours ?? 0,
    unitPrice: typeof r.unit_price === 'number' ? r.unit_price : Number(r.unit_price || 0),
    totalAmount: typeof r.total_amount === 'number' ? r.total_amount : Number(r.total_amount || 0),
    paidAmount: typeof r.paid_amount === 'number' ? r.paid_amount : Number(r.paid_amount || 0),
    enrolledAt: r.enrolled_at || '',
    note: r.note || '',
    createdAt: r.created_at || '',
  }
}
function rowToTransfer(r) {
  if (!r) return null
  return {
    id: r.id,
    studentId: r.student_id,
    fromEnrollmentId: r.from_enrollment_id,
    toEnrollmentId: r.to_enrollment_id,
    mode: r.mode,
    transferredHours: r.transferred_hours ?? 0,
    transferredAmount: typeof r.transferred_amount === 'number' ? r.transferred_amount : Number(r.transferred_amount || 0),
    leftoverAmount: typeof r.leftover_amount === 'number' ? r.leftover_amount : Number(r.leftover_amount || 0),
    fromUnitPrice: typeof r.from_unit_price === 'number' ? r.from_unit_price : Number(r.from_unit_price || 0),
    toUnitPrice: typeof r.to_unit_price === 'number' ? r.to_unit_price : Number(r.to_unit_price || 0),
    note: r.note || '',
    createdAt: r.created_at || '',
  }
}

// ========== 学员 ==========
export async function getStudents() {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM students ORDER BY created_at, id').all()
  return rows.map(rowToStudent)
}

export async function saveStudents(students) {
  // 兼容旧接口：整体覆盖（事务内先清后插）
  const db = getDb()
  const tx = db.transaction((list) => {
    db.prepare('DELETE FROM students').run()
    const stmt = db.prepare(`INSERT INTO students (id, name, grade, hours, remaining_hours)
      VALUES (@id, @name, @grade, @hours, @remaining_hours)`)
    for (const s of list) {
      stmt.run({
        id: s.id,
        name: s.name,
        grade: s.grade || '',
        hours: s.hours ?? null,
        remaining_hours: s.remainingHours ?? null,
      })
    }
  })
  tx(students)
}

export async function addStudent(student) {
  validateStorageId(student?.id, 'student.id')
  const db = getDb()
  const exists = db.prepare('SELECT 1 FROM students WHERE id = ?').get(student.id)
  if (exists) return { created: false, exists: true }
  db.prepare(`INSERT INTO students (id, name, grade, hours, remaining_hours)
    VALUES (?, ?, ?, ?, ?)`).run(
    student.id,
    student.name,
    student.grade || '',
    student.hours ?? null,
    student.remainingHours ?? null,
  )
  return { created: true, exists: false }
}

export async function updateStudent(student) {
  validateStorageId(student?.id, 'student.id')
  const db = getDb()
  const old = db.prepare('SELECT * FROM students WHERE id = ?').get(student.id)
  if (!old) return { updated: false, notFound: true, nameChanged: false, updatedScheduleFiles: 0 }
  const nameChanged = old.name !== student.name
  // 更新学员（hours/remaining_hours 为只读汇总，更新时不接收前端传入）
  db.prepare(`UPDATE students SET name=?, grade=? WHERE id=?`).run(
    student.name,
    student.grade || '',
    student.id,
  )
  // 姓名变更：级联更新排课中的 student_name
  let updatedScheduleFiles = 0
  if (nameChanged) {
    const info = db.prepare('UPDATE schedules SET student_name=? WHERE student_id=?').run(student.name, student.id)
    updatedScheduleFiles = info.changes > 0 ? 1 : 0
  }
  return { updated: true, notFound: false, nameChanged, updatedScheduleFiles }
}

export async function deleteStudentWithSchedules(studentId) {
  validateStorageId(studentId, 'studentId')
  const db = getDb()
  const tx = db.transaction(() => {
    const del = db.prepare('DELETE FROM schedules WHERE student_id=?').run(studentId)
    // 同步清理该学员的报名与结转流水
    db.prepare('DELETE FROM enrollments WHERE student_id=?').run(studentId)
    db.prepare('DELETE FROM transfers WHERE student_id=?').run(studentId)
    const stu = db.prepare('DELETE FROM students WHERE id=?').run(studentId)
    return { deletedScheduleFiles: del.changes > 0 ? 1 : 0, studentRemoved: stu.changes > 0 }
  })
  return tx()
}

// ========== 课程 ==========
export async function getCourses() {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM courses ORDER BY created_at, id').all()
  return rows.map(rowToCourse)
}

export async function saveCourses(courses) {
  const db = getDb()
  const tx = db.transaction((list) => {
    db.prepare('DELETE FROM courses').run()
    const stmt = db.prepare(`INSERT INTO courses (id, name, teacher, location, color, default_start_time, default_end_time, unit_price, billing_type)
      VALUES (@id, @name, @teacher, @location, @color, @default_start_time, @default_end_time, @unit_price, @billing_type)`)
    for (const c of list) {
      stmt.run({
        id: c.id,
        name: c.name,
        teacher: c.teacher || '',
        location: c.location || '',
        color: c.color || '',
        default_start_time: c.defaultStartTime || '',
        default_end_time: c.defaultEndTime || '',
        unit_price: Number(c.unitPrice || 0),
        billing_type: c.billingType || 'per_lesson',
      })
    }
  })
  tx(courses)
}

export async function addCourse(course) {
  const db = getDb()
  const exists = db.prepare('SELECT 1 FROM courses WHERE id = ?').get(course.id)
  if (exists) return { created: false, exists: true }
  db.prepare(`INSERT INTO courses (id, name, teacher, location, color, default_start_time, default_end_time, unit_price, billing_type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    course.id,
    course.name,
    course.teacher || '',
    course.location || '',
    course.color || '',
    course.defaultStartTime || '',
    course.defaultEndTime || '',
    Number(course.unitPrice || 0),
    course.billingType || 'per_lesson',
  )
  return { created: true, exists: false }
}

export async function updateCourse(course) {
  const db = getDb()
  const info = db.prepare(`UPDATE courses SET name=?, teacher=?, location=?, color=?, default_start_time=?, default_end_time=?, unit_price=?, billing_type=?
    WHERE id=?`).run(
    course.name,
    course.teacher || '',
    course.location || '',
    course.color || '',
    course.defaultStartTime || '',
    course.defaultEndTime || '',
    Number(course.unitPrice || 0),
    course.billingType || 'per_lesson',
    course.id,
  )
  return { updated: info.changes > 0, notFound: info.changes === 0 }
}

export async function deleteCourseWithSchedules(courseId) {
  validateStorageId(courseId, 'courseId')
  const db = getDb()
  const tx = db.transaction(() => {
    const del = db.prepare('DELETE FROM schedules WHERE course_id=?').run(courseId)
    // 同步清理该课程的报名记录
    db.prepare('DELETE FROM enrollments WHERE course_id=?').run(courseId)
    const cou = db.prepare('DELETE FROM courses WHERE id=?').run(courseId)
    return {
      courseRemoved: cou.changes > 0,
      deletedScheduleCount: del.changes,
      deletedFiles: 0,
    }
  })
  return tx()
}

// ========== 报名记录（计费核心） ==========
export async function getEnrollments({ studentId, courseId, status } = {}) {
  const db = getDb()
  let sql = 'SELECT * FROM enrollments WHERE 1=1'
  const params = []
  if (studentId) { sql += ' AND student_id=?'; params.push(studentId) }
  if (courseId) { sql += ' AND course_id=?'; params.push(courseId) }
  if (status) { sql += ' AND status=?'; params.push(status) }
  sql += ' ORDER BY datetime(enrolled_at), datetime(created_at), id'
  const rows = db.prepare(sql).all(...params)
  return rows.map(rowToEnrollment)
}

export async function getEnrollment(id) {
  const db = getDb()
  return rowToEnrollment(db.prepare('SELECT * FROM enrollments WHERE id=?').get(id))
}

// 点名扣减时定位报名记录：学员+课程下，取最早报名且仍有剩余的 active 记录
// 若无剩余 > 0 的，退而取最早的 active 记录（扣到负数会触发 errors 提示）
export async function findActiveEnrollmentForAttendance(studentId, courseId) {
  const db = getDb()
  const withRemaining = db.prepare(`SELECT * FROM enrollments
    WHERE student_id=? AND course_id=? AND status='active' AND (remaining_paid_hours > 0 OR remaining_gift_hours > 0)
    ORDER BY datetime(enrolled_at), datetime(created_at) LIMIT 1`).get(studentId, courseId)
  if (withRemaining) return rowToEnrollment(withRemaining)
  const anyActive = db.prepare(`SELECT * FROM enrollments
    WHERE student_id=? AND course_id=? AND status='active'
    ORDER BY datetime(enrolled_at), datetime(created_at) LIMIT 1`).get(studentId, courseId)
  return rowToEnrollment(anyActive)
}

export async function addEnrollment(enrollment) {
  validateStorageId(enrollment?.id, 'enrollment.id')
  validateStorageId(enrollment?.studentId, 'enrollment.studentId')
  validateStorageId(enrollment?.courseId, 'enrollment.courseId')
  const db = getDb()
  // 学员与课程必须存在
  if (!db.prepare('SELECT 1 FROM students WHERE id=?').get(enrollment.studentId)) {
    return { created: false, notFound: 'student' }
  }
  if (!db.prepare('SELECT 1 FROM courses WHERE id=?').get(enrollment.courseId)) {
    return { created: false, notFound: 'course' }
  }
  if (db.prepare('SELECT 1 FROM enrollments WHERE id=?').get(enrollment.id)) {
    return { created: false, exists: true }
  }
  const purchased = Number(enrollment.purchasedHours || 0)
  const gift = Number(enrollment.giftHours || 0)
  const unitPrice = Number(enrollment.unitPrice || 0)
  db.prepare(`INSERT INTO enrollments
    (id, student_id, course_id, status, purchased_hours, gift_hours, remaining_paid_hours, remaining_gift_hours, unit_price, total_amount, paid_amount, enrolled_at, note)
    VALUES (?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    enrollment.id,
    enrollment.studentId,
    enrollment.courseId,
    purchased,
    gift,
    purchased, // 初始付费剩余 = 购买
    gift,       // 初始赠课剩余 = 赠课
    unitPrice,
    Number(enrollment.totalAmount ?? (purchased * unitPrice)),
    Number(enrollment.paidAmount ?? (purchased * unitPrice)),
    enrollment.enrolledAt || new Date().toISOString(),
    enrollment.note || '',
  )
  return { created: true, exists: false }
}

// 更新报名：仅允许修改赠课、单价、应付/实付、备注、状态
// 课时调整通过 purchasedHours/giftHours 增量方式进行（续费/补赠课），避免误覆盖剩余
export async function updateEnrollment(enrollment) {
  validateStorageId(enrollment?.id, 'enrollment.id')
  const db = getDb()
  const old = db.prepare('SELECT * FROM enrollments WHERE id=?').get(enrollment.id)
  if (!old) return { updated: false, notFound: true }

  const tx = db.transaction(() => {
    // 续费：purchasedHours 增量 → 付费剩余与总额同步增加
    const newPurchased = Number(enrollment.purchasedHours ?? old.purchased_hours)
    const newGift = Number(enrollment.giftHours ?? old.gift_hours)
    const purchasedDelta = newPurchased - old.purchased_hours
    const giftDelta = newGift - old.gift_hours
    const newRemainingPaid = Math.max(0, old.remaining_paid_hours + purchasedDelta)
    const newRemainingGift = Math.max(0, old.remaining_gift_hours + giftDelta)
    const unitPrice = Number(enrollment.unitPrice ?? old.unit_price)
    const totalAmount = Number(enrollment.totalAmount ?? (newPurchased * unitPrice))
    const paidAmount = Number(enrollment.paidAmount ?? old.paid_amount)
    const status = enrollment.status || old.status
    db.prepare(`UPDATE enrollments SET
      purchased_hours=?, gift_hours=?, remaining_paid_hours=?, remaining_gift_hours=?,
      unit_price=?, total_amount=?, paid_amount=?, status=?, note=? WHERE id=?`).run(
      newPurchased,
      newGift,
      newRemainingPaid,
      newRemainingGift,
      unitPrice,
      totalAmount,
      paidAmount,
      status,
      enrollment.note ?? old.note,
      enrollment.id,
    )
    return { purchasedDelta, giftDelta }
  })
  const r = tx()
  return { updated: true, notFound: false, ...r }
}

export async function deleteEnrollment(id) {
  validateStorageId(id, 'enrollment.id')
  const db = getDb()
  const info = db.prepare('DELETE FROM enrollments WHERE id=?').run(id)
  return { deleted: info.changes > 0 }
}

// 学员报名汇总（供学员管理页展示总购课/总剩余）
export async function getEnrollmentSummaryByStudent(studentId) {
  validateStorageId(studentId, 'studentId')
  const db = getDb()
  const rows = db.prepare(`SELECT
      COUNT(*) AS count,
      COALESCE(SUM(purchased_hours),0) AS purchased,
      COALESCE(SUM(gift_hours),0) AS gift,
      COALESCE(SUM(remaining_paid_hours),0) AS remainingPaid,
      COALESCE(SUM(remaining_gift_hours),0) AS remainingGift,
      COALESCE(SUM(total_amount),0) AS totalAmount,
      COALESCE(SUM(paid_amount),0) AS paidAmount
    FROM enrollments WHERE student_id=? AND status='active'`).get(studentId)
  return {
    count: rows?.count || 0,
    purchasedHours: rows?.purchased || 0,
    giftHours: rows?.gift || 0,
    remainingHours: (rows?.remainingPaid || 0) + (rows?.remainingGift || 0),
    remainingPaidHours: rows?.remainingPaid || 0,
    remainingGiftHours: rows?.remainingGift || 0,
    totalAmount: rows?.totalAmount || 0,
    paidAmount: rows?.paidAmount || 0,
  }
}

// 批量查询多学员报名汇总（一次查询，避免 N+1）
export async function getEnrollmentSummaries(studentIds) {
  if (!studentIds || studentIds.length === 0) return {}
  const db = getDb()
  const placeholders = studentIds.map(() => '?').join(',')
  const rows = db.prepare(`SELECT student_id,
      COUNT(*) AS count,
      COALESCE(SUM(purchased_hours),0) AS purchased,
      COALESCE(SUM(gift_hours),0) AS gift,
      COALESCE(SUM(remaining_paid_hours),0) AS remainingPaid,
      COALESCE(SUM(remaining_gift_hours),0) AS remainingGift,
      COALESCE(SUM(total_amount),0) AS totalAmount,
      COALESCE(SUM(paid_amount),0) AS paidAmount
    FROM enrollments WHERE student_id IN (${placeholders}) AND status='active'
    GROUP BY student_id`).all(...studentIds)
  const map = {}
  for (const r of rows) {
    map[r.student_id] = {
      count: r.count,
      purchasedHours: r.purchased,
      giftHours: r.gift,
      remainingHours: r.remainingPaid + r.remainingGift,
      remainingPaidHours: r.remainingPaid,
      remainingGiftHours: r.remainingGift,
      totalAmount: r.totalAmount,
      paidAmount: r.paidAmount,
    }
  }
  return map
}

// ========== 结转 ==========
// mode: 'amount'（默认，按金额折算）/ 'hours'（按课时平移）
export async function addTransfer(transfer) {
  validateStorageId(transfer?.id, 'transfer.id')
  validateStorageId(transfer?.studentId, 'transfer.studentId')
  validateStorageId(transfer?.fromEnrollmentId, 'transfer.fromEnrollmentId')
  validateStorageId(transfer?.toEnrollmentId, 'transfer.toEnrollmentId')
  const db = getDb()
  if (transfer.fromEnrollmentId === transfer.toEnrollmentId) {
    return { created: false, reason: '源与目标报名记录不能相同' }
  }

  const tx = db.transaction(() => {
    const from = db.prepare('SELECT * FROM enrollments WHERE id=?').get(transfer.fromEnrollmentId)
    const to = db.prepare('SELECT * FROM enrollments WHERE id=?').get(transfer.toEnrollmentId)
    if (!from) throw new Error('源报名记录不存在')
    if (!to) throw new Error('目标报名记录不存在')
    if (from.student_id !== to.student_id) throw new Error('结转仅支持同一学员的报名记录')
    if (from.status !== 'active') throw new Error('源报名记录非进行中，不可结转')
    if (to.status !== 'active') throw new Error('目标报名记录非进行中，不可结转')

    const fromRemainingPaid = from.remaining_paid_hours
    const fromRemainingGift = from.remaining_gift_hours
    const fromTotalRemaining = fromRemainingPaid + fromRemainingGift
    if (fromTotalRemaining <= 0) throw new Error('源报名记录无剩余课时，不可结转')

    const mode = transfer.mode === 'hours' ? 'hours' : 'amount'
    const fromUnitPrice = Number(from.unit_price || 0)
    const toUnitPrice = Number(to.unit_price || 0)

    let transferredHours = 0
    let transferredAmount = 0
    let leftoverAmount = 0
    let toPurchasedAdd = 0
    let toGiftAdd = 0

    if (mode === 'hours') {
      // 按课时平移：付费→付费，赠课→赠课
      transferredHours = fromTotalRemaining
      transferredAmount = fromTotalRemaining * fromUnitPrice
      toPurchasedAdd = fromRemainingPaid
      toGiftAdd = fromRemainingGift
    } else {
      // 按金额折算：源剩余价值 = (付费+赠课) * 源单价
      // 目标新增课时 = floor(金额 / 目标单价)，全部计入付费课时
      transferredHours = fromTotalRemaining
      transferredAmount = fromTotalRemaining * fromUnitPrice
      if (toUnitPrice > 0) {
        toPurchasedAdd = Math.floor(transferredAmount / toUnitPrice)
        leftoverAmount = Math.round((transferredAmount - toPurchasedAdd * toUnitPrice) * 100) / 100
      } else {
        // 目标单价为 0：无法折算课时，金额原样记录，课时 0
        toPurchasedAdd = 0
        leftoverAmount = transferredAmount
      }
    }

    // 源清零并标记已结转
    db.prepare(`UPDATE enrollments SET remaining_paid_hours=0, remaining_gift_hours=0, status='settled' WHERE id=?`)
      .run(from.id)
    // 目标累加
    db.prepare(`UPDATE enrollments SET
      purchased_hours = purchased_hours + ?,
      remaining_paid_hours = remaining_paid_hours + ?,
      gift_hours = gift_hours + ?,
      remaining_gift_hours = remaining_gift_hours + ?,
      total_amount = total_amount + ?,
      paid_amount = paid_amount + ?
      WHERE id=?`).run(
      toPurchasedAdd, toPurchasedAdd,
      toGiftAdd, toGiftAdd,
      transferredAmount, transferredAmount,
      to.id,
    )

    db.prepare(`INSERT INTO transfers
      (id, student_id, from_enrollment_id, to_enrollment_id, mode, transferred_hours, transferred_amount, leftover_amount, from_unit_price, to_unit_price, note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      transfer.id,
      transfer.studentId,
      transfer.fromEnrollmentId,
      transfer.toEnrollmentId,
      mode,
      transferredHours,
      transferredAmount,
      leftoverAmount,
      fromUnitPrice,
      toUnitPrice,
      transfer.note || '',
    )

    return {
      mode,
      transferredHours,
      transferredAmount,
      leftoverAmount,
      toPurchasedAdd,
      toGiftAdd,
    }
  })

  const result = tx()
  return { created: true, ...result }
}

export async function getTransfers({ studentId } = {}) {
  const db = getDb()
  let sql = 'SELECT * FROM transfers WHERE 1=1'
  const params = []
  if (studentId) { sql += ' AND student_id=?'; params.push(studentId) }
  sql += ' ORDER BY datetime(created_at) DESC, id DESC'
  const rows = db.prepare(sql).all(...params)
  return rows.map(rowToTransfer)
}

// ========== 排课 ==========
export async function getSchedulesByMonth(studentId, month) {
  validateStorageId(studentId, 'studentId')
  validateMonth(month, 'month')
  const db = getDb()
  const rows = db.prepare(`SELECT * FROM schedules
    WHERE student_id=? AND substr(date,1,7)=?
    ORDER BY date, start_time`).all(studentId, month)
  return rows.map(rowToSchedule)
}

export async function saveSchedulesByMonth(studentId, month, schedules) {
  validateStorageId(studentId, 'studentId')
  validateMonth(month, 'month')
  const db = getDb()
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM schedules WHERE student_id=? AND substr(date,1,7)=?').run(studentId, month)
    const stmt = db.prepare(`INSERT INTO schedules
      (id, student_id, student_name, course_id, course_name, teacher, location, date, start_time, end_time, note, color, attended)
      VALUES (@id, @student_id, @student_name, @course_id, @course_name, @teacher, @location, @date, @start_time, @end_time, @note, @color, @attended)`)
    for (const s of schedules) {
      stmt.run({
        id: s.id,
        student_id: s.studentId,
        student_name: s.studentName,
        course_id: s.courseId || '',
        course_name: s.courseName,
        teacher: s.teacher || '',
        location: s.location || '',
        date: s.date,
        start_time: s.startTime || '',
        end_time: s.endTime || '',
        note: s.note || '',
        color: s.color || '',
        attended: s.attended === undefined ? null : (s.attended ? 1 : 0),
      })
    }
  })
  tx()
}

export async function listScheduleMonths(studentId) {
  validateStorageId(studentId, 'studentId')
  const db = getDb()
  const rows = db.prepare(`SELECT DISTINCT substr(date,1,7) AS m
    FROM schedules WHERE student_id=? ORDER BY m`).all(studentId)
  return rows.map((r) => r.m)
}

export async function getAllSchedulesByStudent(studentId) {
  validateStorageId(studentId, 'studentId')
  const db = getDb()
  const rows = db.prepare(`SELECT * FROM schedules WHERE student_id=?
    ORDER BY date, start_time`).all(studentId)
  return rows.map(rowToSchedule)
}

export async function getSchedulesByDateRange(studentId, startDate, endDate) {
  validateStorageId(studentId, 'studentId')
  validateDate(startDate, 'startDate')
  validateDate(endDate, 'endDate')
  const db = getDb()
  const rows = db.prepare(`SELECT * FROM schedules WHERE student_id=? AND date>=? AND date<=?
    ORDER BY date, start_time`).all(studentId, startDate, endDate)
  return rows.map(rowToSchedule)
}

export async function searchSchedules({ startDate, endDate, courseId } = {}) {
  const db = getDb()
  let sql = 'SELECT * FROM schedules WHERE 1=1'
  const params = []
  if (startDate) { sql += ' AND date>=?'; params.push(startDate) }
  if (endDate) { sql += ' AND date<=?'; params.push(endDate) }
  if (courseId) { sql += ' AND course_id=?'; params.push(courseId) }
  sql += ' ORDER BY date, start_time'
  const rows = db.prepare(sql).all(...params)
  return rows.map(rowToSchedule)
}

export async function batchAddSchedules(schedules) {
  for (const s of schedules) {
    validateStorageId(s.studentId, 'studentId')
    validateDate(s.date, 'date')
  }
  const db = getDb()
  let created = 0
  let skipped = 0
  const errors = []
  const usedIds = new Set()

  const tx = db.transaction(() => {
    for (const s of schedules) {
      let id = s.id
      const existRow = db.prepare('SELECT 1 FROM schedules WHERE id=?').get(id)
      let guard = 0
      while ((existRow || usedIds.has(id)) && guard < 100) {
        id = genScheduleId()
        guard++
      }
      // 重新检查新 id
      if (db.prepare('SELECT 1 FROM schedules WHERE id=?').get(id) || usedIds.has(id)) {
        errors.push({ studentId: s.studentId, date: s.date, reason: 'id 碰撞重试耗尽' })
        skipped++
        continue
      }
      db.prepare(`INSERT INTO schedules
        (id, student_id, student_name, course_id, course_name, teacher, location, date, start_time, end_time, note, color, attended)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        id,
        s.studentId,
        s.studentName,
        s.courseId || '',
        s.courseName,
        s.teacher || '',
        s.location || '',
        s.date,
        s.startTime || '',
        s.endTime || '',
        s.note || '',
        s.color || '',
        s.attended === undefined ? null : (s.attended ? 1 : 0),
      )
      usedIds.add(id)
      created++
    }
  })
  tx()
  return { created, skipped, errors }
}

export async function addSchedule(schedule) {
  const studentId = schedule.studentId
  const month = schedule.date.slice(0, 7)
  const key = `schedules/${studentId}/${month}.json`
  validateStorageId(studentId, 'studentId')
  validateDate(schedule.date, 'date')

  const db = getDb()
  if (db.prepare('SELECT 1 FROM schedules WHERE id=?').get(schedule.id)) {
    return { created: false, key, exists: true }
  }
  db.prepare(`INSERT INTO schedules
    (id, student_id, student_name, course_id, course_name, teacher, location, date, start_time, end_time, note, color, attended)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    schedule.id,
    studentId,
    schedule.studentName,
    schedule.courseId || '',
    schedule.courseName,
    schedule.teacher || '',
    schedule.location || '',
    schedule.date,
    schedule.startTime || '',
    schedule.endTime || '',
    schedule.note || '',
    schedule.color || '',
    schedule.attended === undefined ? null : (schedule.attended ? 1 : 0),
  )
  return { created: true, key, exists: false }
}

export async function updateSchedule(oldSchedule, newSchedule) {
  if (oldSchedule.id !== newSchedule.id) {
    throw new Error('排课 id 不可修改')
  }
  validateStorageId(oldSchedule.studentId, 'oldSchedule.studentId')
  validateDate(oldSchedule.date, 'oldSchedule.date')
  validateStorageId(newSchedule.studentId, 'newSchedule.studentId')
  validateDate(newSchedule.date, 'newSchedule.date')

  const db = getDb()
  const tx = db.transaction(() => {
    const exist = db.prepare('SELECT * FROM schedules WHERE id=?').get(newSchedule.id)
    if (!exist) throw new Error('未找到原排课记录')
    db.prepare(`UPDATE schedules SET
      student_id=?, student_name=?, course_id=?, course_name=?, teacher=?, location=?, date=?, start_time=?, end_time=?, note=?, color=?
      WHERE id=?`).run(
      newSchedule.studentId,
      newSchedule.studentName,
      newSchedule.courseId || '',
      newSchedule.courseName,
      newSchedule.teacher || '',
      newSchedule.location || '',
      newSchedule.date,
      newSchedule.startTime || '',
      newSchedule.endTime || '',
      newSchedule.note || '',
      newSchedule.color || '',
      newSchedule.id,
    )
    return { moved: true }
  })
  const r = tx()
  return { ...r, fromKey: '', toKey: '' }
}

export async function deleteSchedule(scheduleId, studentId, date) {
  validateStorageId(studentId, 'studentId')
  validateDate(date, 'date')
  const db = getDb()
  const info = db.prepare('DELETE FROM schedules WHERE id=? AND student_id=?').run(scheduleId, studentId)
  return { deleted: info.changes > 0, count: info.changes }
}

// ========== 点名 ==========
// 扣减规则：赠课后扣
//   到课(扣1)：先扣 remaining_paid_hours，扣完再扣 remaining_gift_hours
//   改缺勤(加1)：先回退 remaining_gift_hours（不超过 gift_hours 上限），再加 remaining_paid_hours
// 扣减目标：通过 schedule.student_id + schedule.course_id 定位 active enrollment
//   找不到 enrollment 时，仍更新 attended 状态，但记录 errors 不扣课时
export async function batchSetAttendance(items) {
  for (const item of items) {
    validateStorageId(item.studentId, 'studentId')
    validateDate(String(item.date), 'date')
  }
  const db = getDb()
  const errors = []
  let updatedSchedules = 0
  let updatedEnrollments = 0
  const touchedEnrollmentIds = new Set()

  const tx = db.transaction(() => {
    for (const item of items) {
      const row = db.prepare('SELECT * FROM schedules WHERE id=? AND student_id=?').get(item.scheduleId, item.studentId)
      if (!row) {
        errors.push(`排课 ${item.scheduleId} 在 ${item.studentId} 中未找到`)
        continue
      }
      const oldAttended = row.attended === null ? undefined : !!row.attended
      const newAttended = !!item.attended
      if (oldAttended === newAttended) continue
      db.prepare('UPDATE schedules SET attended=? WHERE id=?').run(newAttended ? 1 : 0, item.scheduleId)
      updatedSchedules++

      // 仅按课程扣减（course_id 为空无法定位报名记录）
      if (!row.course_id) {
        errors.push(`排课 ${item.scheduleId} 未关联课程，跳过课时扣减`)
        continue
      }
      const enrRow = db.prepare(`SELECT * FROM enrollments
        WHERE student_id=? AND course_id=? AND status='active' AND (remaining_paid_hours > 0 OR remaining_gift_hours > 0)
        ORDER BY datetime(enrolled_at), datetime(created_at) LIMIT 1`).get(row.student_id, row.course_id)
      const enrFallback = !enrRow
        ? db.prepare(`SELECT * FROM enrollments WHERE student_id=? AND course_id=? AND status='active'
            ORDER BY datetime(enrolled_at), datetime(created_at) LIMIT 1`).get(row.student_id, row.course_id)
        : null
      const enr = enrRow || enrFallback
      if (!enr) {
        errors.push(`学员 ${row.student_id} 未报名课程 ${row.course_name || row.course_id}，跳过课时扣减`)
        continue
      }

      if (newAttended) {
        // 扣 1：先付费后赠课
        if (enr.remaining_paid_hours > 0) {
          enr.remaining_paid_hours -= 1
        } else if (enr.remaining_gift_hours > 0) {
          enr.remaining_gift_hours -= 1
        } else {
          errors.push(`学员 ${row.student_id} 课程 ${row.course_name || row.course_id} 剩余课时不足，已扣至负数边界（未实际扣减）`)
          // 不再扣减，保留 0
        }
      } else {
        // 回退 1：先赠课（不超 gift_hours 上限）后付费
        if (enr.remaining_gift_hours < enr.gift_hours) {
          enr.remaining_gift_hours += 1
        } else {
          enr.remaining_paid_hours += 1
        }
      }
      db.prepare('UPDATE enrollments SET remaining_paid_hours=?, remaining_gift_hours=? WHERE id=?')
        .run(enr.remaining_paid_hours, enr.remaining_gift_hours, enr.id)
      touchedEnrollmentIds.add(enr.id)
    }
    updatedEnrollments = touchedEnrollmentIds.size
    return { updatedSchedules, updatedEnrollments }
  })
  const r = tx()
  return { ...r, errors }
}

// ========== 公告 ==========
export async function getAnnouncement() {
  const db = getDb()
  const row = db.prepare('SELECT * FROM announcement WHERE id=1').get()
  if (!row) return { content: '', updatedAt: '' }
  return { content: row.content || '', updatedAt: row.updated_at || '' }
}

export async function saveAnnouncement(content) {
  const db = getDb()
  const payload = {
    content: String(content || ''),
    updatedAt: new Date().toISOString(),
  }
  db.prepare('UPDATE announcement SET content=?, updated_at=? WHERE id=1').run(payload.content, payload.updatedAt)
  return payload
}

// ========== 超管账号（为后期多账号体系预留） ==========
// 当前阶段：单超管，由首次启动引导页创建
export async function getSuperAdmin() {
  const db = getDb()
  const row = db.prepare("SELECT * FROM admin WHERE role='superadmin' LIMIT 1").get()
  return row || null
}

export async function countAdmins() {
  const db = getDb()
  const row = db.prepare('SELECT COUNT(*) AS c FROM admin').get()
  return row?.c || 0
}

export async function createSuperAdmin(username, passwordHash) {
  const db = getDb()
  db.prepare("INSERT INTO admin (username, password_hash, role) VALUES (?, ?, 'superadmin')").run(username, passwordHash)
}

export async function getAdminByUsername(username) {
  const db = getDb()
  return db.prepare('SELECT * FROM admin WHERE username=?').get(username) || null
}

// ========== JSON 响应工具 ==========
// 同源部署，无需 CORS 头；保留 Content-Type 即可
export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  })
}
