import { prepareCommunityImage, type PreparedCommunityImage } from './communityService'
import type { Achievement } from './achievementService'

const achievementLabels: Record<string, string> = {
  'seven-day-streak': '7 DIAS DE ATIVIDADE',
  'thirty-day-streak': '30 DIAS DE ATIVIDADE',
  'first-50-km': 'PRIMEIROS 50 KM',
  'hundred-km': '100 KM ACUMULADOS',
  'fifty-workouts': '50 TREINOS',
  'weekly-top-three': 'TOP 3 DA SEMANA',
}

const achievementSymbols: Record<string, string> = {
  'seven-day-streak': '🔥', 'thirty-day-streak': '🔥', 'first-50-km': '🏃', 'hundred-km': '🏃',
  'fifty-workouts': '🏋️', 'weekly-top-three': '🏆',
}

export async function createAchievementShareImage(achievement: Achievement, displayName: string): Promise<PreparedCommunityImage> {
  const canvas = document.createElement('canvas')
  canvas.width = 1080
  canvas.height = 1080
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Não foi possível montar o card da conquista.')

  const background = context.createLinearGradient(0, 0, 1080, 1080)
  background.addColorStop(0, '#071c15')
  background.addColorStop(.5, '#102d21')
  background.addColorStop(1, '#06100d')
  context.fillStyle = background
  context.fillRect(0, 0, 1080, 1080)

  context.globalAlpha = .17
  context.fillStyle = '#48e0a0'
  context.beginPath(); context.arc(910, 155, 270, 0, Math.PI * 2); context.fill()
  context.fillStyle = '#d7ff9a'
  context.beginPath(); context.arc(90, 940, 210, 0, Math.PI * 2); context.fill()
  context.globalAlpha = 1

  context.strokeStyle = 'rgba(222,255,238,.20)'
  context.lineWidth = 3
  roundRect(context, 54, 54, 972, 972, 42)
  context.stroke()

  context.fillStyle = '#60e7ac'
  context.font = '700 31px Inter, Arial, sans-serif'
  context.letterSpacing = '4px'
  context.fillText('MOVELYA  •  COMUNIDADE', 104, 133)
  context.letterSpacing = '0px'

  context.fillStyle = '#e9fff2'
  context.font = '800 46px Inter, Arial, sans-serif'
  context.fillText('🏆  NOVA CONQUISTA', 104, 284)

  context.fillStyle = 'rgba(232,255,241,.72)'
  context.font = '500 37px Inter, Arial, sans-serif'
  context.fillText(`${displayName || 'Membro MOVELYA'} completou`, 104, 365)

  context.fillStyle = '#ffffff'
  context.font = '800 86px Inter, Arial, sans-serif'
  const label = achievementLabels[achievement.id] ?? achievement.title.toLocaleUpperCase('pt-BR')
  drawWrappedText(context, label, 104, 475, 850, 96)

  context.fillStyle = '#63e8ad'
  context.font = '150px Apple Color Emoji, Segoe UI Emoji, sans-serif'
  context.fillText(achievementSymbols[achievement.id] ?? '🏆', 104, 872)

  context.fillStyle = 'rgba(232,255,241,.74)'
  context.font = '500 30px Inter, Arial, sans-serif'
  context.fillText('Cada movimento constrói o seu ritmo.', 270, 854)
  context.fillStyle = 'rgba(232,255,241,.52)'
  context.font = '500 24px Inter, Arial, sans-serif'
  context.fillText(`+${achievement.xp} XP  •  conquista validada`, 270, 898)

  const blob = await canvasToBlob(canvas)
  const file = new File([blob], 'conquista-movelya.webp', { type: 'image/webp' })
  return prepareCommunityImage(file)
}

function drawWrappedText(context: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  const words = text.split(/\s+/)
  let line = ''
  let lineY = y
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (context.measureText(next).width > maxWidth && line) {
      context.fillText(line, x, lineY)
      line = word
      lineY += lineHeight
    } else line = next
  }
  if (line) context.fillText(line, x, lineY)
}

function roundRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath()
  context.roundRect(x, y, width, height, radius)
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Não foi possível gerar a imagem da conquista.')), 'image/webp', .9))
}
