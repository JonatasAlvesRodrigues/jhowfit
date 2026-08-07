import { Bell, Menu, Moon } from 'lucide-react'
import type { VitaRoute } from '../types/navigation'
import { useAuth } from '../contexts/AuthContext'
import { VitaLogo } from './VitaNavigation'

export function VitaHeader({ route, onOpenMenu, onNavigate }: { route: VitaRoute | null; onOpenMenu: () => void; onNavigate: (path: string) => void }) {
  const { user } = useAuth()
  const name = String(user?.user_metadata?.full_name || 'Usuário MOVELYA')
  const initials = name.split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase()
  return (
    <header className="vita-header">
      <div className="vita-header__mobile">
        <button className="header-menu-button" onClick={onOpenMenu} aria-label="Abrir menu">
          <Menu size={21} />
        </button>
        <VitaLogo compact />
      </div>
      <div className="vita-breadcrumb">
        <span>MOVELYA</span>
        <i>/</i>
        <strong key={route?.id ?? 'not-found'}>{route?.label ?? 'Página não encontrada'}</strong>
      </div>
      <div className="vita-header__actions">
        <span className="theme-status" title="Tema escuro ativo"><Moon size={16} /><span>Escuro</span></span>
        <button className="vita-icon-button" onClick={() => onNavigate('/notificacoes')} aria-label="Abrir notificações"><Bell size={19} /><i /></button>
        <button className="vita-profile" onClick={() => onNavigate('/perfil')} aria-label="Abrir perfil">
          <span className="profile-avatar">{initials}</span>
          <span className="profile-copy"><strong>{name}</strong><small>{user?.email}</small></span>
        </button>
      </div>
    </header>
  )
}
