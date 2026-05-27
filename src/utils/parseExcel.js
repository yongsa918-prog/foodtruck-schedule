import * as XLSX from 'xlsx'
import { calcHoursFromTimeText } from './timeCalc'

const TRUCK_LABELS = ['오픈', '클로즈', '풀데이']

function parseTruck(raw) {
  if (!raw) return { truck: null, shift_label: null }
  const s = raw.trim()
  for (const label of TRUCK_LABELS) {
    if (s.includes(label)) {
      const truck = s.replace(label, '').trim()
      return { truck: truck || s, shift_label: label }
    }
  }
  return { truck: s, shift_label: null }
}

function normalizeTruck(truck) {
  if (!truck) return null
  const t = truck.toLowerCase()
  if (t.includes('1호')) return '1호'
  if (t.includes('2호')) return '2호'
  if (t.includes('프랩') || t.includes('prep')) return '프랩'
  if (t.includes('케이터링') || t.includes('cater')) return '케이터링'
  return truck
}

function parseMember(raw) {
  if (!raw) return null
  let text = raw.trim().replace(/\n/g, ' ')
  if (!text || text === '—' || text === '-') return null

  const isDriver = /\(D\)/i.test(text)
  const isTentative = text.includes('??') || text.includes('？？')
  const name = text
    .replace(/\(D\)/gi, '')
    .replace(/\?\?/g, '')
    .replace(/？？/g, '')
    .trim()

  if (!name) return null
  return { member_text: name, is_driver: isDriver, is_tentative: isTentative }
}

function serialToDate(serial) {
  const parsed = XLSX.SSF.parse_date_code(serial)
  if (!parsed) return null
  return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`
}

function parseDate(dateStr, hintYear) {
  if (!dateStr) return null
  const s = String(dateStr).trim()

  const match = s.match(/^(\d{1,2})\/(\d{1,2})$/)
  if (match) {
    const m = parseInt(match[1])
    const d = parseInt(match[2])
    return `${hintYear}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }

  if (typeof dateStr === 'number') {
    return serialToDate(dateStr)
  }

  return null
}

function detectYear(rows) {
  for (const row of rows) {
    for (const cell of row) {
      if (!cell) continue
      const s = String(cell)
      const match = s.match(/(\d{4})\s*년/) || s.match(/(\d{4})/)
      if (match && parseInt(match[1]) >= 2020 && parseInt(match[1]) <= 2040) return parseInt(match[1])
    }
  }
  return new Date().getFullYear()
}

function detectMonth(rows) {
  for (const row of rows) {
    for (const cell of row) {
      if (!cell) continue
      const s = String(cell)
      const match = s.match(/(\d{1,2})\s*월/)
      if (match) return parseInt(match[1])
    }
  }
  return null
}

function detectFormat(rows) {
  if (rows.length >= 3 && rows[1] && rows[1].some(c => String(c) === 'AAAA')) {
    return 'calendar'
  }
  return 'list'
}

function extractTimeFromText(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const eventParts = []
  let time = null

  for (const line of lines) {
    if (/^\d{1,2}(?::\d{2})?\s*(?:am|pm)?\s*[-–~]\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?$/i.test(line)) {
      time = line
    } else if (line) {
      eventParts.push(line)
    }
  }

  return { event: eventParts.join(' / ') || null, time }
}

function parseCalendarFormat(rows) {
  const year = detectYear(rows)
  const month = detectMonth(rows)
  const shifts = []

  for (let i = 2; i < rows.length - 1; i += 2) {
    const dateRow = rows[i]
    const eventRow = rows[i + 1]
    if (!dateRow || !eventRow) continue

    for (let col = 0; col < 7; col++) {
      const dateVal = dateRow[col]
      const eventVal = eventRow[col]

      if (typeof dateVal !== 'number' || dateVal < 100) continue

      const work_date = serialToDate(dateVal)
      if (!work_date) continue

      const rawText = String(eventVal || '').trim()
      if (!rawText) continue

      const { event, time } = extractTimeFromText(rawText)
      if (!event) continue

      const hours = time ? calcHoursFromTimeText(time) : null

      shifts.push({
        work_date,
        truck: '1호',
        shift_label: null,
        event,
        time_text: time,
        hours,
        note: null,
        members: [],
      })
    }
  }

  return { shifts, year, month }
}

function isDataRow(row) {
  if (!row || row.length < 4) return false
  const dateVal = row[1]
  if (!dateVal) return false
  const s = String(dateVal).trim()
  if (/^\d{1,2}\/\d{1,2}$/.test(s)) return true
  if (typeof dateVal === 'number' && dateVal > 1) return true
  return false
}

function parseListFormat(rows) {
  const year = detectYear(rows)
  const month = detectMonth(rows)
  const shifts = []

  for (const row of rows) {
    if (!isDataRow(row)) continue

    const dateStr = parseDate(row[1], year)
    if (!dateStr) continue

    const rawTruck = String(row[3] || '').trim()
    if (!rawTruck) continue

    const { truck: parsedTruck, shift_label } = parseTruck(rawTruck)
    const truck = normalizeTruck(parsedTruck)
    if (!truck) continue

    const event = row[4] ? String(row[4]).trim().replace(/\n/g, ' ') : null
    const time_text = row[5] ? String(row[5]).trim().replace(/\n/g, ' ') : null

    let hours = null
    if (row[6]) {
      const h = parseFloat(String(row[6]).replace(/[^0-9.]/g, ''))
      if (!isNaN(h) && h > 0) hours = h
    }

    const note = row[12] ? String(row[12]).trim().replace(/\n/g, ' ') : null

    const members = []
    for (let i = 7; i <= 11; i++) {
      const m = parseMember(row[i] ? String(row[i]) : '')
      if (m) members.push(m)
    }

    shifts.push({
      work_date: dateStr,
      truck,
      shift_label,
      event: event || null,
      time_text: time_text || null,
      hours,
      note: note || null,
      members,
    })
  }

  return { shifts, year, month }
}

export function getSheetNames(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' })
        resolve(wb.SheetNames)
      } catch (err) { reject(err) }
    }
    reader.onerror = () => reject(new Error('파일 읽기 실패'))
    reader.readAsArrayBuffer(file)
  })
}

export function parseExcelFile(file, selectedSheet) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' })

        let sheet = null
        let sheetName = null
        if (selectedSheet && wb.SheetNames.includes(selectedSheet)) {
          sheet = wb.Sheets[selectedSheet]
          sheetName = selectedSheet
        } else {
          for (const name of wb.SheetNames) {
            if (name.includes('일별') || name.includes('스케줄')) {
              sheet = wb.Sheets[name]
              sheetName = name
              break
            }
          }
          if (!sheet) {
            sheet = wb.Sheets[wb.SheetNames[0]]
            sheetName = wb.SheetNames[0]
          }
        }

        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
        const format = detectFormat(rows)

        let result
        if (format === 'calendar') {
          result = parseCalendarFormat(rows)
        } else {
          result = parseListFormat(rows)
        }

        resolve({ shifts: result.shifts, year: result.year, month: result.month, sheetName })
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(new Error('파일 읽기 실패'))
    reader.readAsArrayBuffer(file)
  })
}
