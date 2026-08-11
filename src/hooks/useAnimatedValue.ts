import { useEffect, useState } from 'react'

interface AnimatedValueOptions {
  delay?: number
  duration?: number
}

export function useAnimatedValue(target: number, options: AnimatedValueOptions = {}) {
  const { delay = 120, duration = 900 } = options
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(target)
      return
    }

    let frame = 0
    const delayTimer = window.setTimeout(() => {
      const startedAt = performance.now()
      const tick = (now: number) => {
        const progress = Math.min((now - startedAt) / duration, 1)
        setValue(target * (1 - Math.pow(1 - progress, 3)))
        if (progress < 1) frame = window.requestAnimationFrame(tick)
      }
      frame = window.requestAnimationFrame(tick)
    }, delay)

    return () => {
      window.clearTimeout(delayTimer)
      window.cancelAnimationFrame(frame)
    }
  }, [delay, duration, target])

  return value
}
