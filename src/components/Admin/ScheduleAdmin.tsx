import { useCallback, useEffect, useState } from 'react'
import type { Course, Schedule, Student } from '@/types'
import { getSchedules } from '@/api'
import { deleteSchedule } from '@/api/admin'
import { SearchBar } from '@/components/SearchBar'
import { ScheduleEditor } from './ScheduleEditor'
import { ScheduleAddModal } from './ScheduleAddModal'

interface ScheduleAdminProps {
  students: Student[]
  courses: Course[]
  onBack: () => void
  onToast: (type: 'success' | 'error' | 'info', message: string) => void
}

export function ScheduleAdmin({ students, courses, onBack, onToast }: ScheduleAdminProps) {
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loadingSchedules, setLoadingSchedules] = useState(false)
  const [busy, setBusy] = useState(false)

  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null)
  const [addingSchedule, setAddingSchedule] = useState(false)

  // 加载某学员排课
  const loadSchedules = useCallback(async (studentId: string) => {
    if (!studentId) {
      setSchedules([])
      return
    }
    setLoadingSchedules(true)
    try {
      const list = await getSchedules(studentId)
      setSchedules(list)
    } catch (e) {
      onToast('error', '加载排课失败：' + (e as Error).message)
      setSchedules([])
    } finally {
      setLoadingSchedules(false)
    }
  }, [onToast])

  useEffect(() => {
    if (selectedStudent) loadSchedules(selectedStudent.id)
    else setSchedules([])
  }, [selectedStudent, loadSchedules])

  // 删除单条排课
  const handleDeleteSchedule = async (schedule: Schedule) => {
    if (!confirm(`确认删除「${schedule.courseName}」(${schedule.date})？`)) return
    setBusy(true)
    try {
      const result = await deleteSchedule(schedule.id, schedule.studentId, schedule.date)
      if (result.code === 0) {
        onToast('success', '排课已删除')
        if (selectedStudent) await loadSchedules(selectedStudent.id)
      } else {
        onToast('error', result.message)
      }
    } catch (e) {
      onToast('error', '请求失败：' + (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  // 新增/编辑后刷新
  const handleEditorUpdated = async () => {
    if (selectedStudent) await loadSchedules(selectedStudent.id)
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* 顶部栏 */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="text-slate-500 hover:text-slate-700 text-sm flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              返回后台
            </button>
            <span className="text-slate-300">/</span>
            <h1 className="text-base font-semibold text-slate-800">排课管理</h1>
          </div>
          <div className="flex items-center gap-3">
            {selectedStudent && (
              <span className="text-xs text-slate-400 hidden sm:block">
                {selectedStudent.name} · {schedules.length} 条排课
              </span>
            )}
            <button
              onClick={() => setAddingSchedule(true)}
              disabled={busy || students.length === 0 || courses.length === 0}
              className="btn-primary text-sm py-1.5 px-3 disabled:opacity-50"
              title={
                students.length === 0
                  ? '请先添加学员数据'
                  : courses.length === 0
                    ? '请先在课程管理中添加课程'
                    : '按课程为多个学员批量排课'
              }
            >
              + 新增排课
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        {/* 学员搜索 */}
        <section className="card p-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <span className="text-sm text-slate-500">搜索学员：</span>
            <div className="w-full max-w-md">
              <SearchBar onSelectStudent={setSelectedStudent} />
            </div>
            {selectedStudent && (
              <span className="text-xs text-slate-400">
                当前：{selectedStudent.name}
              </span>
            )}
          </div>
        </section>

        {/* 排课列表 */}
        <section className="card p-5">
          {!selectedStudent ? (
            <div className="text-center py-10 text-slate-400 text-sm">
              请搜索并选择学员查看排课列表
            </div>
          ) : loadingSchedules ? (
            <div className="text-center py-10">
              <div className="w-8 h-8 border-2 border-slate-200 border-t-brand-500 rounded-full animate-spin mx-auto" />
            </div>
          ) : schedules.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-sm">该学员暂无排课</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 text-xs">
                    <th className="text-left py-2 px-2 font-medium">课程</th>
                    <th className="text-left py-2 px-2 font-medium">日期</th>
                    <th className="text-left py-2 px-2 font-medium">时间</th>
                    <th className="text-left py-2 px-2 font-medium">教师</th>
                    <th className="text-left py-2 px-2 font-medium">地点</th>
                    <th className="text-right py-2 px-2 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {schedules.map((s) => (
                    <tr
                      key={s.id}
                      className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                    >
                      <td className="py-2.5 px-2">
                        <div className="font-medium text-slate-700">{s.courseName}</div>
                        <div className="text-xs text-slate-400 font-mono">{s.id}</div>
                      </td>
                      <td className="py-2.5 px-2 text-slate-600">{s.date}</td>
                      <td className="py-2.5 px-2 text-slate-600">
                        {s.startTime}-{s.endTime}
                      </td>
                      <td className="py-2.5 px-2 text-slate-600">{s.teacher}</td>
                      <td className="py-2.5 px-2 text-slate-600">{s.location}</td>
                      <td className="py-2.5 px-2 text-right whitespace-nowrap">
                        <button
                          onClick={() => setEditingSchedule(s)}
                          disabled={busy}
                          className="text-brand-600 hover:text-brand-700 text-xs font-medium mr-3 disabled:opacity-50"
                        >
                          编辑
                        </button>
                        <button
                          onClick={() => handleDeleteSchedule(s)}
                          disabled={busy}
                          className="text-rose-600 hover:text-rose-700 text-xs font-medium disabled:opacity-50"
                        >
                          删除
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {/* 编辑弹窗 */}
      <ScheduleEditor
        schedule={editingSchedule}
        students={students}
        onClose={() => setEditingSchedule(null)}
        onUpdated={handleEditorUpdated}
      />

      {/* 新增弹窗 */}
      {addingSchedule && (
        <ScheduleAddModal
          courses={courses}
          students={students}
          onClose={() => setAddingSchedule(false)}
          onUpdated={handleEditorUpdated}
        />
      )}
    </div>
  )
}
