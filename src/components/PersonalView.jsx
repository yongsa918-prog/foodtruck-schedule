import { useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAdmin } from '../hooks/useAdminAuth'
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

function StaffManager({ staff, onSaved }) {
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleAdd(e) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    setSaving(true)
    const { error } = await supabase.from('staff').insert({ name, active: true })
    setSaving(false)
    if (error) alert('추가 실패: ' + error.message)
    else { setNewName(''); onSaved() }
  }

  async function handleRename(id) {
    const name = editName.trim()
    if (!name) return
    setSaving(true)
    const [staffRes, assignmentRes] = await Promise.all([
      supabase.from('staff').update({ name }).eq('id', id),
      supabase.from('assignment').update({ member_text: name }).eq('staff_id', id),
    ])
    setSaving(false)
    const error = staffRes.error || assignmentRes.error
    if (error) alert('수정 실패: ' + error.message)
    else { setEditingId(null); onSaved() }
  }

  async function handleDelete(s) {
    if (!confirm(`"${s.name}" 직원을 삭제할까요? 배정 기록도 모두 삭제됩니다.`)) return
    await supabase.from('assignment').delete().eq('staff_id', s.id)
    await supabase.from('staff').delete().eq('id', s.id)
    onSaved()
  }

  function startEdit(s) {
    setEditingId(s.id)
    setEditName(s.name)
  }

  return (
    <div className="staff-manager">
      <div className="staff-manager-title">직원 관리</div>
      <div className="staff-list">
        {staff.map((s) => (
          <div key={s.id} className="staff-row">
            {editingId === s.id ? (
              <form className="staff-edit-form" onSubmit={(e) => { e.preventDefault(); handleRename(s.id) }}>
                <input
                  className="staff-edit-input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={() => { if (editName.trim() && editName.trim() !== s.name) handleRename(s.id); else setEditingId(null) }}
                  autoFocus
                />
                <button type="submit" className="btn-sm primary" disabled={saving}>저장</button>
                <button type="button" className="btn-sm" onMouseDown={(e) => e.preventDefault()} onClick={() => setEditingId(null)}>취소</button>
              </form>
            ) : (
              <>
                <span className="staff-row-name">{s.name}</span>
                <button className="btn-sm" onClick={() => startEdit(s)}>이름 수정</button>
                <button className="btn-sm danger" onClick={() => handleDelete(s)}>삭제</button>
              </>
            )}
          </div>
        ))}
      </div>
      <form className="staff-add-form" onSubmit={handleAdd}>
        <input
          className="staff-add-input"
          placeholder="새 직원 이름"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button type="submit" className="btn-primary" disabled={saving || !newName.trim()}>추가</button>
      </form>
    </div>
  )
}

export default function PersonalView({ shifts, staff, onSaved }) {
  const { isAdmin } = useAdmin()
  const [selectedId, setSelectedId] = useState(null)
  const [managing, setManaging] = useState(false)

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
      <div className="picker-row">
        <div className="picker-label">이름 선택</div>
        {isAdmin && (
          <button
            className={`btn-manage ${managing ? 'active' : ''}`}
            onClick={() => setManaging(!managing)}
          >
            {managing ? '완료' : '직원 관리'}
          </button>
        )}
      </div>

      {isAdmin && managing && <StaffManager staff={staff} onSaved={onSaved} />}

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
