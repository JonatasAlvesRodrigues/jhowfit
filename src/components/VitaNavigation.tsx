import { X } from 'lucide-react'
import type { RouteId } from '../types/navigation'
import { mobileRoutes, vitaRoutes } from '../utils/navigation'

interface NavigationProps {
  activeRoute?: RouteId
  onNavigate: (path: string) => void
  onLogout?: () => void
}

export function VitaLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`vita-logo ${compact ? 'is-compact' : ''}`} aria-label="MOVELYA">
      <span className="vita-logo__mark">
        <img src="/movelya-logo.png" alt="" />
      </span>
      <span className="vita-logo__name">MOVE<strong>LYA</strong></span>
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
          {vitaRoutes.map(({ id, path, label, icon: Icon }) => (
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
