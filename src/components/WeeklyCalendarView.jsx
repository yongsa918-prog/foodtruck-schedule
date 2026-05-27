import { truckClass, isMatchNote } from '../utils/colors'

const DOW_LABELS = ['일', '월', '화', '수', '목', '금', '토']

function formatDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function ShiftCard({ shift }) {
  const cls = truckClass(shift.truck)
  const label = shift.shift_label
    ? `${shift.truck} ${shift.shift_label}`
    : shift.truck
  const matchNote = isMatchNote(shift.note)

  return (
    <div className={`shift-card ${cls}`}>
      <div className="shift-top">
        <span className={`badge ${cls}`}>{label}</span>
        {shift.time_text && <span className="shift-time">{shift.time_text}</span>}
        {shift.hours && <span className="shift-hours">{shift.hours}h</span>}
      </div>
      {shift.event && <div className="shift-event">{shift.event}</div>}
      {shift.assignment && shift.assignment.length > 0 && (
        <div className="shift-chips">
          {shift.assignment.map((a) => (
            <span key={a.id} className="chip">
              {a.member_text}
              {a.is_driver && !a.member_text.includes('(D)') ? ' (D)' : ''}
              {a.is_tentative && !a.member_text.includes('?') ? '?' : ''}
            </span>
          ))}
        </div>
      )}
      {shift.note && (
        <div className={`shift-note ${matchNote ? 'match' : ''}`}>
          {shift.note}
        </div>
      )}
    </div>
  )
}

export default function WeeklyCalendarView({ shifts, weekStart, onDayClick, bulkMode, selectedDates }) {
  const todayStr = formatDateStr(new Date())

  const days = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    const dateStr = formatDateStr(d)
    const dayShifts = shifts.filter((s) => s.work_date === dateStr)
    days.push({ date: d, dateStr, shifts: dayShifts })
  }

  return (
    <div>
      <div className="legend">
        <div className="legend-item"><span className="swatch" style={{ background: 'var(--t1)' }} />1호</div>
        <div className="legend-item"><span className="swatch" style={{ background: 'var(--t2)' }} />2호</div>
        <div className="legend-item"><span className="swatch" style={{ background: 'var(--prep)' }} />프랩</div>
        <div className="legend-item"><span className="swatch" style={{ background: 'var(--cater)' }} />케이터링</div>
        <div className="legend-item"><span className="swatch" style={{ background: 'var(--match)' }} />경기일</div>
      </div>

      <div className="week-list">
        {days.map(({ date, dateStr, shifts: dayShifts }) => {
          const dow = date.getDay()
          const isWeekend = dow === 0 || dow === 6
          const isToday = dateStr === todayStr
          const isEmpty = dayShifts.length === 0
          const isSelected = bulkMode && selectedDates?.has(dateStr)

          return (
            <div
              key={dateStr}
              className={`week-day ${isEmpty ? 'off' : ''} ${isToday ? 'today' : ''} ${onDayClick ? 'clickable' : ''} ${isSelected ? 'bulk-selected' : ''}`}
              onClick={() => onDayClick && onDayClick(date)}
            >
              <div className={`week-day-header ${isEmpty ? 'no-shifts' : ''}`}>
                {bulkMode && <span className={`bulk-check ${isSelected ? 'on' : ''}`}>{isSelected ? '✓' : '○'}</span>}
                <span className="week-day-num">{date.getDate()}</span>
                <span className={`week-day-dow ${isWeekend ? 'we' : ''}`}>{DOW_LABELS[dow]}</span>
                {isToday && <span className="week-day-today">오늘</span>}
                {isEmpty && <span className="week-day-off">휴무</span>}
              </div>
              {!isEmpty && (
                <div className="week-day-shifts">
                  {dayShifts.map((s) => <ShiftCard key={s.id} shift={s} />)}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="footer">
        <span><b>(D)</b> = 운전 담당</span>
        <span><b>?</b> = 미확정</span>
        <span><b>h</b> = 근무시간</span>
      </div>
    </div>
  )
}
