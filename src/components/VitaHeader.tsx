import { Bell, Menu, Moon, Sun } from 'lucide-react'
import type { VitaRoute } from '../types/navigation'
import { useAuth } from '../contexts/AuthContext'
import { VitaLogo } from './VitaNavigation'

export function VitaHeader({ route, onOpenMenu, onNavigate, theme, onToggleTheme }: { route: VitaRoute | null; onOpenMenu: () => void; onNavigate: (path: string) => void; theme: 'dark' | 'light'; onToggleTheme: () => void }) {
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
        <button className="theme-status" onClick={onToggleTheme} title={theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'} aria-label={theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'} aria-pressed={theme === 'light'}>
          {theme === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
          <span>{theme === 'dark' ? 'Escuro' : 'Claro'}</span>
        </button>
        <button className="vita-icon-button" onClick={() => onNavigate('/notificacoes')} aria-label="Abrir notificações"><Bell size={19} /><i /></button>
        <button className="vita-profile" onClick={() => onNavigate('/perfil')} aria-label="Abrir perfil">
          <span className="profile-avatar">{initials}</span>
          <span className="profile-copy"><strong>{name}</strong><small>{user?.email}</small></span>
        </button>
      </div>
    </header>
  )
}
