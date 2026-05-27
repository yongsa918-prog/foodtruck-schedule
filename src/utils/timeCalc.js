function parseTime(str) {
  str = str.trim().toLowerCase()
  const match = str.match(/^(\d{1,2})(?::(\d{2}))?\s*(am?|pm?)?$/)
  if (!match) return null
  let hours = parseInt(match[1], 10)
  const minutes = match[2] ? parseInt(match[2], 10) : 0
  const period = match[3]

  let resolved = hours
  if (period) {
    if (period.startsWith('p') && hours !== 12) resolved += 12
    if (period.startsWith('a') && hours === 12) resolved = 0
  }

  return { hours: resolved + minutes / 60, raw: hours, hasPeriod: !!period }
}

export function calcHoursFromTimeText(text) {
  if (!text) return null
  const parts = text.split(/\s*[–—\-~]\s*/)
  if (parts.length !== 2) return null

  const start = parseTime(parts[0])
  const end = parseTime(parts[1])
  if (!start || !end) return null

  let startH = start.hours
  let endH = end.hours

  if (!start.hasPeriod && !end.hasPeriod && start.raw <= 12 && end.raw <= 12 && endH <= startH) {
    endH += 12
  }

  let diff = endH - startH
  if (diff < 0) diff += 24
  if (diff === 0 || diff > 16) return null

  return Math.round(diff * 4) / 4
}
