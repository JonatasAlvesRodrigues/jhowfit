import { Activity, Bell, BriefcaseBusiness, CalendarDays, ChevronRight, Dumbbell, Heart, Menu, Plus, Sparkles, UserRound } from 'lucide-react'
import type { ReactNode } from 'react'

export function ReferenceTrainingPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  return <section className="jhow-training" aria-label="Treinos">
    <header className="jhow-training-topbar">
      <button onClick={() => onNavigate('/perfil')} aria-label="Abrir menu"><Menu size={29}/></button>
      <div className="jhow-training-mark">M</div>
      <div><button onClick={() => onNavigate('/notificacoes')} aria-label="Notificações"><Bell size={25}/><i/></button><button onClick={() => onNavigate('/perfil')} aria-label="Perfil">J</button></div>
    </header>
    <section className="jhow-training-hero"><small>SEUS TREINOS</small><h1>Planeje.<br/>Execute.<br/><em>Evolua.</em></h1><p>Monte fichas manualmente ou revise uma sugestão criada com <b>IA.</b></p><button className="jhow-add-workout" aria-label="Criar treino"><Plus size={46}/></button></section>
    <nav className="jhow-training-tabs" aria-label="Atalhos de treino"><button className="is-active"><Dumbbell size={28}/></button><button><span>Ⅲ</span></button><button><Activity size={28}/></button><button><BriefcaseBusiness size={27}/></button></nav>
    <section className="jhow-week"><header><div><small>VISÃO SEMANAL</small><h2>Sua semana de treinos</h2></div><CalendarDays size={31}/></header><div className="jhow-week-days"><WeekDay day="SEG" name="Push (Empurrar)" percent="70%" kind="push"/><WeekDay day="TER" name={<>Pull (Puxar –<br/> Foco Bíceps)</>} percent="60%" kind="pull"/><WeekDay day="QUA" name={<>Legs (Pernas<br/> e Core)</>} percent="40%" kind="legs"/></div><div className="jhow-week-pager"><i/><i/><i/></div></section>
    <section className="jhow-saved"><small>FICHAS SALVAS</small><h2>Meus treinos</h2><p>Acesse e gerencie suas fichas de treino salvas.</p><ChevronRight size={28}/></section>
    <button className="jhow-ai jhow-ai--quiet" onClick={() => onNavigate('/assistente')} aria-label="Abrir assistente IA"><Sparkles size={21}/><b>IA</b></button>
    <nav className="jhow-bottom-nav" aria-label="Navegação principal"><Nav icon={<span className="jhow-home-glyph">⌂</span>} label="Início" onClick={() => onNavigate('/inicio')}/><Nav icon={<Dumbbell/>} label="Treino" active onClick={() => onNavigate('/treinos')}/><Nav icon={<Heart/>} label="Dieta" onClick={() => onNavigate('/dieta')}/><Nav icon={<Activity/>} label="Atividade" onClick={() => onNavigate('/atividades')}/><Nav icon={<UserRound/>} label="Perfil" onClick={() => onNavigate('/perfil')}/></nav>
  </section>
}
function WeekDay({day,name,percent,kind}:{day:string;name:ReactNode;percent:string;kind:string}) { return <article className={`jhow-week-day jhow-week-day--${kind}`}><header><small>{day}</small><i/></header><span className="jhow-week-icon">{kind==='push'?'⌁':kind==='pull'?'◔':'◡'}</span><strong>{name}</strong><footer><i><b style={{width:percent}}/></i><span>{percent}</span></footer></article> }
function Nav({icon,label,active=false,onClick}:{icon:ReactNode;label:string;active?:boolean;onClick:()=>void}) { return <button className={active?'is-active':''} onClick={onClick}>{icon}<span>{label}</span></button> }
