import { useState, useRef } from 'react'
import { supabase } from '../supabaseClient'
import ShiftEditor from './ShiftEditor'
import { truckClass } from '../utils/colors'
import { calcHoursFromTimeText } from '../utils/timeCalc'

export default function DayEditModal({ date, shifts, staff, onClose, onSaved }) {
  const [adding, setAdding] = useState(false)
  const [newShift, setNewShift] = useState({
    truck: '1호',
    shift_label: '',
    event: '',
    time_text: '',
    hours: '',
    note: '',
  })
  const [saving, setSaving] = useState(false)
  const [dragIdx, setDragIdx] = useState(null)
  const [overIdx, setOverIdx] = useState(null)
  const dragAllowed = useRef(false)

  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  const dayShifts = shifts.filter((s) => s.work_date === dateStr)

  async function handleAddShift(e) {
    e.preventDefault()
    setSaving(true)
    const maxOrder = dayShifts.reduce((max, s) => Math.max(max, s.sort_order ?? 0), -1)
    const { error } = await supabase.from('shift').insert({
      work_date: dateStr,
      truck: newShift.truck,
      shift_label: newShift.shift_label || null,
      event: newShift.event || null,
      time_text: newShift.time_text || null,
      hours: newShift.hours ? parseFloat(newShift.hours) : null,
      note: newShift.note || null,
      sort_order: maxOrder + 1,
    })
    setSaving(false)
    if (!error) {
      setAdding(false)
      setNewShift({ truck: '1호', shift_label: '', event: '', time_text: '', hours: '', note: '' })
      onSaved()
    } else {
      alert('저장 실패: ' + error.message)
    }
  }

  async function handleDeleteShift(shiftId) {
    if (!confirm('이 시프트를 삭제할까요? 배정도 모두 삭제됩니다.')) return
    await supabase.from('assignment').delete().eq('shift_id', shiftId)
    await supabase.from('shift').delete().eq('id', shiftId)
    onSaved()
  }

  function handleDragStart(e, idx) {
    if (!dragAllowed.current) {
      e.preventDefault()
      return
    }
    setDragIdx(idx)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', '')
  }

  function handleDragOver(e, idx) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (overIdx !== idx) setOverIdx(idx)
  }

  async function handleDrop(e, idx) {
    e.preventDefault()
    if (dragIdx === null || dragIdx === idx) {
      setDragIdx(null)
      setOverIdx(null)
      return
    }

    const reordered = [...dayShifts]
    const [moved] = reordered.splice(dragIdx, 1)
    reordered.splice(idx, 0, moved)

    setDragIdx(null)
    setOverIdx(null)

    await Promise.all(
      reordered.map((s, i) =>
        supabase.from('shift').update({ sort_order: i }).eq('id', s.id)
      )
    )
    onSaved()
  }

  function handleDragEnd() {
    dragAllowed.current = false
    setDragIdx(null)
    setOverIdx(null)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{date.getMonth() + 1}월 {date.getDate()}일</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {dayShifts.length === 0 && !adding && (
            <div className="empty-msg">이 날은 시프트가 없습니다.</div>
          )}

          {dayShifts.map((shift, idx) => (
            <div
              key={shift.id}
              draggable={dayShifts.length > 1}
              onDragStart={(e) => handleDragStart(e, idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDrop={(e) => handleDrop(e, idx)}
              onDragEnd={handleDragEnd}
              className={`drag-wrapper${dragIdx === idx ? ' dragging' : ''}${overIdx === idx && dragIdx !== null && dragIdx !== idx ? (dragIdx > idx ? ' drag-over-above' : ' drag-over-below') : ''}`}
            >
              <ShiftEditor
                shift={shift}
                staff={staff}
                onDelete={() => handleDeleteShift(shift.id)}
                onSaved={onSaved}
                showDragHandle={dayShifts.length > 1}
                onDragHandleDown={() => { dragAllowed.current = true }}
                onDragHandleUp={() => { dragAllowed.current = false }}
              />
            </div>
          ))}

          {adding ? (
            <form className="shift-form" onSubmit={handleAddShift}>
              <h3>새 시프트 추가</h3>
              <div className="form-row">
                <label>트럭</label>
                <select value={newShift.truck} onChange={(e) => setNewShift({ ...newShift, truck: e.target.value })}>
                  <option value="1호">1호</option>
                  <option value="2호">2호</option>
                  <option value="프랩">프랩</option>
                  <option value="케이터링">케이터링</option>
                </select>
              </div>
              <div className="form-row">
                <label>구분</label>
                <input
                  placeholder="오픈, 클로즈, 풀데이..."
                  value={newShift.shift_label}
                  onChange={(e) => setNewShift({ ...newShift, shift_label: e.target.value })}
                />
              </div>
              <div className="form-row">
                <label>이벤트</label>
                <input
                  placeholder="FIFA PNE, Catering..."
                  value={newShift.event}
                  onChange={(e) => setNewShift({ ...newShift, event: e.target.value })}
                />
              </div>
              <div className="form-row">
                <label>시간</label>
                <input
                  placeholder="10am–4pm"
                  value={newShift.time_text}
                  onChange={(e) => {
                    const t = e.target.value
                    const calc = calcHoursFromTimeText(t)
                    setNewShift({ ...newShift, time_text: t, ...(calc !== null ? { hours: calc } : {}) })
                  }}
                />
              </div>
              <div className="form-row">
                <label>시간수</label>
                <input
                  type="number"
                  step="0.25"
                  placeholder="자동 계산"
                  value={newShift.hours}
                  onChange={(e) => setNewShift({ ...newShift, hours: e.target.value })}
                />
              </div>
              <div className="form-row">
                <label>비고</label>
                <input
                  placeholder="메모..."
                  value={newShift.note}
                  onChange={(e) => setNewShift({ ...newShift, note: e.target.value })}
                />
              </div>
              <div className="form-actions">
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? '저장 중...' : '추가'}
                </button>
                <button type="button" className="btn-secondary" onClick={() => setAdding(false)}>취소</button>
              </div>
            </form>
          ) : (
            <button className="btn-add-shift" onClick={() => setAdding(true)}>+ 시프트 추가</button>
          )}
        </div>
      </div>
    </div>
  )
}
