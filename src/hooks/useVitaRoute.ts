import { useCallback, useEffect, useRef, useState } from 'react'
import type { VitaRoute } from '../types/navigation'
import { findRoute } from '../utils/navigation'

type RouteStatus = 'booting' | 'ready' | 'transitioning' | 'error'

export function useVitaRoute() {
  const [route, setRoute] = useState<VitaRoute | null>(null)
  const [status, setStatus] = useState<RouteStatus>('booting')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const resolvePath = useCallback((pathname: string, withFeedback = false) => {
    if (timer.current) clearTimeout(timer.current)
    if (withFeedback) setStatus('transitioning')

    timer.current = setTimeout(() => {
      const nextRoute = findRoute(pathname)
      setRoute(nextRoute)
      document.title = nextRoute ? `${nextRoute.label} · VitaFit` : 'Página não encontrada · VitaFit'
      setStatus('ready')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }, withFeedback ? 240 : 320)
  }, [])

  useEffect(() => {
    resolvePath(window.location.pathname)
    const onPopState = () => resolvePath(window.location.pathname, true)
    window.addEventListener('popstate', onPopState)
    return () => {
      window.removeEventListener('popstate', onPopState)
      if (timer.current) clearTimeout(timer.current)
    }
  }, [resolvePath])

  const navigate = useCallback((path: string) => {
    if (window.location.pathname === path && status !== 'error') return
    window.history.pushState({}, '', path)
    resolvePath(path, true)
  }, [resolvePath, status])

  const retry = useCallback(() => {
    setStatus('booting')
    resolvePath(window.location.pathname)
  }, [resolvePath])

  return { route, status, navigate, retry }
}
