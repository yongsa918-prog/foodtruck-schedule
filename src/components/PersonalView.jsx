import { useMemo, useState } from 'react'
import { truckClass, isMatchNote } from '../utils/colors'

const DOW = ['일', '월', '화', '수', '목', '금', '토']

function getAssignmentsForStaff(shifts, staffId) {
  const result = []
  for (const shift of shifts) {
    const myAssignment = (shift.assignment || []).find((a) => a.staff_id === staffId)
    if (myAssignment) {
      result.push({ shift, assignment: myAssignment })
    }
  }
  return result
}

function PersonShiftCard({ shift, assignment, staffId }) {
  const cls = truckClass(shift.truck)
  const label = shift.shift_label ? `${shift.truck} ${shift.shift_label}` : shift.truck
  const matchNote = isMatchNote(shift.note)
  const others = (shift.assignment || [])
    .filter((a) => a.staff_id !== staffId)
    .map((a) => a.member_text + (a.is_driver ? ' (D)' : ''))

  return (
    <div className={`p-shift-card ${cls}`}>
      <div className="p-top">
        <span className={`p-badge ${cls}`}>{label}</span>
        {shift.time_text && <span className="p-time">{shift.time_text}</span>}
        {shift.hours && <span className="p-hours">{shift.hours}h</span>}
      </div>
      {shift.event && <div className="p-event">{shift.event}</div>}
      {assignment.is_driver && <div className="p-role">운전 (D)</div>}
      <div className="p-with">
        <b>함께 </b>
        {others.length > 0 ? others.join(', ') : '—'}
      </div>
      {shift.note && (
        <div className={`p-note ${matchNote ? 'match' : ''}`}>{shift.note}</div>
      )}
    </div>
  )
}

export default function PersonalView({ shifts, staff }) {
  const [selectedId, setSelectedId] = useState(null)

  const staffWithCounts = useMemo(() => {
    return staff.map((s) => ({
      ...s,
      count: getAssignmentsForStaff(shifts, s.id).length,
    }))
  }, [shifts, staff])

  const activeStaffId = selectedId || (staffWithCounts.length > 0 ? staffWithCounts[0].id : null)

  const myShifts = useMemo(() => {
    if (!activeStaffId) return []
    return getAssignmentsForStaff(shifts, activeStaffId)
  }, [shifts, activeStaffId])

  const totalHours = myShifts.reduce((sum, { shift }) => {
    return sum + (parseFloat(shift.hours) || 0)
  }, 0)

  const uniqueDays = new Set(myShifts.map(({ shift }) => shift.work_date)).size

  const activePerson = staff.find((s) => s.id === activeStaffId)

  const shiftsByDate = useMemo(() => {
    const grouped = {}
    for (const item of myShifts) {
      const date = item.shift.work_date
      if (!grouped[date]) grouped[date] = []
      grouped[date].push(item)
    }
    return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b))
  }, [myShifts])

  return (
    <div>
      <div className="picker-label">이름 선택</div>
      <div className="picker">
        {staffWithCounts.map((s) => (
          <button
            key={s.id}
            className={`pick-btn ${s.id === activeStaffId ? 'active' : ''}`}
            onClick={() => setSelectedId(s.id)}
          >
            {s.name}
            <span className="cnt">{s.count}</span>
          </button>
        ))}
      </div>

      {activePerson && (
        <>
          <div className="person-header">
            <div className="person-name">{activePerson.name}</div>
            <div className="person-stats">
              <div className="stat-box">
                <div className="stat-num">{uniqueDays}</div>
                <div className="stat-label">근무일</div>
              </div>
              <div className="stat-box">
                <div className="stat-num">{myShifts.length}</div>
                <div className="stat-label">시프트</div>
              </div>
              <div className="stat-box">
                <div className="stat-num">{totalHours ? Math.round(totalHours * 10) / 10 : '–'}</div>
                <div className="stat-label">예상 시간</div>
              </div>
            </div>
          </div>

          {shiftsByDate.length === 0 && (
            <div className="empty-msg">배정된 시프트가 없습니다.</div>
          )}

          {shiftsByDate.map(([date, items]) => {
            const d = new Date(date + 'T00:00:00')
            const dayNum = d.getDate()
            const dowStr = DOW[d.getDay()]
            const isWe = d.getDay() === 0 || d.getDay() === 6

            return (
              <div key={date} className="day-card">
                <div className="day-col">
                  <div className="day-col-num">{dayNum}</div>
                  <div className={`day-col-dow ${isWe ? 'we' : ''}`}>{dowStr}</div>
                </div>
                <div className="day-shifts">
                  {items.map(({ shift, assignment }) => (
                    <PersonShiftCard
                      key={shift.id}
                      shift={shift}
                      assignment={assignment}
                      staffId={activeStaffId}
                    />
                  ))}
                </div>
              </div>
            )
          })}

          <div className="footer">
            <span><b>(D)</b> 운전</span>
            <span><b>함께</b> 같은 시프트 동료</span>
          </div>
        </>
      )}
    </div>
  )
}
