import { useState, useMemo } from 'react'
import CalendarView from './components/CalendarView'
import WeeklyCalendarView from './components/WeeklyCalendarView'
import PersonalView from './components/PersonalView'
import DayEditModal from './components/DayEditModal'
import ExcelUpload from './components/ExcelUpload'
import AdminLock from './components/AdminLock'
import { useScheduleData } from './hooks/useScheduleData'
import { useAdmin } from './hooks/useAdminAuth'

function pad2(n) { return String(n).padStart(2, '0') }

function formatDate(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function getMonday(d) {
  const date = new Date(d)
  const day = date.getDay()
  date.setDate(date.getDate() - day + (day === 0 ? -6 : 1))
  date.setHours(0, 0, 0, 0)
  return date
}

export default function App() {
  const [tab, setTab] = useState('weekly')
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [weekStart, setWeekStart] = useState(() => getMonday(now))
  const [editDate, setEditDate] = useState(null)
  const [showExcel, setShowExcel] = useState(false)
  const { isAdmin } = useAdmin()

  const activeTab = (!isAdmin && tab === 'monthly') ? 'weekly' : tab

  const thisMonday = useMemo(() => getMonday(new Date()), [])
  const nextMonday = useMemo(() => {
    const d = new Date(thisMonday)
    d.setDate(d.getDate() + 7)
    return d
  }, [thisMonday])

  const canPrevWeek = isAdmin || weekStart.getTime() > thisMonday.getTime()
  const canNextWeek = isAdmin || weekStart.getTime() < nextMonday.getTime()

  const { startDate, endDate } = useMemo(() => {
    if (isAdmin && activeTab !== 'weekly') {
      const s = `${year}-${pad2(month)}-01`
      const nm = month === 12 ? 1 : month + 1
      const ny = month === 12 ? year + 1 : year
      return { startDate: s, endDate: `${ny}-${pad2(nm)}-01` }
    }
    if (isAdmin && activeTab === 'weekly') {
      const s = formatDate(weekStart)
      const we = new Date(weekStart)
      we.setDate(we.getDate() + 7)
      return { startDate: s, endDate: formatDate(we) }
    }
    const s = formatDate(thisMonday)
    const end = new Date(thisMonday)
    end.setDate(end.getDate() + 14)
    return { startDate: s, endDate: formatDate(end) }
  }, [isAdmin, activeTab, year, month, weekStart, thisMonday])

  const { shifts, staff, loading, error, refresh } = useScheduleData(startDate, endDate)

  function prevMonth() {
    if (month === 1) { setYear(year - 1); setMonth(12) }
    else setMonth(month - 1)
  }
  function nextMonth() {
    if (month === 12) { setYear(year + 1); setMonth(1) }
    else setMonth(month + 1)
  }
  function prevWeek() {
    if (!canPrevWeek) return
    const d = new Date(weekStart)
    d.setDate(d.getDate() - 7)
    setWeekStart(d)
    if (isAdmin) { setYear(d.getFullYear()); setMonth(d.getMonth() + 1) }
  }
  function nextWeek() {
    if (!canNextWeek) return
    const d = new Date(weekStart)
    d.setDate(d.getDate() + 7)
    setWeekStart(d)
    if (isAdmin) { setYear(d.getFullYear()); setMonth(d.getMonth() + 1) }
  }

  function handleDayClick(day) {
    if (!isAdmin) return
    setEditDate(new Date(year, month - 1, day))
  }

  function handleWeekDayClick(date) {
    if (!isAdmin) return
    setEditDate(new Date(date))
  }

  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)
  const weekLabel = `${weekStart.getMonth() + 1}/${weekStart.getDate()} – ${weekEnd.getMonth() + 1}/${weekEnd.getDate()}`

  return (
    <div className="app">
      <div className="header">
        <div>
          <div className="header-title">푸드트럭 스케줄</div>
          <div className="header-sub">
            Vancouver · {isAdmin ? '편집 모드' : '읽기 전용'}
          </div>
        </div>
        <AdminLock />
      </div>

      <div className="tabs">
        {isAdmin && (
          <button
            className={`tab ${activeTab === 'monthly' ? 'active' : ''}`}
            onClick={() => setTab('monthly')}
          >
            월간 달력
          </button>
        )}
        <button
          className={`tab ${activeTab === 'weekly' ? 'active' : ''}`}
          onClick={() => setTab('weekly')}
        >
          주간 달력
        </button>
        <button
          className={`tab ${activeTab === 'personal' ? 'active' : ''}`}
          onClick={() => setTab('personal')}
        >
          개인별 보기
        </button>
      </div>

      {isAdmin && activeTab !== 'weekly' ? (
        <div className="month-nav">
          <button onClick={prevMonth}>◀</button>
          <span className="month-label">{year}년 {month}월</span>
          <button onClick={nextMonth}>▶</button>
          <button className="btn-excel" onClick={() => setShowExcel(true)}>
            📊 엑셀 업로드
          </button>
        </div>
      ) : (
        <div className="month-nav">
          <button onClick={prevWeek} disabled={!canPrevWeek}>◀</button>
          <span className="month-label">{weekLabel}</span>
          <button onClick={nextWeek} disabled={!canNextWeek}>▶</button>
          {isAdmin && (
            <button className="btn-excel" onClick={() => setShowExcel(true)}>
              📊 엑셀 업로드
            </button>
          )}
        </div>
      )}

      {loading && <div className="loading">불러오는 중...</div>}
      {error && <div className="error">오류: {error}</div>}

      {!loading && !error && activeTab === 'monthly' && isAdmin && (
        <CalendarView shifts={shifts} year={year} month={month} onDayClick={handleDayClick} />
      )}
      {!loading && !error && activeTab === 'weekly' && (
        <WeeklyCalendarView
          shifts={shifts}
          weekStart={weekStart}
          onDayClick={isAdmin ? handleWeekDayClick : undefined}
        />
      )}
      {!loading && !error && activeTab === 'personal' && (
        <PersonalView shifts={shifts} staff={staff} onSaved={refresh} />
      )}

      {editDate && (
        <DayEditModal
          date={editDate}
          shifts={shifts}
          staff={staff}
          onClose={() => setEditDate(null)}
          onSaved={refresh}
        />
      )}

      {showExcel && (
        <ExcelUpload
          staff={staff}
          onDone={() => { setShowExcel(false); refresh() }}
        />
      )}
    </div>
  )
}
