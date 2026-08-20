import { jsPDF } from 'jspdf'
import type { SavedDietPlan } from '../services/nutritionService'

const green: [number, number, number] = [18, 130, 90]
const ink: [number, number, number] = [23, 37, 29]
const muted: [number, number, number] = [100, 119, 108]
const line: [number, number, number] = [220, 229, 223]
const paper: [number, number, number] = [248, 251, 249]

export function generateNutritionDietPdf(diet: SavedDietPlan) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 42
  const contentWidth = pageWidth - margin * 2
  let y = 222

  const setText = (value: string, x: number, top: number, size = 9, color = ink, weight: 'normal' | 'bold' = 'normal') => {
    doc.setFont('helvetica', weight)
    doc.setFontSize(size)
    doc.setTextColor(...color)
    doc.text(value, x, top)
  }
  const drawPageHeader = (continuation = false) => {
    doc.setFillColor(...ink)
    doc.rect(0, 0, pageWidth, continuation ? 50 : 198, 'F')
    doc.setFillColor(...green)
    doc.roundedRect(margin, continuation ? 12 : 38, 34, 34, 8, 8, 'F')
    setText('M', margin + 10, continuation ? 36 : 62, 20, [255, 255, 255], 'bold')
    setText('MOVELYA', margin + 45, continuation ? 33 : 60, continuation ? 11 : 17, [255, 255, 255], 'bold')
    if (continuation) return
    setText('PLANO ALIMENTAR', margin, 108, 8, [92, 221, 166], 'bold')
    setText(clean(diet.name), margin, 141, 24, [255, 255, 255], 'bold')
    const date = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(new Date(diet.createdAt))
    setText(`Plano salvo em ${date}`, margin, 165, 9, [205, 224, 213])
    setText('Sugestao alimentar personalizada - confira porcoes, marcas e preparo.', margin, 184, 7.5, [165, 190, 176])
  }
  const newPage = () => { doc.addPage(); drawPageHeader(true); y = 76 }
  const ensure = (height: number) => { if (y + height > pageHeight - 58) newPage() }
  const paragraph = (value: string, x: number, top: number, width: number, size = 8.5, color = muted, weight: 'normal' | 'bold' = 'normal') => {
    doc.setFont('helvetica', weight)
    doc.setFontSize(size)
    doc.setTextColor(...color)
    const lines = doc.splitTextToSize(clean(value), width) as string[]
    doc.text(lines, x, top)
    return lines.length * (size + 2)
  }
  const measure = (value: string, width: number, size = 8.2) => {
    doc.setFontSize(size)
    return (doc.splitTextToSize(clean(value), width) as string[]).length * (size + 2)
  }

  drawPageHeader()
  const summaryHeight = measure(diet.plan.summary, contentWidth - 28, 9) + 26
  doc.setFillColor(...paper)
  doc.setDrawColor(...line)
  doc.roundedRect(margin, y, contentWidth, summaryHeight, 10, 10, 'FD')
  paragraph(diet.plan.summary, margin + 14, y + 17, contentWidth - 28, 9, muted)
  y += summaryHeight + 14

  const cards = [
    ['CALORIAS', `~ ${Math.round(diet.plan.dailyCalories)} kcal/dia`],
    ['PROTEINA', `~ ${Math.round(diet.plan.protein)} g/dia`],
    ['REFEICOES', `${diet.plan.meals.length} no plano`],
    ['CUSTO ESTIMADO', `R$ ${diet.plan.estimatedWeeklyCost}/semana`],
  ]
  cards.forEach(([label, value], index) => {
    const col = index % 2
    const row = Math.floor(index / 2)
    const x = margin + col * (contentWidth / 2 + 5)
    const top = y + row * 54
    doc.setFillColor(...paper)
    doc.setDrawColor(...line)
    doc.roundedRect(x, top, contentWidth / 2 - 5, 46, 8, 8, 'FD')
    setText(label, x + 11, top + 15, 6.5, muted, 'bold')
    setText(value, x + 11, top + 33, 11, ink, 'bold')
  })
  y += 121

  const notice = diet.plan.estimatesNotice || 'Calorias e macronutrientes sao estimativas e podem variar conforme marcas, porcoes e preparo.'
  const noticeHeight = measure(notice, contentWidth - 48, 7.8) + 20
  ensure(noticeHeight + 20)
  doc.setFillColor(234, 245, 251)
  doc.roundedRect(margin, y, contentWidth, noticeHeight, 8, 8, 'F')
  doc.setFillColor(...green)
  doc.circle(margin + 14, y + 15, 4, 'F')
  paragraph(notice, margin + 28, y + 15, contentWidth - 42, 7.8, muted)
  y += noticeHeight + 20

  ensure(36)
  doc.setFillColor(...green)
  doc.roundedRect(margin, y, 5, 22, 2, 2, 'F')
  setText('REFEICOES DO PLANO', margin + 15, y + 15, 15, ink, 'bold')
  y += 34

  diet.plan.meals.forEach((meal, index) => {
    const foodsHeight = meal.foods.reduce((total, food) => total + measure(`- ${food}`, contentWidth - 48, 8), 0)
    const prepHeight = meal.preparation || meal.notes ? measure(`Preparo: ${meal.preparation || meal.notes}`, contentWidth - 48, 8) + 16 : 0
    const alternativesHeight = meal.alternatives.reduce((total, alternative) => total + measure(`${alternative.name}: ${alternative.foods.join(' - ')}`, contentWidth - 48, 7.6) + 5, 16)
    const cardHeight = 60 + foodsHeight + prepHeight + alternativesHeight
    ensure(cardHeight + 8)
    doc.setFillColor(...paper)
    doc.setDrawColor(...line)
    doc.roundedRect(margin, y, contentWidth, cardHeight, 11, 11, 'FD')
    doc.setFillColor(...green)
    doc.roundedRect(margin + 13, y + 13, 25, 25, 7, 7, 'F')
    setText(String(index + 1), margin + 25.5, y + 30, 9, [255, 255, 255], 'bold')
    setText(clean(meal.name).toUpperCase(), margin + 49, y + 23, 7, green, 'bold')
    setText(`~ ${Math.round(meal.calories)} kcal`, margin + 49, y + 39, 13, ink, 'bold')
    const macros = `P ${Math.round(meal.protein)} g - C ${Math.round(meal.carbs)} g - G ${Math.round(meal.fat)} g`
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.2); doc.setTextColor(...green); doc.text(macros, pageWidth - margin - 13, y + 30, { align: 'right' })
    let innerY = y + 57
    meal.foods.forEach((food) => { innerY += paragraph(`- ${food}`, margin + 18, innerY, contentWidth - 36, 8, muted) })
    if (meal.preparation || meal.notes) {
      const prepText = `Preparo: ${meal.preparation || meal.notes}`
      const height = measure(prepText, contentWidth - 48, 8) + 13
      doc.setFillColor(255, 255, 255)
      doc.roundedRect(margin + 14, innerY + 3, contentWidth - 28, height, 6, 6, 'F')
      paragraph(prepText, margin + 22, innerY + 14, contentWidth - 44, 8, ink)
      innerY += height + 6
    }
    if (meal.alternatives.length) {
      setText('SUBSTITUICOES', margin + 18, innerY + 10, 6.5, green, 'bold')
      innerY += 19
      meal.alternatives.forEach((alternative) => { innerY += paragraph(`${alternative.name}: ${alternative.foods.join(' - ')}`, margin + 18, innerY, contentWidth - 36, 7.6, muted) + 5 })
    }
    y += cardHeight + 8
  })

  const safety = diet.plan.safetyNotice || 'Este plano e uma sugestao alimentar e nao substitui orientacao nutricional ou medica.'
  const safetyHeight = measure(safety, contentWidth - 28, 7.8) + 20
  ensure(safetyHeight)
  doc.setFillColor(255, 242, 230)
  doc.roundedRect(margin, y, contentWidth, safetyHeight, 8, 8, 'F')
  paragraph(safety, margin + 14, y + 15, contentWidth - 28, 7.8, muted)

  const pages = doc.getNumberOfPages()
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page)
    doc.setDrawColor(...line)
    doc.line(margin, pageHeight - 37, pageWidth - margin, pageHeight - 37)
    setText('MOVELYA - Plano alimentar', margin, pageHeight - 20, 7, muted)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...muted)
    doc.text(`Pagina ${page} de ${pages}`, pageWidth - margin, pageHeight - 20, { align: 'right' })
  }
  doc.setProperties({ title: `${diet.name} - Plano alimentar MOVELYA`, subject: 'Plano alimentar salvo' })
  return doc.output('blob')
}

function clean(value: string) { return value.replace(/[\u2013\u2014]/g, '-').replace(/\s+/g, ' ').trim() }
