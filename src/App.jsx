import { useState, useMemo, useEffect, useRef } from 'react'
import html2canvas from 'html2canvas'
import { supabase } from './supabaseClient'
import CalendarView from './components/CalendarView'
import WeeklyCalendarView from './components/WeeklyCalendarView'
import PersonalView from './components/PersonalView'
import DayEditModal from './components/DayEditModal'
import ExcelUpload from './components/ExcelUpload'
import AdminLock from './components/AdminLock'
import { useScheduleData } from './hooks/useScheduleData'
import { useAdmin } from './hooks/useAdminAuth'
import { exportAllToExcel } from './utils/exportExcel'

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

function getMonthWeeks(y, m) {
  const daysInMonth = new Date(y, m, 0).getDate()
  const weeks = []
  for (let s = 1; s <= daysInMonth; s += 7) {
    const e = Math.min(s + 6, daysInMonth)
    weeks.push({ start: s, end: e })
  }
  return weeks
}

function WeekPicker({ year, month, onSelect, onClose }) {
  const [py, setPy] = useState(year)
  const [pm, setPm] = useState(month)
  const weeks = getMonthWeeks(py, pm)

  function prev() { if (pm === 1) { setPy(py - 1); setPm(12) } else setPm(pm - 1) }
  function next() { if (pm === 12) { setPy(py + 1); setPm(1) } else setPm(pm + 1) }

  return (
    <div className="wpicker-overlay" onClick={onClose}>
      <div className="wpicker" onClick={(e) => e.stopPropagation()}>
        <div className="wpicker-nav">
          <button onClick={prev}>◀</button>
          <span>{py}년 {pm}월</span>
          <button onClick={next}>▶</button>
        </div>
        <div className="wpicker-list">
          {weeks.map((w, i) => (
            <button
              key={i}
              className="wpicker-item"
              onClick={() => onSelect(new Date(py, pm - 1, w.start))}
            >
              <span className="wpicker-label">{i + 1}주차</span>
              <span className="wpicker-range">{pm}/{w.start} – {pm}/{w.end}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [tab, setTab] = useState('weekly')
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [weekStart, setWeekStart] = useState(() => getMonday(now))
  const [editDate, setEditDate] = useState(null)
  const [showExcel, setShowExcel] = useState(false)
  const [showWeekPicker, setShowWeekPicker] = useState(false)
  const [bulkMode, setBulkMode] = useState(false)
  const [selectedDates, setSelectedDates] = useState(new Set())
  const [deleting, setDeleting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const { isAdmin } = useAdmin()
  const monthPickerRef = useRef(null)

  useEffect(() => {
    if (isAdmin) setTab('monthly')
  }, [isAdmin])

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

  function handleDateLabelClick() {
    if (!isAdmin) return
    if (activeTab === 'weekly') {
      setShowWeekPicker(true)
    } else {
      monthPickerRef.current?.showPicker()
    }
  }

  function handleMonthPick(e) {
    if (!e.target.value) return
    const [y, m] = e.target.value.split('-').map(Number)
    setYear(y)
    setMonth(m)
  }

  function handleWeekSelect(date) {
    const mon = getMonday(date)
    setWeekStart(mon)
    setYear(mon.getFullYear())
    setMonth(mon.getMonth() + 1)
    setShowWeekPicker(false)
  }

  function toggleDate(dateStr) {
    setSelectedDates(prev => {
      const next = new Set(prev)
      if (next.has(dateStr)) next.delete(dateStr)
      else next.add(dateStr)
      return next
    })
  }

  async function handleBulkDelete() {
    if (selectedDates.size === 0) return
    const dates = [...selectedDates].sort()
    if (!confirm(`${dates.length}일의 시프트를 모두 삭제할까요?`)) return
    setDeleting(true)
    for (const date of dates) {
      const { data: existingShifts } = await supabase.from('shift').select('id').eq('work_date', date)
      if (existingShifts?.length) {
        const ids = existingShifts.map(s => s.id)
        await supabase.from('assignment').delete().in('shift_id', ids)
        await supabase.from('shift').delete().in('id', ids)
      }
    }
    setDeleting(false)
    setSelectedDates(new Set())
    setBulkMode(false)
    refresh()
  }

  function handleDayClick(day) {
    if (!isAdmin) return
    const dateStr = `${year}-${pad2(month)}-${pad2(day)}`
    if (bulkMode) { toggleDate(dateStr); return }
    setEditDate(new Date(year, month - 1, day))
  }

  function handleWeekDayClick(date) {
    if (!isAdmin) return
    const d = new Date(date)
    const dateStr = formatDate(d)
    if (bulkMode) { toggleDate(dateStr); return }
    setEditDate(new Date(date))
  }

  const contentRef = useRef(null)
  const [downloading, setDownloading] = useState(false)

  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)
  const weekLabel = `${weekStart.getMonth() + 1}/${weekStart.getDate()} – ${weekEnd.getMonth() + 1}/${weekEnd.getDate()}`

  const printTitle = activeTab === 'weekly'
    ? `푸드트럭 스케줄 — ${weekLabel}`
    : `푸드트럭 스케줄 — ${year}년 ${month}월`

  async function handleDownloadImage() {
    if (!contentRef.current || downloading) return
    setDownloading(true)
    try {
      const LETTER_W = 1700
      const LETTER_H = 2200
      const PAD = 60
      const TITLE_H = 70

      const captured = await html2canvas(contentRef.current, {
        scale: 2,
        backgroundColor: '#fbf9f4',
        useCORS: true,
      })

      const out = document.createElement('canvas')
      out.width = LETTER_W
      out.height = LETTER_H
      const ctx = out.getContext('2d')

      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, LETTER_W, LETTER_H)

      ctx.fillStyle = '#18191c'
      ctx.font = 'bold 36px "Noto Sans KR", sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(printTitle, LETTER_W / 2, PAD + 36)

      const area = { x: PAD, y: PAD + TITLE_H, w: LETTER_W - PAD * 2, h: LETTER_H - PAD * 2 - TITLE_H }
      const scale = Math.min(area.w / captured.width, area.h / captured.height)
      const dw = captured.width * scale
      const dh = captured.height * scale
      ctx.drawImage(captured, area.x + (area.w - dw) / 2, area.y, dw, dh)

      const link = document.createElement('a')
      const fname = activeTab === 'weekly'
        ? `schedule-${formatDate(weekStart)}.jpg`
        : `schedule-${year}-${pad2(month)}.jpg`
      link.download = fname
      link.href = out.toDataURL('image/jpeg', 0.92)
      link.click()
    } catch (err) {
      alert('이미지 생성 실패: ' + err.message)
    }
    setDownloading(false)
  }

  async function handleExportExcel() {
    if (exporting) return
    setExporting(true)
    try {
      await exportAllToExcel()
    } catch (err) {
      alert('엑셀 백업 실패: ' + err.message)
    }
    setExporting(false)
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

      {isAdmin && <input type="month" ref={monthPickerRef} className="date-picker-hidden" value={`${year}-${pad2(month)}`} onChange={handleMonthPick} />}

      <div className="print-header">{printTitle}</div>

      {isAdmin && activeTab !== 'weekly' ? (
        <div className="month-nav">
          <button onClick={prevMonth}>◀</button>
          <span className="month-label clickable" onClick={handleDateLabelClick}>{year}년 {month}월</span>
          <button onClick={nextMonth}>▶</button>
          {activeTab !== 'personal' && (
            <button className="btn-print" onClick={handleDownloadImage} disabled={downloading}>
              {downloading ? '저장 중...' : '📷 이미지 저장'}
            </button>
          )}
          <button className={`btn-bulk ${bulkMode ? 'active' : ''}`} onClick={() => { setBulkMode(!bulkMode); setSelectedDates(new Set()) }}>
            {bulkMode ? '취소' : '🗑️ 일괄 삭제'}
          </button>
          <button className="btn-excel" onClick={() => setShowExcel(true)}>
            📊 엑셀 업로드
          </button>
          <button className="btn-backup" onClick={handleExportExcel} disabled={exporting}>
            {exporting ? '백업 중...' : '💾 엑셀 백업'}
          </button>
        </div>
      ) : (
        <div className="month-nav">
          <button onClick={prevWeek} disabled={!canPrevWeek}>◀</button>
          {isAdmin ? (
            <span className="month-label clickable" onClick={handleDateLabelClick}>{weekLabel}</span>
          ) : (
            <span className="month-label">{weekLabel}</span>
          )}
          <button onClick={nextWeek} disabled={!canNextWeek}>▶</button>
          {activeTab !== 'personal' && (
            <button className="btn-print" onClick={handleDownloadImage} disabled={downloading}>
              {downloading ? '저장 중...' : '📷 이미지 저장'}
            </button>
          )}
          {isAdmin && (
            <>
              <button className={`btn-bulk ${bulkMode ? 'active' : ''}`} onClick={() => { setBulkMode(!bulkMode); setSelectedDates(new Set()) }}>
                {bulkMode ? '취소' : '🗑️ 일괄 삭제'}
              </button>
              <button className="btn-excel" onClick={() => setShowExcel(true)}>
                📊 엑셀 업로드
              </button>
              <button className="btn-backup" onClick={handleExportExcel} disabled={exporting}>
                {exporting ? '백업 중...' : '💾 엑셀 백업'}
              </button>
            </>
          )}
        </div>
      )}

      {loading && <div className="loading">불러오는 중...</div>}
      {error && <div className="error">오류: {error}</div>}

      <div ref={contentRef}>
        {!loading && !error && activeTab === 'monthly' && isAdmin && (
          <CalendarView shifts={shifts} year={year} month={month} onDayClick={handleDayClick} bulkMode={bulkMode} selectedDates={selectedDates} />
        )}
        {!loading && !error && activeTab === 'weekly' && (
          <WeeklyCalendarView
            shifts={shifts}
            weekStart={weekStart}
            onDayClick={isAdmin ? handleWeekDayClick : undefined}
            bulkMode={bulkMode}
            selectedDates={selectedDates}
          />
        )}
      </div>
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

      {bulkMode && selectedDates.size > 0 && (
        <div className="bulk-bar">
          <span>{selectedDates.size}일 선택됨</span>
          <button className="btn-bulk-delete" onClick={handleBulkDelete} disabled={deleting}>
            {deleting ? '삭제 중...' : `선택한 ${selectedDates.size}일 시프트 모두 삭제`}
          </button>
        </div>
      )}

      {showExcel && (
        <ExcelUpload
          staff={staff}
          onDone={() => { setShowExcel(false); refresh() }}
        />
      )}

      {showWeekPicker && (
        <WeekPicker
          year={year}
          month={month}
          onSelect={handleWeekSelect}
          onClose={() => setShowWeekPicker(false)}
        />
      )}

    </div>
  )
}
