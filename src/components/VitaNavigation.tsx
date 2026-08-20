import { Apple, ChevronDown, ChartNoAxesCombined, UserRound, X } from 'lucide-react'
import { useEffect, useState } from 'react'
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
    <div className={`vita-logo ${compact ? 'is-compact' : ''}`} aria-label="MOVELYA">
      <span className="vita-logo__mark" aria-hidden="true">
        <img src={`${import.meta.env.BASE_URL}movelya-logo.png`} alt="" />
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
  const { role } = useAuth()
  const routes = role === 'user' ? vitaRoutes : [...vitaRoutes, adminRoute]
  const [expandedGroup, setExpandedGroup] = useState<string | null>(() => getGroupForRoute(activeRoute))

  useEffect(() => {
    const nextGroup = getGroupForRoute(activeRoute)
    if (nextGroup) setExpandedGroup(nextGroup)
  }, [activeRoute])

  const routeById = (id: RouteId) => routes.find((route) => route.id === id)
  const groups = [
    { id: 'nutrition', label: 'Alimentação', icon: Apple, routeIds: ['dieta', 'alimentos', 'agua'] as RouteId[] },
    { id: 'progress', label: 'Acompanhar', icon: ChartNoAxesCombined, routeIds: ['atividades', 'evolucao', 'relatorios', 'metas', 'conquistas', 'comunidade'] as RouteId[] },
    { id: 'account', label: 'Conta e preferências', icon: UserRound, routeIds: ['perfil', 'planos', 'configuracoes', 'privacidade', 'notificacoes'] as RouteId[] },
  ]
  const directRoutes = (['inicio', 'treinos', 'assistente'] as RouteId[]).map(routeById).filter(Boolean) as typeof routes
  const admin = routeById('administracao')
  const signOut = routeById('sair')
  const AdminIcon = admin?.icon
  const SignOutIcon = signOut?.icon

  function navigateTo(path: string) {
    onNavigate(path)
    onClose()
  }

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
          {directRoutes.map(({ id, path, label, icon: Icon }) => (
            <button
              key={id}
              data-route={id}
              className={activeRoute === id ? 'is-active' : ''}
              onClick={() => navigateTo(path)}
              aria-current={activeRoute === id ? 'page' : undefined}
            >
              <span className="nav-icon"><Icon size={19} /></span>
              <span>{label}</span>
              {activeRoute === id && <i />}
            </button>
          ))}
          {groups.map(({ id, label, icon: Icon, routeIds }) => {
            const groupRoutes = routeIds.map(routeById).filter(Boolean) as typeof routes
            const isExpanded = expandedGroup === id
            const hasActiveRoute = routeIds.includes(activeRoute as RouteId)
            return <div className={`nav-group ${isExpanded ? 'is-expanded' : ''}`} key={id}>
              <button className={`nav-group__toggle ${hasActiveRoute ? 'has-active-route' : ''}`} onClick={() => setExpandedGroup(isExpanded ? null : id)} aria-expanded={isExpanded}>
                <span className="nav-icon"><Icon size={19} /></span><span>{label}</span><ChevronDown size={16} />
              </button>
              <div className="nav-group__items">
                {groupRoutes.map(({ id: routeId, path, label: routeLabel, icon: RouteIcon }) => <button key={routeId} data-route={routeId} className={activeRoute === routeId ? 'is-active' : ''} onClick={() => navigateTo(path)} aria-current={activeRoute === routeId ? 'page' : undefined}><span className="nav-icon"><RouteIcon size={17} /></span><span>{routeLabel}</span></button>)}
              </div>
            </div>
          })}
          {admin && AdminIcon && <button className={activeRoute === admin.id ? 'is-active' : ''} onClick={() => navigateTo(admin.path)} aria-current={activeRoute === admin.id ? 'page' : undefined}><span className="nav-icon"><AdminIcon size={19} /></span><span>{admin.label}</span>{activeRoute === admin.id && <i />}</button>}
          {signOut && SignOutIcon && <button className="nav-signout" onClick={() => onLogout?.()}><span className="nav-icon"><SignOutIcon size={19} /></span><span>{signOut.label}</span></button>}
        </nav>
        <div className="sidebar-version">
          <span>MOVELYA</span>
          <small>Saúde em movimento</small>
        </div>
      </aside>
    </>
  )
}

function getGroupForRoute(routeId?: RouteId) {
  if (['dieta', 'alimentos', 'agua'].includes(routeId ?? '')) return 'nutrition'
  if (['atividades', 'evolucao', 'relatorios', 'metas', 'conquistas', 'comunidade'].includes(routeId ?? '')) return 'progress'
  if (['perfil', 'planos', 'configuracoes', 'privacidade', 'notificacoes'].includes(routeId ?? '')) return 'account'
  return null
}

export function MobileNavigation({ activeRoute, onNavigate }: NavigationProps) {
  return (
    <nav className="vita-bottom-nav" aria-label="Navegação mobile">
      {mobileRoutes.map(({ id, path, label, mobileLabel, icon: Icon }) => (
        <button
          key={id}
          data-route={id}
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
