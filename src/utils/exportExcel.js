import * as XLSX from 'xlsx'
import { supabase } from '../supabaseClient'

const DOW = ['일', '월', '화', '수', '목', '금', '토']
const MAX_MEMBERS = 5

function getWeekOfMonth(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  const first = new Date(d.getFullYear(), d.getMonth(), 1)
  const firstMonday = new Date(first)
  const day = first.getDay()
  firstMonday.setDate(first.getDate() + ((day === 0 ? 1 : day <= 1 ? 1 : 8) - day))
  if (d < firstMonday) return 0
  return Math.floor((d - firstMonday) / (7 * 86400000)) + 1
}

function getMonthKey(dateStr) {
  return dateStr.substring(0, 7)
}

export async function exportAllToExcel() {
  const [shiftsRes, staffRes] = await Promise.all([
    supabase
      .from('shift')
      .select('*, assignment(id, staff_id, member_text, is_driver, is_tentative, sort_order)')
      .order('work_date')
      .order('sort_order')
      .order('id'),
    supabase
      .from('staff')
      .select('*')
      .order('sort_order')
      .order('name'),
  ])

  if (shiftsRes.error) throw new Error(shiftsRes.error.message)
  if (staffRes.error) throw new Error(staffRes.error.message)

  const shifts = shiftsRes.data
  const staffList = staffRes.data
  const staffMap = Object.fromEntries(staffList.map(s => [s.id, s.name]))

  if (shifts.length === 0) {
    throw new Error('내보낼 스케줄 데이터가 없습니다')
  }

  const byMonth = new Map()
  for (const s of shifts) {
    const mk = getMonthKey(s.work_date)
    if (!byMonth.has(mk)) byMonth.set(mk, [])
    byMonth.get(mk).push(s)
  }

  const wb = XLSX.utils.book_new()

  for (const [monthKey, monthShifts] of byMonth) {
    const [y, m] = monthKey.split('-').map(Number)
    const rows = []
    const merges = []

    // Row 0: Title
    const titleRow = [`🚚 ${y}년 ${m}월 푸드트럭 스케줄`]
    for (let i = 1; i <= 12; i++) titleRow.push('')
    rows.push(titleRow)
    merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 12 } })

    // Row 1: Header
    rows.push(['주차', '날짜', '요일', '시프트', '이벤트', '시간', '근무h',
      '멤버1', '멤버2', '멤버3', '멤버4', '멤버5', '비고'])

    const byWeek = new Map()
    for (const s of monthShifts) {
      const wk = getWeekOfMonth(s.work_date)
      if (!byWeek.has(wk)) byWeek.set(wk, [])
      byWeek.get(wk).push(s)
    }

    const sortedWeeks = [...byWeek.keys()].sort((a, b) => a - b)

    for (const wk of sortedWeeks) {
      const weekShifts = byWeek.get(wk)
      const weekLabel = wk === 0 ? '사전' : `Week ${wk}`

      // Week separator row
      const sepRow = [`━━━ ${weekLabel} ━━━`]
      for (let i = 1; i <= 12; i++) sepRow.push('')
      const sepIdx = rows.length
      rows.push(sepRow)
      merges.push({ s: { r: sepIdx, c: 0 }, e: { r: sepIdx, c: 12 } })

      for (const s of weekShifts) {
        const d = new Date(s.work_date + 'T00:00:00')
        const dow = DOW[d.getDay()]
        const dateLabel = `${d.getMonth() + 1}/${d.getDate()}`

        let shiftLabel = s.truck || ''
        if (s.shift_label) shiftLabel += ' ' + s.shift_label

        const assignments = (s.assignment || [])
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

        const memberCols = []
        for (let i = 0; i < MAX_MEMBERS; i++) {
          if (i < assignments.length) {
            const a = assignments[i]
            let name = a.staff_id ? (staffMap[a.staff_id] || a.member_text) : a.member_text
            if (a.is_driver) name += ' (D)'
            if (a.is_tentative) name += ' (?)'
            memberCols.push(name || '')
          } else {
            memberCols.push('')
          }
        }

        rows.push([
          weekLabel,
          dateLabel,
          dow,
          shiftLabel,
          s.event || '',
          s.time_text || '',
          s.hours ?? '',
          ...memberCols,
          s.note || '',
        ])
      }
    }

    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!merges'] = merges
    ws['!cols'] = [
      { wch: 10 },  // 주차
      { wch: 8 },   // 날짜
      { wch: 4 },   // 요일
      { wch: 14 },  // 시프트
      { wch: 30 },  // 이벤트
      { wch: 16 },  // 시간
      { wch: 7 },   // 근무h
      { wch: 16 },  // 멤버1
      { wch: 16 },  // 멤버2
      { wch: 16 },  // 멤버3
      { wch: 16 },  // 멤버4
      { wch: 16 },  // 멤버5
      { wch: 28 },  // 비고
    ]

    const sheetName = `${m}월 스케줄`
    XLSX.utils.book_append_sheet(wb, ws, sheetName)
  }

  // Staff sheet
  const staffRows = [['이름', '활성', '순서']]
  for (const s of staffList) {
    staffRows.push([s.name, s.active ? 'O' : 'X', s.sort_order ?? ''])
  }
  const wsStaff = XLSX.utils.aoa_to_sheet(staffRows)
  wsStaff['!cols'] = [{ wch: 15 }, { wch: 6 }, { wch: 6 }]
  XLSX.utils.book_append_sheet(wb, wsStaff, '직원')

  const today = new Date()
  const ty = today.getFullYear()
  const tm = String(today.getMonth() + 1).padStart(2, '0')
  const td = String(today.getDate()).padStart(2, '0')
  XLSX.writeFile(wb, `푸드트럭_백업_${ty}-${tm}-${td}.xlsx`)
}
