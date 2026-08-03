import { Bell, Menu, Moon } from 'lucide-react'
import type { VitaRoute } from '../types/navigation'
import { useAuth } from '../contexts/AuthContext'
import { VitaLogo } from './VitaNavigation'

export function VitaHeader({ route, onOpenMenu }: { route: VitaRoute | null; onOpenMenu: () => void }) {
  const { user } = useAuth()
  const name = String(user?.user_metadata?.full_name || 'Usuário VitaFit')
  const initials = name.split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase()
  return (
    <header className="vita-header">
      <div className="vita-header__mobile">
        <button className="header-menu-button" onClick={onOpenMenu} aria-label="Abrir menu"><Menu size={21} /></button>
        <VitaLogo compact />
      </div>
      <div className="vita-breadcrumb">
        <span>VitaFit</span>
        <i>/</i>
        <strong>{route?.label ?? 'Página não encontrada'}</strong>
      </div>
      <div className="vita-header__actions">
        <span className="theme-status" title="Tema escuro ativo"><Moon size={16} /><span>Escuro</span></span>
        <button className="vita-icon-button" aria-label="Notificações"><Bell size={19} /><i /></button>
        <button className="vita-profile" aria-label="Abrir perfil">
          <span className="profile-avatar">{initials}</span>
          <span className="profile-copy"><strong>{name}</strong><small>{user?.email}</small></span>
        </button>
      </div>
    </header>
  )
}
