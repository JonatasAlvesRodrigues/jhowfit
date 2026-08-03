import { Activity, Ruler, Target, TrendingDown } from 'lucide-react'
import { WeightChart } from '../components/Charts'
import { Card } from '../components/ui'
import type { ChartPoint } from '../types'

export function ProgressPage({ weight }: { weight: ChartPoint[] }) {
  return <div className="page">
    <div className="page-heading"><div><p>MINHA EVOLUÇÃO</p><h1>Progresso</h1><span>Cada pequeno avanço conta.</span></div></div>
    <div className="progress-stats">
      <Card><span><TrendingDown size={20}/></span><div><small>PESO ATUAL</small><strong>79,8 kg</strong><p>-1,6 kg este mês</p></div></Card>
      <Card><span><Ruler size={20}/></span><div><small>GORDURA CORPORAL</small><strong>17,2%</strong><p>-1,1% este mês</p></div></Card>
      <Card><span><Activity size={20}/></span><div><small>MASSA MUSCULAR</small><strong>62,4 kg</strong><p>+0,6 kg este mês</p></div></Card>
    </div>
    <Card className="weight-card"><div className="section-heading"><div><small>ÚLTIMOS 6 MESES</small><h3>Evolução de peso</h3></div><span className="positive">-4,4 kg</span></div><WeightChart data={weight}/></Card>
    <Card className="target-card"><span><Target size={26}/></span><div><small>PRÓXIMA META</small><h3>Chegar aos 76 kg</h3><p>Faltam 3,8 kg · Previsão: 8 semanas</p></div><div className="target-progress"><b>68%</b><div className="progress"><span className="progress__fill green" style={{width:'68%'}}/></div></div></Card>
  </div>
}
