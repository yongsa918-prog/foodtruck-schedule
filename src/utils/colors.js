export function truckClass(truck) {
  if (!truck) return ''
  const t = truck.toLowerCase()
  if (t.includes('1호')) return 't1'
  if (t.includes('2호')) return 't2'
  if (t.includes('프랩') || t.includes('prep')) return 'prep'
  if (t.includes('케이터링') || t.includes('cater')) return 'cater'
  return ''
}

export function isMatchNote(note) {
  if (!note) return false
  return note.includes('⚽') || note.includes('⭐') || note.includes('경기')
}
