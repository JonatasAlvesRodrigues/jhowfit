import { useEffect, useState } from 'react'
import { AppErrorBoundary } from './components/AppErrorBoundary'
import { VitaHeader } from './components/VitaHeader'
import { MobileNavigation, VitaSidebar } from './components/VitaNavigation'
import { useAuth } from './contexts/AuthContext'
import { AuthPage } from './pages/AuthPages'
import { ProfilePage } from './pages/ProfilePage'
import { ErrorPage, LoadingScreen, NotFoundPage, RoutePlaceholder } from './pages/SystemPages'
import { useVitaRoute } from './hooks/useVitaRoute'
import { isPrivateRoute } from './utils/navigation'

export default function App() {
  const { route, status, navigate, retry } = useVitaRoute()
  const { user, loading: authLoading, recoveryMode, logout } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (authLoading || status === 'booting' || status === 'transitioning') return
    if (recoveryMode && route?.id !== 'redefinir-senha') {
      navigate('/redefinir-senha')
      return
    }
    if (!user && isPrivateRoute(route)) {
      navigate('/entrar')
      return
    }
    if (user && route?.public && route.id !== 'redefinir-senha' && route.id !== 'confirmar-email') {
      navigate('/inicio')
      return
    }
    if (user && route?.id === 'sair') handleLogout()
  }, [authLoading, status, recoveryMode, route, user, navigate])

  async function handleLogout() {
    await logout()
    navigate('/entrar')
  }

  if (status === 'booting' || authLoading) return <LoadingScreen />
  if (status === 'error') return <ErrorPage onRetry={retry} />
  if ((!user && isPrivateRoute(route)) || (recoveryMode && route?.id !== 'redefinir-senha')) return <LoadingScreen />
  if (route?.public) return <AuthPage routeId={route.id} navigate={navigate} />

  return (
    <AppErrorBoundary>
      <div className="vita-shell">
        <VitaSidebar
          activeRoute={route?.id}
          isOpen={sidebarOpen}
          onNavigate={(path) => {
            navigate(path)
            setSidebarOpen(false)
          }}
          onLogout={handleLogout}
          onClose={() => setSidebarOpen(false)}
        />

        <div className="vita-app">
          <VitaHeader
            route={route}
            onOpenMenu={() => setSidebarOpen(true)}
          />

          <main className={`vita-main ${status === 'transitioning' ? 'is-transitioning' : ''}`}>
            <div className="route-progress" aria-hidden="true">
              {status === 'transitioning' && <span />}
            </div>
            <div className="vita-content" aria-live="polite">
              {route?.id === 'perfil' ? (
                <ProfilePage onLogout={handleLogout} />
              ) : route ? (
                <RoutePlaceholder route={route} onNavigate={navigate} />
              ) : (
                <NotFoundPage onNavigate={() => navigate('/inicio')} />
              )}
            </div>
          </main>
        </div>

        <MobileNavigation activeRoute={route?.id} onNavigate={navigate} />
      </div>
    </AppErrorBoundary>
  )
}
