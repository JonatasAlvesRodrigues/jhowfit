import { Apple, ChartNoAxesCombined, Dumbbell, LayoutDashboard, MoreHorizontal, Settings, Sparkles, Target } from 'lucide-react'
import { useApp } from '../contexts/AppContext'
import type { PageId } from '../types'

const mainItems: { id: PageId; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'inicio', label: 'Início', icon: LayoutDashboard },
  { id: 'treinos', label: 'Treinos', icon: Dumbbell },
  { id: 'nutricao', label: 'Nutrição', icon: Apple },
  { id: 'progresso', label: 'Progresso', icon: ChartNoAxesCombined },
  { id: 'mais', label: 'Mais', icon: MoreHorizontal },
]

export function Logo() {
  return <div className="logo"><div className="logo__mark"><span>J</span></div><div><strong>Jhow Fit</strong><small>EVOLUA TODO DIA</small></div></div>
}

export function Sidebar() {
  const { page, navigate, openModal } = useApp()
  return <aside className="sidebar">
    <Logo />
    <nav className="sidebar__nav">
      <p>MENU PRINCIPAL</p>
      {mainItems.slice(0, 4).map(({ id, label, icon: Icon }) =>
        <button key={id} className={page === id ? 'active' : ''} onClick={() => navigate(id)}><Icon size={20}/><span>{label}</span></button>
      )}
      <p>MINHA JORNADA</p>
      <button onClick={() => navigate('progresso')}><Target size={20}/><span>Metas</span></button>
      <button onClick={() => openModal('ai')}><Sparkles size={20}/><span>Coach IA</span><i>IA</i></button>
    </nav>
    <button className="sidebar__settings" onClick={() => navigate('mais')}><Settings size={19}/><span>Configurações</span></button>
  </aside>
}

export function BottomNav() {
  const { page, navigate } = useApp()
  return <nav className="bottom-nav">
    {mainItems.map(({ id, label, icon: Icon }) =>
      <button key={id} className={page === id ? 'active' : ''} onClick={() => navigate(id)}><Icon size={22}/><span>{label}</span></button>
    )}
  </nav>
}
