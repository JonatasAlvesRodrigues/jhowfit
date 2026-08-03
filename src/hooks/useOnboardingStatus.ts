import { useCallback, useEffect, useState } from 'react'
import { onboardingService } from '../services/onboardingService'

export function useOnboardingStatus(userId?: string) {
  const [loading, setLoading] = useState(Boolean(userId))
  const [completed, setCompleted] = useState(false)
  const [available, setAvailable] = useState(true)

  const refresh = useCallback(async () => {
    if (!userId) {
      setCompleted(false)
      setLoading(false)
      return
    }
    setLoading(true)
    const status = await onboardingService.getStatus(userId)
    setCompleted(status.completed)
    setAvailable(status.available)
    setLoading(false)
  }, [userId])

  useEffect(() => { refresh() }, [refresh])

  return { loading, completed, available, refresh, markCompleted: () => setCompleted(true) }
}
