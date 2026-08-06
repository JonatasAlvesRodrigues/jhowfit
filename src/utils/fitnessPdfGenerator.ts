import { jsPDF } from 'jspdf'
import type { FitnessPdfData } from '../services/fitnessPdfService'

const green: [number, number, number] = [14, 163, 109]
const ink: [number, number, number] = [18, 28, 23]
const muted: [number, number, number] = [96, 112, 103]
const line: [number, number, number] = [220, 229, 224]
const paper: [number, number, number] = [249, 251, 250]

export function generateFitnessPdf(data: FitnessPdfData) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true })
  const pageWidth = doc.internal.pageSize.getWidth(), pageHeight = doc.internal.pageSize.getHeight()
  const margin = 42, contentWidth = pageWidth - margin * 2
  let y = 76

  const newPage = () => { doc.addPage(); y = 76 }
  const ensure = (height: number) => { if (y + height > pageHeight - 58) newPage() }
  const text = (value: string, x: number, top: number, size = 9, color = ink, style: 'normal' | 'bold' = 'normal') => { doc.setFont('helvetica', style); doc.setFontSize(size); doc.setTextColor(...color); doc.text(value, x, top) }
  const section = (title: string, note?: string, reserve = 35) => { ensure(44 + reserve); y += 12; doc.setFillColor(...green); doc.roundedRect(margin, y, 5, 22, 2, 2, 'F'); text(title, margin + 15, y + 15, 15, ink, 'bold'); if (note) { doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(...muted); doc.text(note, pageWidth - margin, y + 14, { align: 'right' }) } y += 34 }
  const empty = (label: string) => { ensure(35); doc.setFillColor(...paper); doc.roundedRect(margin, y, contentWidth, 30, 6, 6, 'F'); text(label, margin + 12, y + 19, 8, muted); y += 38 }
  const table = (headers: string[], rows: string[][], widths: number[]) => {
    const rowHeight = 23
    const drawHeader = () => { doc.setFillColor(...ink); doc.roundedRect(margin, y, contentWidth, rowHeight, 5, 5, 'F'); let headerX = margin; headers.forEach((header, index) => { text(header, headerX + 7, y + 15, 7, [255,255,255], 'bold'); headerX += widths[index] }); y += rowHeight }
    ensure(rowHeight * 2); drawHeader()
    rows.forEach((row, rowIndex) => { if (y + rowHeight > pageHeight - 58) { newPage(); drawHeader() }; if (rowIndex % 2 === 0) { doc.setFillColor(...paper); doc.rect(margin, y, contentWidth, rowHeight, 'F') }; let x = margin; row.forEach((cell, index) => { const clipped = doc.splitTextToSize(cell || '-', Math.max(20, widths[index] - 12))[0]; text(clipped, x + 7, y + 15, 7.3, index === 0 ? ink : muted, index === 0 ? 'bold' : 'normal'); x += widths[index] }); doc.setDrawColor(...line); doc.line(margin, y + rowHeight, margin + contentWidth, y + rowHeight); y += rowHeight })
    y += 7
  }

  doc.setFillColor(...ink); doc.rect(0, 0, pageWidth, 212, 'F'); doc.setFillColor(...green); doc.roundedRect(margin, 40, 34, 34, 8, 8, 'F'); text('M', margin + 10, 64, 20, [255,255,255], 'bold'); text('MOVELYA', margin + 45, 62, 17, [255,255,255], 'bold')
  text('RELATÓRIO FITNESS', margin, 112, 8, green, 'bold'); text(data.userName, margin, 143, 25, [255,255,255], 'bold'); text(`Período: ${formatDate(data.period.start)} a ${formatDate(data.period.end)}`, margin, 169, 10, [213,225,219]); text('Gerado a partir dos registros escolhidos pelo usuário.', margin, 190, 8, [162,181,171]); y = 238

  section('Resumo geral')
  const cards = [
    ['Treinos', `${data.summary.completed} de ${data.summary.planned}`], ['Duração', formatDuration(data.summary.duration)],
    ['Passos / dia', formatNumber(data.summary.steps)], ['Distância', `${decimal(data.summary.distance)} km`],
    ['Água / dia', `${decimal(data.summary.water)} L`], ['Calorias / dia', `${formatNumber(Math.round(data.summary.calories))} kcal`],
    ['Proteína / dia', `${Math.round(data.summary.protein)} g`], ['Metas concluídas', String(data.summary.goals)],
  ]
  cards.forEach(([label, value], index) => { const col = index % 2, rowY = y + Math.floor(index / 2) * 58; doc.setFillColor(...paper); doc.setDrawColor(...line); doc.roundedRect(margin + col * (contentWidth / 2 + 5), rowY, contentWidth / 2 - 5, 48, 7, 7, 'FD'); text(label.toUpperCase(), margin + 12 + col * (contentWidth / 2 + 5), rowY + 15, 6.8, muted, 'bold'); text(value, margin + 12 + col * (contentWidth / 2 + 5), rowY + 35, 13, ink, 'bold') }); y += 240

  section('Gráficos', 'Visão diária')
  ensure(175); drawStepsChart(doc, data, margin, y, contentWidth, 145); y += 162
  if (data.measurements.length > 1) { ensure(160); drawWeightChart(doc, data, margin, y, contentWidth, 130); y += 146 }

  section('Treinos', `${data.workouts.length} registro(s)`)
  if (data.workouts.length) table(['Data','Treino','Status','Duração','Volume'], data.workouts.map((item) => [formatDate(item.date), item.name, item.status, `${item.minutes} min`, `${formatNumber(Math.round(item.volume))} kg`]), [70,180,83,75,93]); else empty('Nenhum treino registrado no período.')
  section('Alimentação', `${data.meals.length} registro(s)`)
  if (data.meals.length) table(['Data / hora','Refeição','Calorias','Proteína','Carboidratos','Gorduras'], data.meals.map((item) => [`${formatDate(item.date)} ${item.time}`, item.name, `${item.calories} kcal`, `${decimal(item.protein)} g`, `${decimal(item.carbs)} g`, `${decimal(item.fat)} g`]), [83,160,65,64,72,67]); else empty('Nenhuma refeição registrada no período.')
  section('Passos', `${data.steps.length} registro(s)`)
  if (data.steps.length) table(['Data','Passos','Distância'], data.steps.map((item) => [formatDate(item.date), formatNumber(item.steps), `${decimal(item.distance)} km`]), [160,170,181]); else empty('Nenhum registro manual de passos no período. Totais de integrações aparecem no resumo e no gráfico.')
  section('Água', `${data.water.length} registro(s)`)
  if (data.water.length) table(['Data','Horário','Quantidade'], data.water.map((item) => [formatDate(item.date), item.time, `${item.amountMl} ml`]), [170,160,181]); else empty('Nenhum consumo de água registrado no período.')

  section('Peso e medidas', data.measurements.length ? 'Incluídos com autorização' : 'Não incluídos')
  if (data.measurements.length) table(['Data','Peso','Gordura','Cintura','Abdômen','Peito','Braço','Quadril','Coxa','Panturrilha'], data.measurements.map((item) => [formatDate(item.date), `${decimal(item.weight)} kg`, metric(item.bodyFat, '%'), metric(item.waist), metric(item.abdomen), metric(item.chest), metric(item.arm), metric(item.hips), metric(item.thigh), metric(item.calf)]), [56,54,52,51,55,47,47,51,48,50]); else empty('Peso e medidas não foram selecionados ou não possuem registros no período.')
  section('Metas', `${data.goals.length} meta(s)`)
  if (data.goals.length) table(['Meta','Progresso','Objetivo','Status'], data.goals.map((item) => [item.name, `${decimal(item.progress)} ${item.unit}`, `${decimal(item.target)} ${item.unit}`, item.status]), [215,105,105,86]); else empty('Nenhuma meta ativa no período.')
  section('Observações', data.observations.length ? 'Incluídas com autorização' : 'Não incluídas', 70)
  if (data.observations.length) data.observations.forEach((observation, index) => { const lines = doc.splitTextToSize(`${index + 1}. ${observation}`, contentWidth - 24); const height = Math.max(32, lines.length * 11 + 18); ensure(height); doc.setFillColor(...paper); doc.roundedRect(margin, y, contentWidth, height, 7, 7, 'F'); doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(...ink); doc.text(lines, margin + 12, y + 17); y += height + 7 }); else empty('Observações pessoais não foram selecionadas ou não existem no período.')

  const pages = doc.getNumberOfPages()
  for (let page = 1; page <= pages; page += 1) { doc.setPage(page); if (page > 1) { doc.setFillColor(...ink); doc.rect(0,0,pageWidth,48,'F'); text('MOVELYA', margin, 30, 11, [255,255,255], 'bold'); doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(193,208,200); doc.text(`${formatDate(data.period.start)} a ${formatDate(data.period.end)}`, pageWidth - margin, 30, { align: 'right' }) } doc.setDrawColor(...line); doc.line(margin, pageHeight - 38, pageWidth - margin, pageHeight - 38); text('MOVELYA - Relatório fitness', margin, pageHeight - 21, 7, muted); doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(...muted); doc.text(`Página ${page} de ${pages}`, pageWidth - margin, pageHeight - 21, { align: 'right' }) }
  return doc.output('blob')
}

function drawStepsChart(doc: jsPDF, data: FitnessPdfData, x: number, y: number, width: number, height: number) { doc.setFillColor(...paper); doc.roundedRect(x,y,width,height,8,8,'F'); doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(...ink); doc.text('Passos por dia',x+14,y+18); const values=data.summary.daily.map((day)=>day.steps); const max=Math.max(1,...values); const base=y+height-25, chartH=height-55, gap=8, barW=(width-42-gap*6)/7; values.forEach((value,index)=>{const barH=value/max*chartH; doc.setFillColor(...green); doc.roundedRect(x+18+index*(barW+gap),base-barH,barW,barH,3,3,'F'); doc.setFontSize(6.5); doc.setTextColor(...muted); doc.text(data.summary.daily[index].day,x+18+index*(barW+gap)+barW/2,base+11,{align:'center'})}) }
function drawWeightChart(doc: jsPDF, data: FitnessPdfData, x: number, y: number, width: number, height: number) { const values=data.measurements.map((item)=>item.weight); const min=Math.min(...values)-.2,max=Math.max(...values)+.2; doc.setFillColor(...paper); doc.roundedRect(x,y,width,height,8,8,'F'); doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(...ink); doc.text('Evolução de peso',x+14,y+18); doc.setDrawColor(...green); doc.setLineWidth(2); const points=values.map((value,index)=>({x:x+20+index*(width-40)/Math.max(1,values.length-1),y:y+height-24-(value-min)/(max-min)*(height-55)})); points.slice(1).forEach((point,index)=>doc.line(points[index].x,points[index].y,point.x,point.y)); points.forEach((point)=>{doc.setFillColor(...green);doc.circle(point.x,point.y,3,'F')}) }
function formatDate(value: string) { return new Intl.DateTimeFormat('pt-BR').format(new Date(value.includes('T') ? value : `${value}T12:00:00`)) }
function formatNumber(value: number) { return Math.round(value).toLocaleString('pt-BR') }
function decimal(value: number) { return value.toFixed(1).replace('.', ',') }
function formatDuration(minutes: number) { return minutes >= 60 ? `${Math.floor(minutes/60)}h ${minutes%60}min` : `${minutes} min` }
function metric(value: number | null, unit='cm') { return value === null ? '-' : `${decimal(value)} ${unit}` }
