import { useCallback, useEffect, useState } from 'react'
import { dashboardService } from '../services/dashboardService'
import type { DailyDashboardData } from '../types/dashboard'

export function useDailyDashboard(userId?: string) {
  const [data, setData] = useState<DailyDashboardData | null>(null)
  const [loading, setLoading] = useState(Boolean(userId))
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!userId) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      setData(await dashboardService.getDailyDashboard(userId))
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível carregar o resumo do dia.')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    void load()
  }, [load])

  return { data, loading, error, retry: load }
}
