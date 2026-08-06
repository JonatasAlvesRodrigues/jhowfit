import { useState } from 'react'
import { Download, FileText, LoaderCircle, Share2, ShieldCheck, X } from 'lucide-react'
import { fitnessPdfService } from '../services/fitnessPdfService'
import type { WeeklyReport } from '../services/weeklyReportService'
import { generateFitnessPdf } from '../utils/fitnessPdfGenerator'

export function PdfExportDialog({ userId, report, onClose }: { userId: string; report: WeeklyReport; onClose: () => void }) {
  const [includeBodyMetrics, setIncludeBodyMetrics] = useState(false)
  const [includeObservations, setIncludeObservations] = useState(false)
  const [generating, setGenerating] = useState<'download' | 'share' | null>(null)
  const [error, setError] = useState('')

  async function create(action: 'download' | 'share') {
    try {
      setGenerating(action); setError('')
      const data = await fitnessPdfService.getData(userId, report, { includeBodyMetrics, includeObservations })
      const blob = generateFitnessPdf(data)
      const filename = `movelya-relatorio-${report.start}.pdf`
      const file = new File([blob], filename, { type: 'application/pdf' })
      if (action === 'share' && navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: 'Relatório fitness MOVELYA', text: `Relatório de ${report.start} a ${report.end}`, files: [file] })
      } else if (action === 'share') {
        setError('O compartilhamento de arquivos não está disponível neste navegador. Use “Baixar PDF” e compartilhe o arquivo pelo seu dispositivo.')
      } else {
        const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
      }
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === 'AbortError') return
      setError(reason instanceof Error ? reason.message : 'Não foi possível gerar o PDF.')
    } finally { setGenerating(null) }
  }

  return <div className="pdf-dialog-backdrop" role="presentation" onMouseDown={onClose}>
    <section className="pdf-dialog" role="dialog" aria-modal="true" aria-labelledby="pdf-dialog-title" onMouseDown={(event) => event.stopPropagation()}>
      <header><span><FileText size={21}/></span><div><small>EXPORTAÇÃO SEGURA</small><h2 id="pdf-dialog-title">Gerar relatório em PDF</h2></div><button onClick={onClose} aria-label="Fechar"><X size={19}/></button></header>
      <div className="pdf-dialog__preview"><FileText size={28}/><div><strong>Relatório fitness MOVELYA</strong><p>{formatDate(report.start)} a {formatDate(report.end)} · pronto para impressão</p></div></div>
      <div className="pdf-dialog__included"><strong>Incluído no relatório</strong><p>Resumo, treinos, alimentação, passos, água, gráficos e metas do período.</p></div>
      <fieldset><legend>Dados opcionais</legend>
        <label><input type="checkbox" checked={includeBodyMetrics} onChange={(event) => setIncludeBodyMetrics(event.target.checked)}/><span><b>Peso e medidas corporais</b><small>Inclui peso, gordura corporal e medidas registradas.</small></span></label>
        <label><input type="checkbox" checked={includeObservations} onChange={(event) => setIncludeObservations(event.target.checked)}/><span><b>Observações pessoais</b><small>Inclui anotações salvas em treinos e medidas.</small></span></label>
      </fieldset>
      <div className="pdf-privacy-note"><ShieldCheck size={17}/><p>Dados opcionais só são consultados e incluídos quando você os seleciona. O PDF é gerado no seu dispositivo.</p></div>
      {error && <p className="pdf-dialog__error" role="alert">{error}</p>}
      <footer><button className="pdf-share-button" onClick={() => void create('share')} disabled={Boolean(generating)}>{generating === 'share' ? <LoaderCircle className="spin" size={17}/> : <Share2 size={17}/>} Compartilhar</button><button className="pdf-download-button" onClick={() => void create('download')} disabled={Boolean(generating)}>{generating === 'download' ? <LoaderCircle className="spin" size={17}/> : <Download size={17}/>} Baixar PDF</button></footer>
    </section>
  </div>
}

function formatDate(value: string) { return new Intl.DateTimeFormat('pt-BR').format(new Date(`${value}T12:00:00`)) }
