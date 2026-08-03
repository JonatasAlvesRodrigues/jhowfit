import { Bell, ChevronDown } from 'lucide-react'
import { Logo } from './Navigation'

export function Header() {
  return <header className="header">
    <div className="header__mobile-logo"><Logo /></div>
    <div className="header__actions">
      <button className="icon-button notification" aria-label="Notificações"><Bell size={20}/><span /></button>
      <button className="profile"><div className="avatar">JS</div><div><strong>João Silva</strong><span>Nível 12 · Ativo</span></div><ChevronDown size={17}/></button>
    </div>
  </header>
}
