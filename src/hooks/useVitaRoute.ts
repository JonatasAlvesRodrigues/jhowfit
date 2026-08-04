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
    resolvePath(getCurrentPath())
    const onPopState = () => resolvePath(getCurrentPath(), true)
    window.addEventListener('popstate', onPopState)
    window.addEventListener('hashchange', onPopState)
    return () => {
      window.removeEventListener('popstate', onPopState)
      window.removeEventListener('hashchange', onPopState)
      if (timer.current) clearTimeout(timer.current)
    }
  }, [resolvePath])

  const navigate = useCallback((path: string) => {
    if (getCurrentPath() === path && status !== 'error') return
    const destination = isGitHubPages()
      ? `${getGitHubBase()}#${path}`
      : path
    window.history.pushState({}, '', destination)
    resolvePath(path, true)
  }, [resolvePath, status])

  const retry = useCallback(() => {
    setStatus('booting')
    resolvePath(getCurrentPath())
  }, [resolvePath])

  return { route, status, navigate, retry }
}

function isGitHubPages() {
  return window.location.hostname.endsWith('.github.io')
    || (import.meta.env.DEV && window.location.hash.startsWith('#/'))
}

function getGitHubBase() {
  const segment = window.location.pathname.split('/').filter(Boolean)[0]
  return segment ? `/${segment}/` : '/'
}

function getCurrentPath() {
  if (isGitHubPages()) {
    return window.location.hash.slice(1) || '/inicio'
  }
  return window.location.pathname
}
