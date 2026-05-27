import { truckClass, isMatchNote } from '../utils/colors'

const DOW_LABELS = ['일', '월', '화', '수', '목', '금', '토']

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
              {a.is_driver ? ' (D)' : ''}
              {a.is_tentative ? '?' : ''}
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

export default function CalendarView({ shifts, year, month, onDayClick }) {
  const firstDay = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const prevMonthDays = new Date(year, month - 1, 0).getDate()

  const shiftsByDate = {}
  shifts.forEach((s) => {
    const day = parseInt(s.work_date.split('-')[2], 10)
    if (!shiftsByDate[day]) shiftsByDate[day] = []
    shiftsByDate[day].push(s)
  })

  const cells = []

  for (let i = 0; i < firstDay; i++) {
    cells.push({ day: prevMonthDays - firstDay + 1 + i, type: 'out' })
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dayShifts = shiftsByDate[d] || []
    cells.push({ day: d, type: dayShifts.length > 0 ? 'active' : 'empty', shifts: dayShifts })
  }

  const remaining = 7 - (cells.length % 7)
  if (remaining < 7) {
    for (let i = 1; i <= remaining; i++) {
      cells.push({ day: i, type: 'out' })
    }
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

      <div className="dow-row">
        {DOW_LABELS.map((d, i) => (
          <div key={d} className={`dow ${i === 0 || i === 6 ? 'we' : ''}`}>{d}</div>
        ))}
      </div>

      <div className="cal-grid">
        {cells.map((cell, idx) => (
          <div
            key={idx}
            className={`cal-cell ${cell.type} ${cell.type !== 'out' ? 'clickable' : ''}`}
            onClick={() => cell.type !== 'out' && onDayClick && onDayClick(cell.day)}
          >
            <div className="day-num">{cell.day}</div>
            {cell.type === 'empty' && <div className="day-off">휴무</div>}
            {cell.type === 'active' && cell.shifts.map((s) => (
              <ShiftCard key={s.id} shift={s} />
            ))}
          </div>
        ))}
      </div>

      <div className="footer">
        <span><b>(D)</b> = 운전 담당</span>
        <span><b>?</b> = 미확정</span>
        <span><b>h</b> = 근무시간</span>
      </div>
    </div>
  )
}
