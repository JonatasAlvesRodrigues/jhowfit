import { useEffect, useState } from 'react'
import { AppErrorBoundary } from './components/AppErrorBoundary'
import { VitaHeader } from './components/VitaHeader'
import { MobileNavigation, VitaSidebar } from './components/VitaNavigation'
import { useAuth } from './contexts/AuthContext'
import { AuthPage } from './pages/AuthPages'
import { DailyDashboardPage } from './pages/DailyDashboardPage'
import { NutritionPage } from './pages/Nutrition'
import { FoodDatabasePage } from './pages/FoodDatabasePage'
import { WaterPage } from './pages/WaterPage'
import { StepsPage } from './pages/StepsPage'
import { TrainingHubPage } from './pages/TrainingHubPage'
import { useOnboardingStatus } from './hooks/useOnboardingStatus'
import { OnboardingPage } from './pages/OnboardingPage'
import { ProfilePage } from './pages/ProfilePage'
import { HealthIntegrationsPage } from './pages/HealthIntegrationsPage'
import { BodyEvolutionPage } from './pages/BodyEvolutionPage'
import { GoalsPage } from './pages/GoalsPage'
import { WeeklyReportPage } from './pages/WeeklyReportPage'
import { FitnessChatPage } from './pages/FitnessChatPage'
import { NotificationsPage } from './pages/NotificationsPage'
import { AchievementsPage } from './pages/AchievementsPage'
import { PwaInstallPrompt } from './components/PwaInstallPrompt'
import { PrivacyPage } from './pages/PrivacyPage'
import { ErrorPage, LoadingScreen, NotFoundPage, RoutePlaceholder } from './pages/SystemPages'
import { useVitaRoute } from './hooks/useVitaRoute'
import { isPrivateRoute } from './utils/navigation'
import './pwa/registerServiceWorker'

export default function App() {
  const { route, status, navigate, retry } = useVitaRoute()
  const { user, loading: authLoading, recoveryMode, logout } = useAuth()
  const onboarding = useOnboardingStatus(user?.id)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const siteOrigin = typeof window === 'undefined' ? '' : window.location.origin

  useEffect(() => {
    if (authLoading || onboarding.loading || status === 'booting' || status === 'transitioning') return
    if (import.meta.env.DEV && !user && route?.id === 'configuracao-inicial') return
    if (import.meta.env.DEV && !user && (route?.id === 'inicio' || route?.id === 'conquistas')) return
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
  if ((!user && isPrivateRoute(route) && !(import.meta.env.DEV && (route?.id === 'inicio' || route?.id === 'conquistas'))) || (recoveryMode && route?.id !== 'redefinir-senha')) return <LoadingScreen />
  if (route?.public) return <><PwaInstallPrompt /><AuthPage routeId={route.id} navigate={navigate} /></>
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
      <PwaInstallPrompt />
      <title>MOVELYA — Saúde em movimento</title>
      <link rel="manifest" href={`${import.meta.env.BASE_URL}manifest.webmanifest`} />
      <meta name="description" content="Treinos, nutrição, hidratação e passos reunidos para acompanhar sua evolução no MOVELYA." />
      <meta property="og:title" content="MOVELYA — Seu movimento, passo a passo." />
      <meta property="og:description" content="Registre seus passos e acompanhe metas, sequência e ritmo semanal." />
      <meta property="og:image" content={`${siteOrigin}${import.meta.env.BASE_URL}og.png`} />
      <meta property="og:type" content="website" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:image" content={`${siteOrigin}${import.meta.env.BASE_URL}og.png`} />
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
            onNavigate={navigate}
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
              ) : route?.id === 'agua' && user ? (
                <WaterPage userId={user.id} />
              ) : route?.id === 'atividades' && user ? (
                <StepsPage userId={user.id} />
              ) : route?.id === 'treinos' && user ? (
                <TrainingHubPage userId={user.id} />
              ) : route?.id === 'perfil' ? (
                <ProfilePage onLogout={handleLogout} />
              ) : route?.id === 'configuracoes' && user ? (
                <HealthIntegrationsPage userId={user.id} />
              ) : route?.id === 'privacidade' && user ? (
                <PrivacyPage userId={user.id} onLogout={handleLogout} />
              ) : route?.id === 'evolucao' && user ? (
                <BodyEvolutionPage userId={user.id} />
              ) : route?.id === 'metas' && user ? (
                <GoalsPage userId={user.id} />
              ) : route?.id === 'relatorios' && user ? (
                <WeeklyReportPage userId={user.id} />
              ) : route?.id === 'assistente' && user ? (
                <FitnessChatPage userId={user.id} />
              ) : route?.id === 'notificacoes' && user ? (
                <NotificationsPage userId={user.id} onNavigate={navigate} />
              ) : route?.id === 'conquistas' && (user || import.meta.env.DEV) ? (
                <AchievementsPage userId={user?.id ?? 'development-preview'} />
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
