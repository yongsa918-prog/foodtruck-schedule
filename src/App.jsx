import { useState } from 'react'
import CalendarView from './components/CalendarView'
import PersonalView from './components/PersonalView'
import DayEditModal from './components/DayEditModal'
import { useScheduleData } from './hooks/useScheduleData'

export default function App() {
  const [tab, setTab] = useState('calendar')
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [editDate, setEditDate] = useState(null)

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
        <div className="header-title">푸드트럭 스케줄</div>
        <div className="header-sub">Vancouver · 날짜를 눌러 편집</div>
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
      </div>

      {loading && <div className="loading">불러오는 중...</div>}
      {error && <div className="error">오류: {error}</div>}

      {!loading && !error && tab === 'calendar' && (
        <CalendarView shifts={shifts} year={year} month={month} onDayClick={handleDayClick} />
      )}
      {!loading && !error && tab === 'personal' && (
        <PersonalView shifts={shifts} staff={staff} />
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
    </div>
  )
}
