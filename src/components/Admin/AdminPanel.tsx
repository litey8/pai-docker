import { useState, useEffect, useCallback } from 'react'
import type { Student, Course, EnrollmentSummary } from '@/types'
import { searchStudents, getAnnouncement } from '@/api'
import {
  verifyAuth,
  saveAnnouncement,
  getAttendanceList,
  setAttendance,
  deleteStudent,
  addStudent,
  updateStudent,
  listCourses,
  addCourse,
  updateCourse,
  deleteCourse,
  listEnrollments,
  getToken,
  clearToken,
  getBootstrapStatus,
} from '@/api/admin'
import { AnnouncementAdmin } from './AnnouncementAdmin'
import { ShareLinksAdmin } from './ShareLinksAdmin'
import { StudentAdmin } from './StudentAdmin'
import { CourseAdmin } from './CourseAdmin'
import { ScheduleAdmin } from './ScheduleAdmin'
import { AttendanceAdmin } from './AttendanceAdmin'
import { EnrollmentAdmin } from './EnrollmentAdmin'
import { TransferAdmin } from './TransferAdmin'
import { SystemSettingsAdmin } from './SystemSettingsAdmin'
import { AdminUserAdmin } from './AdminUserAdmin'
import { AuditLogAdmin } from './AuditLogAdmin'
import { ReportsAdmin } from './ReportsAdmin'
import { TeacherAdmin } from './TeacherAdmin'
import { CouponAdmin } from './CouponAdmin'
import { MembershipAdmin } from './MembershipAdmin'
import { LeadAdmin } from './LeadAdmin'
import { DashboardAdmin } from './DashboardAdmin'
import { AdminLogin } from './AdminLogin'
import { Bootstrap } from './Bootstrap'
import { toast, confirmDialog } from '@/components/ui'

interface AdminPanelProps {
  onExit: () => void
}

// 后台子页面类型：null 表示后台主页，其他值表示对应二级页面
type SubPage =
  | 'students'
  | 'courses'
  | 'enrollments'
  | 'transfers'
  | 'schedules'
  | 'attendance'
  | 'announcement'
  | 'shareLinks'
  | 'settings'
  | 'admins'
  | 'auditLogs'
  | 'reports'
  | 'teachers'
  | 'coupons'
  | 'memberships'
  | 'leads'
  | 'dashboard'
  | null

// 从 URL hash 解析当前子页面：#admin/students → 'students'
function readSubPageFromHash(): SubPage {
  try {
    const hash = window.location.hash
    if (!hash.startsWith('#admin')) return null
    const parts = hash.split('/')
    const sub = parts[1]
    if (!sub) return null
    const valid: SubPage[] = [
      'students',
      'courses',
      'enrollments',
      'transfers',
      'schedules',
      'attendance',
      'announcement',
      'shareLinks',
      'settings',
      'admins',
      'auditLogs',
      'reports',
      'teachers',
      'coupons',
      'memberships',
      'leads',
      'dashboard',
    ]
    return valid.includes(sub as SubPage) ? (sub as SubPage) : null
  } catch {
    return null
  }
}

// 写入子页面到 URL hash：#admin 或 #admin/students
function writeSubPageToHash(sub: SubPage) {
  try {
    const url = new URL(window.location.href)
    url.hash = sub ? `admin/${sub}` : 'admin'
    window.history.replaceState({}, '', url.toString())
  } catch {
    // 忽略
  }
}

export function AdminPanel({ onExit }: AdminPanelProps) {
  // 启动流程：先检查 bootstrap 状态，再校验 token
  // bootstrap=true → 渲染引导页；bootstrap=false → 检查 token 决定登录/已登录
  const [bootstrap, setBootstrap] = useState<boolean | null>(null) // null=检查中
  const [authed, setAuthed] = useState<boolean>(false)
  const [checking, setChecking] = useState<boolean>(true)
  const [students, setStudents] = useState<Student[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  // 学员报名汇总：studentId -> 汇总（从全部 active enrollment 聚合）
  const [enrollmentSummaries, setEnrollmentSummaries] = useState<Record<string, EnrollmentSummary>>({})

  // 操作状态
  const [busy, setBusy] = useState(false)

  // 公告设置（公告管理页编辑 + 保存）
  const [announcementText, setAnnouncementText] = useState('')
  const [announcementUpdatedAt, setAnnouncementUpdatedAt] = useState('')

  // 当前激活的二级页面：初始值从 URL hash 恢复，避免刷新时丢失
  const [activeSubPage, setActiveSubPage] = useState<SubPage>(() =>
    readSubPageFromHash(),
  )

  // 切换子页面：同时更新 URL hash
  const goSubPage = (sub: SubPage) => {
    setActiveSubPage(sub)
    writeSubPageToHash(sub)
  }

  // 兼容旧子组件 props：转发到全局命令式 toast
  const showToast = (type: 'success' | 'error' | 'info', message: string) => {
    toast[type](message)
  }

  // 统一错误处理：401 时清除 token 并回到登录页
  const handleApiError = (e: Error) => {
    const msg = e.message || ''
    if (msg.includes('未登录') || msg.includes('登录已过期') || msg.includes('401')) {
      clearToken()
      setAuthed(false)
    }
    toast.error(msg.includes('请求失败') ? msg : '请求失败：' + msg)
  }

  // 加载学员列表（后台默认展示全部）
  const loadStudents = useCallback(async () => {
    try {
      const list = await searchStudents('')
      setStudents(list)
    } catch (e) {
      showToast('error', '加载学员列表失败：' + (e as Error).message)
    }
  }, [])

  // 加载课程列表
  const loadCourses = useCallback(async () => {
    try {
      const result = await listCourses()
      if (result.code === 0) {
        setCourses(result.data.courses)
      }
    } catch (e) {
      // 课程加载失败不阻塞主流程
      console.error('加载课程列表失败:', e)
    }
  }, [])

  // 加载全部报名记录并聚合为「学员 -> 报名汇总」映射，供学员管理页展示
  const loadEnrollmentSummaries = useCallback(async () => {
    try {
      const result = await listEnrollments({ status: 'active' })
      if (result.code !== 0) return
      const map: Record<string, EnrollmentSummary> = {}
      for (const e of result.data.enrollments) {
        let s = map[e.studentId]
        if (!s) {
          s = {
            count: 0,
            purchasedHours: 0,
            giftHours: 0,
            remainingHours: 0,
            remainingPaidHours: 0,
            remainingGiftHours: 0,
            totalAmount: 0,
            paidAmount: 0,
          }
          map[e.studentId] = s
        }
        s.count += 1
        s.purchasedHours += e.purchasedHours
        s.giftHours += e.giftHours
        s.remainingPaidHours += e.remainingPaidHours
        s.remainingGiftHours += e.remainingGiftHours
        s.remainingHours = s.remainingPaidHours + s.remainingGiftHours
        s.totalAmount += e.totalAmount
        s.paidAmount += e.paidAmount
      }
      setEnrollmentSummaries(map)
    } catch (e) {
      console.error('加载报名汇总失败:', e)
    }
  }, [])

  // 启动检查流程：
  // 1. 查询 bootstrap 状态
  // 2. 若处于引导模式 → 渲染引导页（不再检查 token）
  // 3. 否则校验 token：有效则直接进入后台，无效则展示登录页
  useEffect(() => {
    let cancelled = false
    async function checkEntry() {
      // 第一步：查询引导状态
      const { bootstrap: bs } = await getBootstrapStatus()
      if (cancelled) return
      if (bs) {
        setBootstrap(true)
        setChecking(false)
        return
      }
      setBootstrap(false)

      // 第二步：非引导模式，校验 token
      if (!getToken()) {
        setChecking(false)
        setAuthed(false)
        return
      }
      try {
        const result = await verifyAuth()
        if (cancelled) return
        if (result.code === 0) {
          setAuthed(true)
        } else {
          setAuthed(false)
        }
      } catch {
        if (!cancelled) setAuthed(false)
      } finally {
        if (!cancelled) setChecking(false)
      }
    }
    checkEntry()
    return () => {
      cancelled = true
    }
  }, [])

  // 引导创建成功后：切换到登录页
  const handleBootstrapSuccess = () => {
    setBootstrap(false)
    setAuthed(false)
  }

  // 鉴权通过后再加载数据
  useEffect(() => {
    if (!authed) return
    loadStudents()
    loadCourses()
    loadEnrollmentSummaries()
  }, [authed, loadStudents, loadCourses, loadEnrollmentSummaries])

  // 公告：进入公告管理页时加载当前内容
  const handleLoadAnnouncement = useCallback(async () => {
    try {
      const info = await getAnnouncement()
      setAnnouncementText(info.content)
      setAnnouncementUpdatedAt(info.updatedAt)
    } catch {
      // 加载失败不阻塞，保留空内容供管理员写入
    }
  }, [])

  // 公告：保存
  const handleSaveAnnouncement = async () => {
    setBusy(true)
    try {
      const result = await saveAnnouncement(announcementText)
      if (result.code === 0) {
        setAnnouncementUpdatedAt(result.data.updatedAt)
        showToast('success', '公告已保存')
      } else {
        showToast('error', result.message)
      }
    } catch (e) {
      handleApiError(e as Error)
    } finally {
      setBusy(false)
    }
  }

  // 删除学员及其所有排课
  const handleDeleteStudent = async (student: Student) => {
    const ok = await confirmDialog({
      title: '删除学员',
      message: `确认删除学员「${student.name}」(${student.id})？该操作将同时删除该学员的所有排课数据，且不可恢复。`,
      danger: true,
      requireText: student.name,
      confirmText: '确认删除',
    })
    if (!ok) return
    setBusy(true)
    try {
      const result = await deleteStudent(student.id)
      if (result.code === 0) {
        const msg = result.data.studentRemoved
          ? `已删除学员及 ${result.data.deletedScheduleFiles} 个排课文件`
          : '学员不存在（已清理残留排课文件）'
        toast.success(msg)
        await loadStudents()
      } else {
        toast.error(result.message)
      }
    } catch (e) {
      handleApiError(e as Error)
    } finally {
      setBusy(false)
    }
  }

  // 新增学员
  // 返回 true 表示新增成功（弹窗可关闭），false 表示失败（保持弹窗）
  const handleAddStudent = async (student: Student): Promise<boolean> => {
    setBusy(true)
    try {
      const result = await addStudent(student)
      if (result.code === 0) {
        showToast('success', `学员「${student.name}」已新增`)
        await loadStudents()
        return true
      }
      showToast('error', result.message)
      return false
    } catch (e) {
      handleApiError(e as Error)
      return false
    } finally {
      setBusy(false)
    }
  }

  // 更新学员（若姓名变更，后端会级联更新排课中的 studentName）
  const handleUpdateStudent = async (student: Student): Promise<boolean> => {
    setBusy(true)
    try {
      const result = await updateStudent(student)
      if (result.code === 0) {
        showToast('success', result.message)
        await loadStudents()
        return true
      }
      showToast('error', result.message)
      return false
    } catch (e) {
      handleApiError(e as Error)
      return false
    } finally {
      setBusy(false)
    }
  }

  // 新增课程
  const handleAddCourse = async (course: Course): Promise<boolean> => {
    setBusy(true)
    try {
      const result = await addCourse(course)
      if (result.code === 0) {
        showToast('success', `课程「${course.name}」已新增`)
        await loadCourses()
        return true
      }
      showToast('error', result.message)
      return false
    } catch (e) {
      handleApiError(e as Error)
      return false
    } finally {
      setBusy(false)
    }
  }

  // 更新课程
  const handleUpdateCourse = async (course: Course): Promise<boolean> => {
    setBusy(true)
    try {
      const result = await updateCourse(course)
      if (result.code === 0) {
        showToast('success', `课程「${course.name}」已更新`)
        await loadCourses()
        return true
      }
      showToast('error', result.message)
      return false
    } catch (e) {
      handleApiError(e as Error)
      return false
    } finally {
      setBusy(false)
    }
  }

  // 删除课程（同时删除关联排课）
  const handleDeleteCourse = async (course: Course) => {
    const ok = await confirmDialog({
      title: '删除课程',
      message: `确认删除课程「${course.name}」(${course.id})？该操作将同时删除该课程的所有关联排课记录，且不可恢复。`,
      danger: true,
      requireText: course.name,
      confirmText: '确认删除',
    })
    if (!ok) return
    setBusy(true)
    try {
      const result = await deleteCourse(course.id)
      if (result.code === 0) {
        const msg = result.data.courseRemoved
          ? `已删除课程及 ${result.data.deletedScheduleCount} 条关联排课`
          : '课程不存在'
        toast.success(msg)
        await loadCourses()
      } else {
        toast.error(result.message)
      }
    } catch (e) {
      handleApiError(e as Error)
    } finally {
      setBusy(false)
    }
  }

  // 校验中：显示加载状态
  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-sm text-slate-500 flex items-center gap-2">
          <svg className="animate-spin w-4 h-4 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          初始化中…
        </div>
      </div>
    )
  }

  // 引导模式：系统未初始化，渲染超管账号创建页
  if (bootstrap) {
    return (
      <Bootstrap onSuccess={handleBootstrapSuccess} onExit={onExit} />
    )
  }

  // 未登录：渲染登录页
  if (!authed) {
    return (
      <AdminLogin
        onSuccess={() => setAuthed(true)}
        onExit={onExit}
      />
    )
  }

  // 公告管理二级页面
  if (activeSubPage === 'announcement') {
    return (
      <>
        <AnnouncementAdmin
          onBack={() => goSubPage(null)}
          busy={busy}
          announcementText={announcementText}
          setAnnouncementText={setAnnouncementText}
          announcementUpdatedAt={announcementUpdatedAt}
          onSaveAnnouncement={handleSaveAnnouncement}
        />
      </>
    )
  }

  // 分享链接二级页面
  if (activeSubPage === 'shareLinks') {
    return (
      <>
        <ShareLinksAdmin
          students={students}
          onBack={() => goSubPage(null)}
        />
      </>
    )
  }

  // 系统设置二级页面
  if (activeSubPage === 'settings') {
    return (
      <>
        <SystemSettingsAdmin
          onBack={() => goSubPage(null)}
          busy={busy}
          setBusy={setBusy}
          showToast={showToast}
        />
      </>
    )
  }

  // 学员管理二级页面
  if (activeSubPage === 'students') {
    return (
      <>
        <StudentAdmin
          students={students}
          summaries={enrollmentSummaries}
          busy={busy}
          onBack={() => goSubPage(null)}
          onDelete={handleDeleteStudent}
          onAdd={handleAddStudent}
          onUpdate={handleUpdateStudent}
        />
      </>
    )
  }

  // 课程管理二级页面
  if (activeSubPage === 'courses') {
    return (
      <>
        <CourseAdmin
          courses={courses}
          busy={busy}
          onBack={() => goSubPage(null)}
          onDelete={handleDeleteCourse}
          onAdd={handleAddCourse}
          onUpdate={handleUpdateCourse}
        />
      </>
    )
  }

  // 报名管理二级页面
  if (activeSubPage === 'enrollments') {
    return (
      <>
        <EnrollmentAdmin
          students={students}
          courses={courses}
          busy={busy}
          onBack={() => goSubPage(null)}
          showToast={showToast}
          onAuthError={handleApiError}
        />
      </>
    )
  }

  // 结转管理二级页面
  if (activeSubPage === 'transfers') {
    return (
      <>
        <TransferAdmin
          students={students}
          courses={courses}
          busy={busy}
          onBack={() => goSubPage(null)}
          showToast={showToast}
          onAuthError={handleApiError}
        />
      </>
    )
  }

  // 排课管理二级页面
  if (activeSubPage === 'schedules') {
    return (
      <>
        <ScheduleAdmin
          students={students}
          courses={courses}
          onBack={() => goSubPage(null)}
          onToast={showToast}
        />
      </>
    )
  }

  // 点名管理二级页面
  if (activeSubPage === 'attendance') {
    return (
      <>
        <AttendanceAdmin
          busy={busy}
          onBack={() => goSubPage(null)}
          onLoad={async (d) => {
            const r = await getAttendanceList(d)
            if (r.code !== 0) throw new Error(r.message)
            return r.data
          }}
          onSave={async (d, items) => {
            const r = await setAttendance(d, items)
            if (r.code !== 0) throw new Error(r.message)
            // 保存后刷新报名汇总（剩余课时已按报名记录扣减）
            await loadEnrollmentSummaries()
            return r.data
          }}
        />
      </>
    )
  }

  // 管理员账号管理二级页面（仅超管）
  if (activeSubPage === 'admins') {
    return <AdminUserAdmin onBack={() => goSubPage(null)} />
  }

  // 审计日志二级页面（仅超管）
  if (activeSubPage === 'auditLogs') {
    return <AuditLogAdmin onBack={() => goSubPage(null)} />
  }

  // 报表中心二级页面
  if (activeSubPage === 'reports') {
    return <ReportsAdmin onBack={() => goSubPage(null)} />
  }

  if (activeSubPage === 'dashboard') {
    return <DashboardAdmin onBack={() => goSubPage(null)} />
  }
  if (activeSubPage === 'teachers') {
    return <TeacherAdmin onBack={() => goSubPage(null)} />
  }
  if (activeSubPage === 'coupons') {
    return <CouponAdmin onBack={() => goSubPage(null)} />
  }
  if (activeSubPage === 'memberships') {
    return <MembershipAdmin students={students} onBack={() => goSubPage(null)} />
  }
  if (activeSubPage === 'leads') {
    return <LeadAdmin onBack={() => goSubPage(null)} />
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* 顶部栏 */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-lg font-semibold text-slate-800">后台管理</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                clearToken()
                setAuthed(false)
              }}
              className="btn-ghost"
              title="退出登录"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="hidden sm:inline">退出登录</span>
            </button>
            <button onClick={onExit} className="btn-ghost">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="hidden sm:inline">返回首页</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* 学员管理入口 */}
        <section className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <span className="w-1 h-4 bg-brand-500 rounded"></span>
                学员管理
              </h2>
              <div className="text-xs text-slate-500 mt-1.5 ml-3">
                查看和管理学员数据
              </div>
            </div>
            <button
              onClick={() => goSubPage('students')}
              className="btn-primary text-sm py-1.5 px-3"
            >
              进入学员管理 →
            </button>
          </div>
        </section>

        {/* 课程管理入口 */}
        <section className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <span className="w-1 h-4 bg-brand-500 rounded"></span>
                课程管理
              </h2>
              <div className="text-xs text-slate-500 mt-1.5 ml-3">
                查看和管理课程数据
              </div>
            </div>
            <button
              onClick={() => goSubPage('courses')}
              className="btn-primary text-sm py-1.5 px-3"
            >
              进入课程管理 →
            </button>
          </div>
        </section>

        {/* 报名管理入口 */}
        <section className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <span className="w-1 h-4 bg-brand-500 rounded"></span>
                报名管理
              </h2>
              <div className="text-xs text-slate-500 mt-1.5 ml-3">
                学员报名课程、购课赠课、剩余课时管理
              </div>
            </div>
            <button
              onClick={() => goSubPage('enrollments')}
              className="btn-primary text-sm py-1.5 px-3"
            >
              进入报名管理 →
            </button>
          </div>
        </section>

        {/* 结转管理入口 */}
        <section className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <span className="w-1 h-4 bg-brand-500 rounded"></span>
                结转管理
              </h2>
              <div className="text-xs text-slate-500 mt-1.5 ml-3">
                学员升班/转课结转，默认按金额，可选按课时
              </div>
            </div>
            <button
              onClick={() => goSubPage('transfers')}
              className="btn-primary text-sm py-1.5 px-3"
            >
              进入结转管理 →
            </button>
          </div>
        </section>

        {/* 排课管理入口 */}
        <section className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <span className="w-1 h-4 bg-brand-500 rounded"></span>
                排课管理
              </h2>
              <div className="text-xs text-slate-500 mt-1.5 ml-3">
                查看和管理排课数据
              </div>
            </div>
            <button
              onClick={() => goSubPage('schedules')}
              className="btn-primary text-sm py-1.5 px-3"
            >
              进入排课管理 →
            </button>
          </div>
        </section>

        {/* 点名管理入口 */}
        <section className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <span className="w-1 h-4 bg-brand-500 rounded"></span>
                点名管理
              </h2>
              <div className="text-xs text-slate-500 mt-1.5 ml-3">
                查看和管理点名数据
              </div>
            </div>
            <button
              onClick={() => goSubPage('attendance')}
              className="btn-primary text-sm py-1.5 px-3"
            >
              进入点名管理 →
            </button>
          </div>
        </section>

        {/* 公告管理入口 */}
        <section className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <span className="w-1 h-4 bg-brand-500 rounded"></span>
                公告管理
              </h2>
              <div className="text-xs text-slate-500 mt-1.5 ml-3">
                查看和管理公告内容
              </div>
            </div>
            <button
              onClick={() => {
                handleLoadAnnouncement()
                goSubPage('announcement')
              }}
              className="btn-primary text-sm py-1.5 px-3"
            >
              进入公告管理 →
            </button>
          </div>
        </section>

        {/* 分享链接入口 */}
        <section className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <span className="w-1 h-4 bg-brand-500 rounded"></span>
                分享链接
              </h2>
              <div className="text-xs text-slate-500 mt-1.5 ml-3">
                查看和生成分享链接
              </div>
            </div>
            <button
              onClick={() => goSubPage('shareLinks')}
              className="btn-primary text-sm py-1.5 px-3"
            >
              进入分享链接 →
            </button>
          </div>
        </section>

        {/* 系统设置入口 */}
        <section className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <span className="w-1 h-4 bg-brand-500 rounded"></span>
                系统设置
              </h2>
              <div className="text-xs text-slate-500 mt-1.5 ml-3">
                修改项目名称等系统配置
              </div>
            </div>
            <button
              onClick={() => goSubPage('settings')}
              className="btn-primary text-sm py-1.5 px-3"
            >
              进入系统设置 →
            </button>
          </div>
        </section>

        {/* 管理员账号入口（仅超管） */}
        <section className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <span className="w-1 h-4 bg-brand-500 rounded"></span>
                管理员账号
              </h2>
              <div className="text-xs text-slate-500 mt-1.5 ml-3">
                增删管理员、重置密码、启停账号（仅超级管理员可用）
              </div>
            </div>
            <button
              onClick={() => goSubPage('admins')}
              className="btn-primary text-sm py-1.5 px-3"
            >
              进入管理员账号 →
            </button>
          </div>
        </section>

        {/* 审计日志入口（仅超管） */}
        <section className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <span className="w-1 h-4 bg-brand-500 rounded"></span>
                审计日志
              </h2>
              <div className="text-xs text-slate-500 mt-1.5 ml-3">
                查看所有写操作的留痕记录，支持按模块/操作者筛选
              </div>
            </div>
            <button
              onClick={() => goSubPage('auditLogs')}
              className="btn-primary text-sm py-1.5 px-3"
            >
              进入审计日志 →
            </button>
          </div>
        </section>

        {/* 报表中心入口 */}
        <section className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <span className="w-1 h-4 bg-brand-500 rounded"></span>
                报表中心
              </h2>
              <div className="text-xs text-slate-500 mt-1.5 ml-3">
                营收、课时消耗、剩余课时、出勤率、结转、报名统计
              </div>
            </div>
            <button
              onClick={() => goSubPage('reports')}
              className="btn-primary text-sm py-1.5 px-3"
            >
              进入报表中心 →
            </button>
          </div>
        </section>

        {/* 数据看板入口 */}
        <section className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <span className="w-1 h-4 bg-brand-500 rounded"></span>
                数据看板
              </h2>
              <div className="text-xs text-slate-500 mt-1.5 ml-3">
                营收、课时、报名、转化率关键指标实时大屏
              </div>
            </div>
            <button onClick={() => goSubPage('dashboard')} className="btn-primary text-sm py-1.5 px-3">
              进入数据看板 →
            </button>
          </div>
        </section>

        {/* 教师管理入口 */}
        <section className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <span className="w-1 h-4 bg-brand-500 rounded"></span>
                教师管理
              </h2>
              <div className="text-xs text-slate-500 mt-1.5 ml-3">
                课后反馈记录、教师绩效（课时数、到课率、评分）
              </div>
            </div>
            <button onClick={() => goSubPage('teachers')} className="btn-primary text-sm py-1.5 px-3">
              进入教师管理 →
            </button>
          </div>
        </section>

        {/* 优惠券入口 */}
        <section className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <span className="w-1 h-4 bg-brand-500 rounded"></span>
                优惠券
              </h2>
              <div className="text-xs text-slate-500 mt-1.5 ml-3">
                折扣/满减优惠券管理，报名时抵扣
              </div>
            </div>
            <button onClick={() => goSubPage('coupons')} className="btn-primary text-sm py-1.5 px-3">
              进入优惠券 →
            </button>
          </div>
        </section>

        {/* 会员卡入口 */}
        <section className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <span className="w-1 h-4 bg-brand-500 rounded"></span>
                会员卡
              </h2>
              <div className="text-xs text-slate-500 mt-1.5 ml-3">
                月卡/期卡/年卡/次卡管理，学员办卡与到期管理
              </div>
            </div>
            <button onClick={() => goSubPage('memberships')} className="btn-primary text-sm py-1.5 px-3">
              进入会员卡 →
            </button>
          </div>
        </section>

        {/* 线索管理入口 */}
        <section className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                <span className="w-1 h-4 bg-brand-500 rounded"></span>
                线索管理
              </h2>
              <div className="text-xs text-slate-500 mt-1.5 ml-3">
                CRM 线索跟踪、阶段流转、跟进记录、转化分析
              </div>
            </div>
            <button onClick={() => goSubPage('leads')} className="btn-primary text-sm py-1.5 px-3">
              进入线索管理 →
            </button>
          </div>
        </section>
      </main>
    </div>
  )
}

