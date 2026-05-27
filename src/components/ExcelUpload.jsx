import { useRef, useState } from 'react'
import { supabase } from '../supabaseClient'
import { parseExcelFile } from '../utils/parseExcel'
import { truckClass } from '../utils/colors'

export default function ExcelUpload({ staff, onDone }) {
  const fileRef = useRef()
  const [parsed, setParsed] = useState(null)
  const [error, setError] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState('')
  const [overlap, setOverlap] = useState(null)
  const [step, setStep] = useState('file')

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setParsed(null)
    setOverlap(null)
    setStep('file')
    try {
      const result = await parseExcelFile(file)
      if (result.shifts.length === 0) {
        setError('파싱된 시프트가 없습니다. 엑셀 형식을 확인해주세요.')
        return
      }
      setParsed(result)

      const dates = [...new Set(result.shifts.map((s) => s.work_date))]
      const { data: existing } = await supabase
        .from('shift')
        .select('id, work_date')
        .in('work_date', dates)

      if (existing?.length > 0) {
        const overlapDates = [...new Set(existing.map((s) => s.work_date))].sort()
        setOverlap({ dates: overlapDates, shiftCount: existing.length })
        setStep('overlap')
      } else {
        setStep('preview')
      }
    } catch (err) {
      setError('파일 파싱 실패: ' + err.message)
    }
  }

  function findStaff(memberText) {
    if (!memberText) return null
    const clean = memberText.replace(/\s/g, '')
    return staff.find((s) => {
      const sClean = s.name.replace(/\s/g, '')
      return sClean === clean || clean.includes(sClean) || sClean.includes(clean)
    })
  }

  async function handleUpload(mode) {
    if (!parsed) return
    setStep('uploading')
    setUploading(true)
    setError(null)

    try {
      if (mode === 'replace') {
        const dates = [...new Set(parsed.shifts.map((s) => s.work_date))]
        setProgress(`기존 데이터 삭제 중... (${dates.length}일)`)

        for (const date of dates) {
          const { data: existingShifts } = await supabase
            .from('shift')
            .select('id')
            .eq('work_date', date)

          if (existingShifts?.length) {
            const ids = existingShifts.map((s) => s.id)
            await supabase.from('assignment').delete().in('shift_id', ids)
            await supabase.from('shift').delete().in('id', ids)
          }
        }
      }

      const total = parsed.shifts.length
      const dateCounters = {}
      for (let i = 0; i < total; i++) {
        const s = parsed.shifts[i]
        if (!dateCounters[s.work_date]) dateCounters[s.work_date] = 0
        const sortOrder = dateCounters[s.work_date]++
        setProgress(`시프트 업로드 중... (${i + 1}/${total})`)

        const { data: shiftData, error: shiftErr } = await supabase
          .from('shift')
          .insert({
            work_date: s.work_date,
            truck: s.truck,
            shift_label: s.shift_label,
            event: s.event,
            time_text: s.time_text,
            hours: s.hours,
            note: s.note,
            sort_order: sortOrder,
          })
          .select('id')
          .single()

        if (shiftErr) throw new Error(`시프트 저장 실패 (${s.work_date}): ${shiftErr.message}`)

        if (s.members.length > 0) {
          const assignments = s.members.map((m) => {
            const matched = findStaff(m.member_text)
            return {
              shift_id: shiftData.id,
              staff_id: matched?.id || null,
              member_text: m.member_text,
              is_driver: m.is_driver,
              is_tentative: m.is_tentative,
            }
          })
          const { error: assignErr } = await supabase.from('assignment').insert(assignments)
          if (assignErr) throw new Error(`배정 저장 실패: ${assignErr.message}`)
        }
      }

      setProgress('')
      onDone()
    } catch (err) {
      setError('업로드 실패: ' + err.message)
    } finally {
      setUploading(false)
    }
  }

  function handleCancel() {
    setParsed(null)
    setError(null)
    setProgress('')
    setOverlap(null)
    setStep('file')
    if (fileRef.current) fileRef.current.value = ''
    onDone()
  }

  function handleOverlapChoice(choice) {
    if (choice === 'replace') {
      handleUpload('replace')
    } else if (choice === 'append') {
      handleUpload('append')
    } else {
      setStep('preview')
    }
  }

  const shiftsByDate = parsed
    ? Object.entries(
        parsed.shifts.reduce((acc, s) => {
          if (!acc[s.work_date]) acc[s.work_date] = []
          acc[s.work_date].push(s)
          return acc
        }, {})
      ).sort(([a], [b]) => a.localeCompare(b))
    : []

  const unmatchedMembers = parsed
    ? [...new Set(
        parsed.shifts
          .flatMap((s) => s.members)
          .filter((m) => !findStaff(m.member_text))
          .map((m) => m.member_text)
      )]
    : []

  return (
    <div className="modal-overlay" onClick={handleCancel}>
      <div className="modal-content excel-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>엑셀 업로드</h2>
          <button className="modal-close" onClick={handleCancel}>✕</button>
        </div>

        <div className="modal-body">
          {step === 'file' && (
            <div className="excel-drop">
              <div className="excel-drop-icon">📊</div>
              <div className="excel-drop-text">엑셀 파일을 선택하세요</div>
              <div className="excel-drop-sub">
                컬럼: 주차, 날짜, 요일, 시프트, 이벤트, 시간, 근무h, 멤버1~5, 비고
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFile}
                className="excel-file-input"
              />
            </div>
          )}

          {error && <div className="error">{error}</div>}

          {step === 'overlap' && overlap && (
            <div className="excel-overlap">
              <div className="excel-overlap-icon">⚠️</div>
              <div className="excel-overlap-title">기존 데이터가 있습니다</div>
              <div className="excel-overlap-desc">
                아래 <b>{overlap.dates.length}일</b>에 이미
                <b> {overlap.shiftCount}개</b> 시프트가 등록되어 있습니다.
              </div>
              <div className="excel-overlap-dates">
                {overlap.dates.map((date) => {
                  const d = new Date(date + 'T00:00:00')
                  const dow = ['일','월','화','수','목','금','토'][d.getDay()]
                  return (
                    <span key={date} className="excel-overlap-date">
                      {d.getMonth() + 1}/{d.getDate()} ({dow})
                    </span>
                  )
                })}
              </div>
              <div className="excel-overlap-actions">
                <button
                  className="btn-overlap replace"
                  onClick={() => handleOverlapChoice('replace')}
                >
                  <span className="btn-overlap-icon">🔄</span>
                  <span className="btn-overlap-label">덮어쓰기</span>
                  <span className="btn-overlap-desc">기존 데이터 삭제 후 새로 추가</span>
                </button>
                <button
                  className="btn-overlap append"
                  onClick={() => handleOverlapChoice('append')}
                >
                  <span className="btn-overlap-icon">➕</span>
                  <span className="btn-overlap-label">함께 추가</span>
                  <span className="btn-overlap-desc">기존 데이터 유지, 새 데이터 추가</span>
                </button>
                <button
                  className="btn-overlap preview"
                  onClick={() => handleOverlapChoice('preview')}
                >
                  <span className="btn-overlap-icon">👀</span>
                  <span className="btn-overlap-label">미리보기</span>
                  <span className="btn-overlap-desc">업로드 전 데이터를 먼저 확인</span>
                </button>
              </div>
              <button className="btn-secondary excel-overlap-cancel" onClick={handleCancel}>취소</button>
            </div>
          )}

          {step === 'preview' && parsed && (
            <>
              <div className="excel-summary">
                <div className="excel-summary-title">
                  미리보기 — {parsed.sheetName}
                </div>
                <div className="excel-stats">
                  <span className="excel-stat">{parsed.shifts.length}개 시프트</span>
                  <span className="excel-stat">{shiftsByDate.length}일</span>
                  <span className="excel-stat">
                    {parsed.shifts.reduce((n, s) => n + s.members.length, 0)}건 배정
                  </span>
                </div>
              </div>

              {unmatchedMembers.length > 0 && (
                <div className="excel-warn">
                  <b>매칭 안 됨:</b> {unmatchedMembers.join(', ')}
                  <div className="excel-warn-sub">
                    등록된 직원과 이름이 다릅니다. 텍스트 그대로 저장됩니다.
                  </div>
                </div>
              )}

              <div className="excel-preview">
                {shiftsByDate.map(([date, shifts]) => {
                  const d = new Date(date + 'T00:00:00')
                  const dow = ['일','월','화','수','목','금','토'][d.getDay()]
                  return (
                    <div key={date} className="excel-day">
                      <div className="excel-day-header">
                        {d.getMonth() + 1}/{d.getDate()} ({dow})
                      </div>
                      {shifts.map((s, i) => {
                        const cls = truckClass(s.truck)
                        const label = s.shift_label ? `${s.truck} ${s.shift_label}` : s.truck
                        return (
                          <div key={i} className={`excel-shift ${cls}`}>
                            <span className={`badge ${cls}`}>{label}</span>
                            {s.time_text && <span className="excel-time">{s.time_text}</span>}
                            {s.hours && <span className="excel-hours">{s.hours}h</span>}
                            {s.event && <div className="excel-event">{s.event}</div>}
                            {s.members.length > 0 && (
                              <div className="excel-members">
                                {s.members.map((m, j) => (
                                  <span key={j} className={`excel-member ${findStaff(m.member_text) ? '' : 'unmatched'}`}>
                                    {m.member_text}
                                    {m.is_driver && ' (D)'}
                                    {m.is_tentative && ' ?'}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>

              <div className="excel-actions">
                {overlap && (
                  <div className="excel-mode">
                    <label className="mode-btn active">
                      어떻게 업로드할까요?
                    </label>
                  </div>
                )}
                <div className="excel-btns">
                  {overlap ? (
                    <>
                      <button className="btn-primary" onClick={() => handleUpload('replace')}>
                        덮어쓰기 ({parsed.shifts.length}개)
                      </button>
                      <button className="btn-primary" style={{ background: '#2563eb' }} onClick={() => handleUpload('append')}>
                        함께 추가 ({parsed.shifts.length}개)
                      </button>
                    </>
                  ) : (
                    <button className="btn-primary" onClick={() => handleUpload('append')}>
                      업로드 ({parsed.shifts.length}개 시프트)
                    </button>
                  )}
                  <button className="btn-secondary" onClick={handleCancel}>취소</button>
                </div>
              </div>
            </>
          )}

          {step === 'uploading' && (
            <div className="excel-uploading">
              <div className="excel-spinner" />
              <div className="excel-progress">{progress}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
