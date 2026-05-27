import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'

export function useScheduleData(year, month) {
  const [shifts, setShifts] = useState([])
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const channelRef = useRef(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const nextMonth = month + 1 > 12 ? 1 : month + 1
    const nextYear = month + 1 > 12 ? year + 1 : year
    const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`

    const [shiftsRes, staffRes] = await Promise.all([
      supabase
        .from('shift')
        .select('*, assignment(id, staff_id, member_text, is_driver, is_tentative)')
        .gte('work_date', startDate)
        .lt('work_date', endDate)
        .order('work_date')
        .order('sort_order')
        .order('id'),
      supabase
        .from('staff')
        .select('*')
        .eq('active', true)
        .order('name'),
    ])

    if (shiftsRes.error) {
      setError(shiftsRes.error.message)
    } else if (staffRes.error) {
      setError(staffRes.error.message)
    } else {
      setShifts(shiftsRes.data)
      setStaff(staffRes.data)
    }
    setLoading(false)
  }, [year, month])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
    }

    const channel = supabase
      .channel(`schedule-${year}-${month}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shift' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assignment' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'staff' }, () => fetchData())
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
    }
  }, [year, month, fetchData])

  return { shifts, staff, loading, error, refresh: fetchData }
}
