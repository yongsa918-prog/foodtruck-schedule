import { useState, useRef } from 'react'
import { supabase } from '../supabaseClient'
import { truckClass } from '../utils/colors'
import { calcHoursFromTimeText } from '../utils/timeCalc'

export default function ShiftEditor({ shift, staff, onDelete, onDuplicate, onSaved, showDragHandle, onDragHandleDown, onDragHandleUp }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    truck: shift.truck,
    shift_label: shift.shift_label || '',
    event: shift.event || '',
    time_text: shift.time_text || '',
    hours: shift.hours || '',
    note: shift.note || '',
  })
  const [saving, setSaving] = useState(false)

  const [aDragIdx, setADragIdx] = useState(null)
  const [aOverIdx, setAOverIdx] = useState(null)
  const aDragAllowed = useRef(false)

  const cls = truckClass(shift.truck)
  const label = shift.shift_label ? `${shift.truck} ${shift.shift_label}` : shift.truck
  const assignments = [...(shift.assignment || [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

  async function handleSaveShift(e) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('shift').update({
      truck: form.truck,
      shift_label: form.shift_label || null,
      event: form.event || null,
      time_text: form.time_text || null,
      hours: form.hours ? parseFloat(form.hours) : null,
      note: form.note || null,
    }).eq('id', shift.id)
    setSaving(false)
    if (!error) {
      setEditing(false)
      onSaved()
    } else {
      alert('저장 실패: ' + error.message)
    }
  }

  async function handleAddAssignment(staffId) {
    const person = staff.find((s) => String(s.id) === String(staffId))
    if (!person) return
    const maxOrder = assignments.reduce((max, a) => Math.max(max, a.sort_order ?? 0), -1)
    const { error } = await supabase.from('assignment').insert({
      shift_id: shift.id,
      staff_id: person.id,
      member_text: person.name,
      is_driver: false,
      is_tentative: false,
      sort_order: maxOrder + 1,
    })
    if (error) alert('배정 실패: ' + error.message)
    else onSaved()
  }

  async function handleRemoveAssignment(assignmentId) {
    await supabase.from('assignment').delete().eq('id', assignmentId)
    onSaved()
  }

  async function handleToggleDriver(assignment) {
    await supabase.from('assignment').update({ is_driver: !assignment.is_driver }).eq('id', assignment.id)
    onSaved()
  }

  async function handleToggleTentative(assignment) {
    await supabase.from('assignment').update({ is_tentative: !assignment.is_tentative }).eq('id', assignment.id)
    onSaved()
  }

  function handleADragStart(e, idx) {
    if (!aDragAllowed.current) { e.preventDefault(); return }
    e.stopPropagation()
    setADragIdx(idx)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', '')
  }

  function handleADragOver(e, idx) {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    if (aOverIdx !== idx) setAOverIdx(idx)
  }

  async function handleADrop(e, idx) {
    e.preventDefault()
    e.stopPropagation()
    if (aDragIdx === null || aDragIdx === idx) {
      setADragIdx(null)
      setAOverIdx(null)
      return
    }

    const reordered = [...assignments]
    const [moved] = reordered.splice(aDragIdx, 1)
    reordered.splice(idx, 0, moved)

    setADragIdx(null)
    setAOverIdx(null)

    await Promise.all(
      reordered.map((a, i) =>
        supabase.from('assignment').update({ sort_order: i }).eq('id', a.id)
      )
    )
    onSaved()
  }

  function handleADragEnd() {
    aDragAllowed.current = false
    setADragIdx(null)
    setAOverIdx(null)
  }

  const assignedIds = assignments.map((a) => a.staff_id)
  const availableStaff = staff.filter((s) => !assignedIds.includes(s.id))

  return (
    <div className={`editor-card ${cls}`}>
      <div className="editor-header">
        {showDragHandle && (
          <span
            className="drag-handle"
            onMouseDown={onDragHandleDown}
            onMouseUp={onDragHandleUp}
            title="드래그하여 순서 변경"
          >⠿</span>
        )}
        <span className={`badge ${cls}`}>{label}</span>
        {shift.time_text && <span className="editor-time">{shift.time_text}</span>}
        {shift.hours && <span className="editor-hours">{shift.hours}h</span>}
        <div className="editor-actions">
          <button className="btn-icon" onClick={() => setEditing(!editing)} title="수정">✏️</button>
          {onDuplicate && <button className="btn-icon" onClick={onDuplicate} title="복사">📋</button>}
          <button className="btn-icon" onClick={onDelete} title="삭제">🗑️</button>
        </div>
      </div>

      {shift.event && <div className="editor-event">{shift.event}</div>}

      {editing && (
        <form className="shift-form inline" onSubmit={handleSaveShift}>
          <div className="form-row">
            <label>트럭</label>
            <select value={form.truck} onChange={(e) => setForm({ ...form, truck: e.target.value })}>
              <option value="1호">1호</option>
              <option value="2호">2호</option>
              <option value="프랩">프랩</option>
              <option value="케이터링">케이터링</option>
            </select>
          </div>
          <div className="form-row">
            <label>구분</label>
            <input value={form.shift_label} onChange={(e) => setForm({ ...form, shift_label: e.target.value })} placeholder="오픈, 클로즈..." />
          </div>
          <div className="form-row">
            <label>이벤트</label>
            <input value={form.event} onChange={(e) => setForm({ ...form, event: e.target.value })} />
          </div>
          <div className="form-row">
            <label>시간</label>
            <input value={form.time_text} onChange={(e) => {
              const t = e.target.value
              const calc = calcHoursFromTimeText(t)
              setForm({ ...form, time_text: t, ...(calc !== null ? { hours: calc } : {}) })
            }} placeholder="10am–4pm" />
          </div>
          <div className="form-row">
            <label>시간수</label>
            <input type="number" step="0.25" value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} />
          </div>
          <div className="form-row">
            <label>비고</label>
            <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </div>
          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? '저장 중...' : '저장'}</button>
            <button type="button" className="btn-secondary" onClick={() => setEditing(false)}>취소</button>
          </div>
        </form>
      )}

      <div className="assignment-section">
        <div className="assignment-label">배정 인원</div>
        {assignments.length === 0 && <div className="assignment-empty">배정된 인원 없음</div>}
        {assignments.map((a, idx) => (
          <div
            key={a.id}
            className={`assignment-row${aDragIdx === idx ? ' dragging' : ''}${aOverIdx === idx && aDragIdx !== null && aDragIdx !== idx ? (aDragIdx > idx ? ' drag-over-above' : ' drag-over-below') : ''}`}
            draggable={assignments.length > 1}
            onDragStart={(e) => handleADragStart(e, idx)}
            onDragOver={(e) => handleADragOver(e, idx)}
            onDrop={(e) => handleADrop(e, idx)}
            onDragEnd={handleADragEnd}
          >
            {assignments.length > 1 && (
              <span
                className="assign-drag-handle"
                onMouseDown={() => { aDragAllowed.current = true }}
                onMouseUp={() => { aDragAllowed.current = false }}
              >⠿</span>
            )}
            <span className="assignment-name">{a.member_text}</span>
            <button
              className={`tag-btn ${a.is_driver ? 'on' : ''}`}
              onClick={() => handleToggleDriver(a)}
              title="운전 토글"
            >D</button>
            <button
              className={`tag-btn tentative ${a.is_tentative ? 'on' : ''}`}
              onClick={() => handleToggleTentative(a)}
              title="미정 토글"
            >?</button>
            <button className="btn-remove" onClick={() => handleRemoveAssignment(a.id)} title="해제">✕</button>
          </div>
        ))}
        {availableStaff.length > 0 && (
          <div className="assignment-add">
            <select defaultValue="" onChange={(e) => { if (e.target.value) { handleAddAssignment(e.target.value); e.target.value = '' } }}>
              <option value="" disabled>+ 인원 추가...</option>
              {availableStaff.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  )
}
