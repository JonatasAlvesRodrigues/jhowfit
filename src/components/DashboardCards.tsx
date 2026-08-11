import type { LucideIcon } from 'lucide-react'
import type { DashboardMetric, WeightPoint } from '../types/dashboard'
import { useAnimatedValue } from '../hooks/useAnimatedValue'

interface MetricCardProps {
  label: string
  icon: LucideIcon
  metric?: DashboardMetric
  currentLabel: string
  formatCurrent?: (value: number) => string
  goalLabel: string
  color: 'green' | 'orange' | 'blue' | 'purple'
  status?: string
  onClick: () => void
}

export function DashboardProgressRing({ value }: { value: number }) {
  const percentage = Math.max(0, Math.min(value, 100))
  const animatedPercentage = useAnimatedValue(percentage, { delay: 260, duration: 1100 })
  const radius = 58
  const circumference = 2 * Math.PI * radius
  const offset = circumference - animatedPercentage / 100 * circumference

  return (
    <div className="daily-ring" role="img" aria-label={`${percentage}% da meta diária`}>
      <svg viewBox="0 0 140 140" aria-hidden="true">
        <circle className="daily-ring__track" cx="70" cy="70" r={radius} />
        <circle
          className="daily-ring__value"
          cx="70"
          cy="70"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div><strong>{Math.round(animatedPercentage)}%</strong><span>concluído</span></div>
    </div>
  )
}

export function DashboardMetricCard({
  label,
  icon: Icon,
  metric,
  currentLabel,
  formatCurrent,
  goalLabel,
  color,
  status,
  onClick,
}: MetricCardProps) {
  const progress = metric ? Math.min(metric.current / Math.max(metric.goal, 1) * 100, 100) : 0
  const animatedCurrent = useAnimatedValue(metric?.current ?? 0, { delay: 320, duration: 1050 })
  const animatedProgress = metric ? Math.min(animatedCurrent / Math.max(metric.goal, 1) * 100, 100) : 0
  return (
    <button className={`daily-metric daily-metric--${color}`} data-metric={label.toLowerCase()} onClick={onClick}>
      <span className="daily-metric__icon"><Icon size={20} /></span>
      <span className="daily-metric__copy">
        <span className="daily-metric__top"><small>{label}</small><i>{status ?? `${Math.round(animatedProgress)}%`}</i></span>
        <strong>{formatCurrent ? formatCurrent(animatedCurrent) : currentLabel}</strong>
        <span className="daily-metric__goal">{goalLabel}</span>
        <span className="daily-progress" role="progressbar" aria-label={`${label}: ${Math.round(progress)}%`} aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${animatedProgress}%` }} /></span>
      </span>
    </button>
  )
}

export function MiniWeightChart({ points }: { points: WeightPoint[] }) {
  if (points.length < 2) {
    return <div className="weight-chart-empty"><span /><span /><span /><i /></div>
  }

  const values = points.map((point) => point.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = Math.max(max - min, 1)
  const coordinates = points.map((point, index) => {
    const x = points.length === 1 ? 50 : index / (points.length - 1) * 100
    const y = 34 - (point.value - min) / range * 26
    return `${x},${y}`
  }).join(' ')

  return (
    <svg className="weight-mini-chart" viewBox="0 0 100 42" preserveAspectRatio="none" role="img" aria-label="Gráfico recente de peso">
      <defs>
        <linearGradient id="dailyWeightGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#27d68f" stopOpacity=".35" />
          <stop offset="100%" stopColor="#27d68f" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,42 ${coordinates} 100,42`} fill="url(#dailyWeightGradient)" />
      <polyline points={coordinates} fill="none" stroke="#27d68f" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}
