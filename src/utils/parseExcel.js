import * as XLSX from 'xlsx'

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

function resolveYear(dateStr, hintYear) {
  return hintYear
}

function parseDate(dateStr, hintYear) {
  if (!dateStr) return null
  const s = String(dateStr).trim()

  const match = s.match(/^(\d{1,2})\/(\d{1,2})$/)
  if (match) {
    const m = parseInt(match[1])
    const d = parseInt(match[2])
    const year = resolveYear(s, hintYear)
    return `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }

  if (typeof dateStr === 'number') {
    const parsed = XLSX.SSF.parse_date_code(dateStr)
    if (parsed) {
      return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`
    }
  }

  return null
}

function detectYear(rows) {
  for (const row of rows) {
    for (const cell of row) {
      if (!cell) continue
      const s = String(cell)
      const match = s.match(/(\d{4})\s*년/)
      if (match) return parseInt(match[1])
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

function isDataRow(row) {
  if (!row || row.length < 4) return false
  const dateVal = row[1]
  if (!dateVal) return false
  const s = String(dateVal).trim()
  if (/^\d{1,2}\/\d{1,2}$/.test(s)) return true
  if (typeof dateVal === 'number' && dateVal > 1) return true
  return false
}

export function parseExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' })

        let sheet = null
        let sheetName = null
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

        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
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

        resolve({ shifts, year, month, sheetName })
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(new Error('파일 읽기 실패'))
    reader.readAsArrayBuffer(file)
  })
}
