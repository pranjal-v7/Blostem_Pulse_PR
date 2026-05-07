import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Hook that subscribes to Supabase Realtime changes on prospects and signals tables.
 * Returns live-updating prospects list with signal counts.
 */
export function useRealtimeProspects() {
  const [prospects, setProspects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchProspects = useCallback(async () => {
    try {
      // Fetch prospects
      const { data: prospectsData, error: pError } = await supabase
        .from('prospects')
        .select('*')
        .order('intent_score', { ascending: false })

      if (pError) throw pError

      // Fetch signal counts per company
      const { data: signalData, error: sError } = await supabase
        .from('signals')
        .select('company_id, fetched_at')

      if (sError) throw sError

      // Aggregate signal data per company
      const signalMap = {}
      signalData?.forEach(s => {
        if (!signalMap[s.company_id]) {
          signalMap[s.company_id] = { count: 0, latest: null }
        }
        signalMap[s.company_id].count++
        const fetched = new Date(s.fetched_at)
        if (!signalMap[s.company_id].latest || fetched > signalMap[s.company_id].latest) {
          signalMap[s.company_id].latest = fetched
        }
      })

      // Merge
      const merged = prospectsData.map(p => ({
        ...p,
        signal_count: signalMap[p.id]?.count || 0,
        last_signal_at: signalMap[p.id]?.latest || null,
      }))

      setProspects(merged)
      setError(null)
    } catch (err) {
      console.error('Error fetching prospects:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProspects()

    // Subscribe to realtime changes on prospects
    const channel = supabase
      .channel('prospects-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'prospects' },
        () => {
          fetchProspects()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'signals' },
        () => {
          fetchProspects()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchProspects])

  return { prospects, loading, error, refetch: fetchProspects }
}
