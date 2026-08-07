import { Sparkles, X } from 'lucide-react'
import type { RouteId } from '../types/navigation'
import { adminRoute, mobileRoutes, vitaRoutes } from '../utils/navigation'
import { useAuth } from '../contexts/AuthContext'

interface NavigationProps {
  activeRoute?: RouteId
  onNavigate: (path: string) => void
  onLogout?: () => void
}

export function VitaLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`vita-logo ${compact ? 'is-compact' : ''}`} aria-label="JHOW">
      <span className="vita-logo__mark" aria-hidden="true">
        <span className="vita-logo__letter">M</span>
      </span>
      <span className="vita-logo__name">JH<strong>OW</strong></span>
    </div>
  )
}

export function VitaSidebar({
  activeRoute,
  onNavigate,
  onLogout,
  isOpen,
  onClose,
}: NavigationProps & { isOpen: boolean; onClose: () => void }) {
  const { role } = useAuth()
  const routes = role === 'user' ? vitaRoutes : [...vitaRoutes, adminRoute]
  return (
    <>
      <button
        className={`sidebar-scrim ${isOpen ? 'is-visible' : ''}`}
        onClick={onClose}
        aria-label="Fechar menu"
        tabIndex={isOpen ? 0 : -1}
      />
      <aside className={`vita-sidebar ${isOpen ? 'is-open' : ''}`}>
        <div className="vita-sidebar__top">
          <VitaLogo />
          <button className="sidebar-close" onClick={onClose} aria-label="Fechar menu">
            <X size={20} />
          </button>
        </div>
        <p className="nav-section-label">MENU PRINCIPAL</p>
        <nav className="desktop-nav" aria-label="Navegação principal">
          {routes.map(({ id, path, label, icon: Icon }) => (
            <button
              key={id}
              className={activeRoute === id ? 'is-active' : ''}
              onClick={() => id === 'sair' && onLogout ? onLogout() : onNavigate(path)}
              aria-current={activeRoute === id ? 'page' : undefined}
            >
              <span className="nav-icon"><Icon size={19} /></span>
              <span>{label}</span>
              {activeRoute === id && <i />}
            </button>
          ))}
        </nav>
        <div className="sidebar-version">
          <span>MOVELYA</span>
          <small>Versão inicial · Estrutura visual</small>
        </div>
      </aside>
    </>
  )
}

export function MobileNavigation({ activeRoute, onNavigate }: NavigationProps) {
  return (
    <nav className="vita-bottom-nav" aria-label="Navegação mobile">
      {mobileRoutes.map(({ id, path, label, mobileLabel, icon: Icon }) => (
        <button
          key={id}
          className={activeRoute === id ? 'is-active' : ''}
          onClick={() => onNavigate(path)}
          aria-current={activeRoute === id ? 'page' : undefined}
        >
          <span className="bottom-icon"><Icon size={21} /></span>
          <span>{mobileLabel ?? label}</span>
        </button>
      ))}
    </nav>
  )
}

export function AIFloatingButton({ onNavigate }: { onNavigate: (path: string) => void }) {
  return <button className="ai-floating-button" onClick={() => onNavigate('/assistente')} aria-label="Abrir assistente IA"><span><Sparkles size={20} /></span><b>IA</b></button>
}
