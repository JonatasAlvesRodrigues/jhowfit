import { useEffect, useState } from 'react'
import { AppErrorBoundary } from './components/AppErrorBoundary'
import { VitaHeader } from './components/VitaHeader'
import { MobileNavigation, VitaSidebar } from './components/VitaNavigation'
import { useAuth } from './contexts/AuthContext'
import { AuthPage } from './pages/AuthPages'
import { DailyDashboardPage } from './pages/DailyDashboardPage'
import { NutritionPage } from './pages/Nutrition'
import { FoodDatabasePage } from './pages/FoodDatabasePage'
import { TrainingHubPage } from './pages/TrainingHubPage'
import { useOnboardingStatus } from './hooks/useOnboardingStatus'
import { OnboardingPage } from './pages/OnboardingPage'
import { ProfilePage } from './pages/ProfilePage'
import { ErrorPage, LoadingScreen, NotFoundPage, RoutePlaceholder } from './pages/SystemPages'
import { useVitaRoute } from './hooks/useVitaRoute'
import { isPrivateRoute } from './utils/navigation'

export default function App() {
  const { route, status, navigate, retry } = useVitaRoute()
  const { user, loading: authLoading, recoveryMode, logout } = useAuth()
  const onboarding = useOnboardingStatus(user?.id)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (authLoading || onboarding.loading || status === 'booting' || status === 'transitioning') return
    if (import.meta.env.DEV && !user && route?.id === 'configuracao-inicial') return
    if (import.meta.env.DEV && !user && route?.id === 'inicio') return
    if (recoveryMode && route?.id !== 'redefinir-senha') {
      navigate('/redefinir-senha')
      return
    }
    if (!user && isPrivateRoute(route)) {
      navigate('/entrar')
      return
    }
    if (user && !onboarding.completed && route?.id !== 'configuracao-inicial' && route?.id !== 'redefinir-senha' && route?.id !== 'confirmar-email') {
      navigate('/configuracao-inicial')
      return
    }
    if (user && onboarding.completed && route?.id === 'configuracao-inicial') {
      navigate('/inicio')
      return
    }
    if (user && route?.public && route.id !== 'redefinir-senha' && route.id !== 'confirmar-email') navigate('/inicio')
    if (user && route?.id === 'sair') handleLogout()
  }, [authLoading, onboarding.loading, onboarding.completed, status, recoveryMode, route, user, navigate])

  async function handleLogout() {
    await logout()
    navigate('/entrar')
  }

  if (status === 'booting' || authLoading || (Boolean(user) && onboarding.loading)) return <LoadingScreen />
  if (status === 'error') return <ErrorPage onRetry={retry} />
  if (import.meta.env.DEV && !user && route?.id === 'configuracao-inicial') {
    return <OnboardingPage userId="development-preview" initialName="João Silva" onComplete={() => undefined} />
  }
  if ((!user && isPrivateRoute(route) && !(import.meta.env.DEV && route?.id === 'inicio')) || (recoveryMode && route?.id !== 'redefinir-senha')) return <LoadingScreen />
  if (route?.public) return <AuthPage routeId={route.id} navigate={navigate} />
  if (user && route?.id === 'configuracao-inicial') {
    return <OnboardingPage
      userId={user.id}
      initialName={String(user.user_metadata?.full_name ?? '')}
      onComplete={() => {
        onboarding.markCompleted()
        navigate('/inicio')
      }}
    />
  }

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
              {route?.id === 'inicio' && (user || import.meta.env.DEV) ? (
                <DailyDashboardPage userId={user?.id ?? '00000000-0000-0000-0000-000000000000'} onNavigate={navigate} />
              ) : route?.id === 'dieta' && user ? (
                <NutritionPage userId={user.id} onNavigate={navigate} />
              ) : route?.id === 'alimentos' && user ? (
                <FoodDatabasePage userId={user.id} />
              ) : route?.id === 'treinos' && user ? (
                <TrainingHubPage userId={user.id} />
              ) : route?.id === 'perfil' ? (
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
