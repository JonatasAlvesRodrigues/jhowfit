import type { ActivityType } from './outdoorActivityService'

interface LiveActivityPayload {
  type: ActivityType
  label: string
  startedAt: number
  elapsedSeconds?: number
  distanceKm?: number
  status?: 'active' | 'paused' | 'finished'
}

declare global {
  interface Window {
    webkit?: {
      messageHandlers?: {
        movelyaLiveActivity?: { postMessage: (message: { action: string; payload?: LiveActivityPayload }) => void }
      }
    }
  }
}

// A versão web não pode abrir uma Live Activity. Esta ponte será consumida por
// um futuro contêiner iOS com ActivityKit sem acoplar a interface ao código Swift.
export const liveActivityBridge = {
  isAvailable() { return Boolean(window.webkit?.messageHandlers?.movelyaLiveActivity) },
  start(payload: LiveActivityPayload) { post('start', payload) },
  update(payload: LiveActivityPayload) { post('update', payload) },
  end(payload: LiveActivityPayload) { post('end', payload) },
}

function post(action: string, payload: LiveActivityPayload) {
  window.webkit?.messageHandlers?.movelyaLiveActivity?.postMessage({ action, payload })
}
