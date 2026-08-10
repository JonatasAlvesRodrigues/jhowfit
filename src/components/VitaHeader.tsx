import { Bell, Check, Menu, Monitor, Moon, Sun } from 'lucide-react'
import { useState } from 'react'
import type { VitaRoute } from '../types/navigation'
import { useAuth } from '../contexts/AuthContext'
import { VitaLogo } from './VitaNavigation'

type ThemePreference = 'light' | 'dark' | 'system'

export function VitaHeader({ route, onOpenMenu, onNavigate, theme, themePreference, onSetTheme }: { route: VitaRoute | null; onOpenMenu: () => void; onNavigate: (path: string) => void; theme: 'dark' | 'light'; themePreference: ThemePreference; onSetTheme: (theme: ThemePreference) => void }) {
  const { user } = useAuth()
  const [themeMenuOpen, setThemeMenuOpen] = useState(false)
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
        <div className="theme-control">
          <button className="theme-status" onClick={() => setThemeMenuOpen((current) => !current)} title="Alterar tema" aria-label="Alterar tema" aria-expanded={themeMenuOpen}>
            {themePreference === 'system' ? <Monitor size={16} /> : theme === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
            <span>{themePreference === 'system' ? 'Sistema' : theme === 'dark' ? 'Escuro' : 'Claro'}</span>
          </button>
          {themeMenuOpen && <div className="theme-picker" role="menu" aria-label="Escolher tema">
            <button className={themePreference === 'system' ? 'is-active' : ''} onClick={() => { onSetTheme('system'); setThemeMenuOpen(false) }} role="menuitem"><Monitor size={15} /><span>Sistema</span>{themePreference === 'system' && <Check size={14} />}</button>
            <button className={themePreference === 'light' ? 'is-active' : ''} onClick={() => { onSetTheme('light'); setThemeMenuOpen(false) }} role="menuitem"><Sun size={15} /><span>Claro</span>{themePreference === 'light' && <Check size={14} />}</button>
            <button className={themePreference === 'dark' ? 'is-active' : ''} onClick={() => { onSetTheme('dark'); setThemeMenuOpen(false) }} role="menuitem"><Moon size={15} /><span>Escuro</span>{themePreference === 'dark' && <Check size={14} />}</button>
          </div>}
        </div>
        <button className="vita-icon-button" onClick={() => onNavigate('/notificacoes')} aria-label="Abrir notificações"><Bell size={19} /><i /></button>
        <button className="vita-profile" onClick={() => onNavigate('/perfil')} aria-label="Abrir perfil">
          <span className="profile-avatar">{initials}</span>
          <span className="profile-copy"><strong>{name}</strong><small>{user?.email}</small></span>
        </button>
      </div>
    </header>
  )
}
