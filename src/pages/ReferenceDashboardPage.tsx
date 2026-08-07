import { Activity, Bell, Droplets, Dumbbell, Flame, Footprints, Heart, Menu, Salad, Sparkles, UserRound } from 'lucide-react'
import type { ReactNode } from 'react'

export function ReferenceDashboardPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  return (
    <section className="jhow-dashboard" aria-label="Painel inicial Jhow">
      <header className="jhow-topbar">
        <button onClick={() => onNavigate('/perfil')} aria-label="Abrir menu"><Menu size={25} /></button>
        <div className="jhow-mark" aria-label="Jhow"><span>M</span></div>
        <div className="jhow-topbar__right">
          <button onClick={() => onNavigate('/notificacoes')} aria-label="Notificações"><Bell size={23} /><i /></button>
          <button onClick={() => onNavigate('/perfil')} aria-label="Perfil">J</button>
        </div>
      </header>

      <header className="jhow-greeting">
        <div><small>BOM DIA</small><h1>Jhow</h1><p>Sexta-feira, 07 de agosto</p></div>
        <div className="jhow-streak"><Flame size={22} fill="currentColor" /><strong>12</strong><span>dias de<br />sequência</span></div>
      </header>

      <article className="jhow-summary">
        <div className="jhow-summary__copy">
          <small>RESUMO DE HOJE</small>
          <h2>Cada escolha de hoje conta.</h2>
          <p>Sua hidratação está abaixo do esperado. Que tal beber mais 250 ml agora?</p>
          <div className="jhow-water-total"><Droplets size={17} fill="currentColor" /><strong>500 ml</strong><span>/ 2.000 ml</span></div>
        </div>
        <div className="jhow-ring"><svg viewBox="0 0 140 140" aria-hidden="true"><circle cx="70" cy="70" r="55" /><circle className="jhow-ring__value" cx="70" cy="70" r="55" /></svg><div><strong>25%</strong><span>Hidratação</span></div></div>
        <button className="jhow-goal" onClick={() => onNavigate('/agua')}>Meta diária <b>›</b></button>
      </article>

      <div className="jhow-metrics">
        <Metric icon={<Footprints />} title="PASSOS" value="7.842" sub="Meta 10.000" trend="+12%" tone="steps" onClick={() => onNavigate('/atividades')} chart />
        <Metric icon={<Flame />} title="CALORIAS" value={<>271 <em>kcal</em></>} sub="Meta 2.200 kcal" trend="12%" tone="calories" onClick={() => onNavigate('/dieta')} />
        <Metric icon={<Salad />} title="DIETA" value="" sub={<>Acompanhe suas<br />refeições</>} tone="diet" onClick={() => onNavigate('/dieta')} diet />
        <Metric icon={<Droplets />} title="HIDRATAÇÃO" value="" sub={<>Beba água e mantenha<br />o foco</>} trend="25%" tone="water" onClick={() => onNavigate('/agua')} water />
      </div>

      <div className="jhow-energy"><span><Flame size={17} fill="currentColor" /></span><strong>Energia</strong><b>Boa</b><em>72 <i>/ 100</i></em><div><i /><i /><i /><i /><i /></div></div>

      <button className="jhow-ai" onClick={() => onNavigate('/assistente')} aria-label="Abrir assistente IA"><Sparkles size={26} fill="currentColor" /><b>AI</b></button>

      <nav className="jhow-bottom-nav" aria-label="Navegação principal">
        <Nav icon={<HomeGlyph />} label="Início" active onClick={() => onNavigate('/inicio')} />
        <Nav icon={<Dumbbell />} label="Treino" onClick={() => onNavigate('/treinos')} />
        <Nav icon={<Heart />} label="Dieta" onClick={() => onNavigate('/dieta')} />
        <Nav icon={<Activity />} label="Atividade" onClick={() => onNavigate('/atividades')} />
        <Nav icon={<UserRound />} label="Perfil" onClick={() => onNavigate('/perfil')} />
      </nav>
    </section>
  )
}

function Metric({ icon, title, value, sub, trend, tone, onClick, chart, diet, water }: { icon: ReactNode; title: string; value: ReactNode; sub: ReactNode; trend?: string; tone: string; onClick: () => void; chart?: boolean; diet?: boolean; water?: boolean }) {
  return <button className={`jhow-metric jhow-metric--${tone}`} onClick={onClick}><div className="jhow-metric__title">{icon}<small>{title}</small></div>{trend && <i>{trend}</i>}{value && <strong>{value}</strong>}<span>{sub}</span>{chart ? <div className="jhow-line"><svg viewBox="0 0 190 42" preserveAspectRatio="none"><polyline points="2,34 28,25 49,27 72,15 99,10 123,22 149,13 170,6 188,1" /></svg><b /></div> : diet ? <><div className="jhow-diet-count"><b>2/3</b><span>refeições</span></div><div className="jhow-bar"><b /></div></> : water ? <><div className="jhow-water-count"><b>500</b> / 2.000 ml</div><div className="jhow-bar"><b /></div></> : <div className="jhow-bar"><b /></div>}</button>
}

function Nav({ icon, label, active = false, onClick }: { icon: ReactNode; label: string; active?: boolean; onClick: () => void }) { return <button className={active ? 'is-active' : ''} onClick={onClick}>{icon}<span>{label}</span></button> }
function HomeGlyph() { return <span className="jhow-home-glyph">⌂</span> }
