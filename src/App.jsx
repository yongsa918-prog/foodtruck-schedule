import { useState } from 'react'
import CalendarView from './components/CalendarView'
import PersonalView from './components/PersonalView'
import DayEditModal from './components/DayEditModal'
import ExcelUpload from './components/ExcelUpload'
import AdminLock from './components/AdminLock'
import { useScheduleData } from './hooks/useScheduleData'
import { useAdmin } from './hooks/useAdminAuth'

export default function App() {
  const [tab, setTab] = useState('calendar')
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [editDate, setEditDate] = useState(null)
  const [showExcel, setShowExcel] = useState(false)
  const { isAdmin } = useAdmin()

  const { shifts, staff, loading, error, refresh } = useScheduleData(year, month)

  function prevMonth() {
    if (month === 1) { setYear(year - 1); setMonth(12) }
    else setMonth(month - 1)
  }
  function nextMonth() {
    if (month === 12) { setYear(year + 1); setMonth(1) }
    else setMonth(month + 1)
  }

  function handleDayClick(day) {
    if (!isAdmin) return
    setEditDate(new Date(year, month - 1, day))
  }

  function handleModalClose() {
    setEditDate(null)
  }

  function handleSaved() {
    refresh()
  }

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
        <button
          className={`tab ${tab === 'calendar' ? 'active' : ''}`}
          onClick={() => setTab('calendar')}
        >
          월간 달력
        </button>
        <button
          className={`tab ${tab === 'personal' ? 'active' : ''}`}
          onClick={() => setTab('personal')}
        >
          개인별 보기
        </button>
      </div>

      <div className="month-nav">
        <button onClick={prevMonth}>◀</button>
        <span className="month-label">{year}년 {month}월</span>
        <button onClick={nextMonth}>▶</button>
        {isAdmin && (
          <button className="btn-excel" onClick={() => setShowExcel(true)}>
            📊 엑셀 업로드
          </button>
        )}
      </div>

      {loading && <div className="loading">불러오는 중...</div>}
      {error && <div className="error">오류: {error}</div>}

      {!loading && !error && tab === 'calendar' && (
        <CalendarView shifts={shifts} year={year} month={month} onDayClick={isAdmin ? handleDayClick : undefined} />
      )}
      {!loading && !error && tab === 'personal' && (
        <PersonalView shifts={shifts} staff={staff} onSaved={handleSaved} />
      )}

      {editDate && (
        <DayEditModal
          date={editDate}
          shifts={shifts}
          staff={staff}
          onClose={handleModalClose}
          onSaved={handleSaved}
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
