import { useEffect, useRef, useState } from 'react'
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
import { CommunityPage } from './pages/CommunityPage'
import { CommunityProfilePage } from './pages/CommunityProfilePage'
import { PwaInstallPrompt } from './components/PwaInstallPrompt'
import { PwaUpdatePrompt } from './components/PwaUpdatePrompt'
import { PlanWelcomeModal } from './components/PlanWelcomeModal'
import { PrivacyPage } from './pages/PrivacyPage'
import { AdminPage } from './pages/AdminPage'
import { PlansPage } from './pages/PlansPage'
import { CheckoutConfirmationPage, CheckoutPage } from './pages/CheckoutPages'
import { ErrorPage, LoadingScreen, NotFoundPage, RoutePlaceholder } from './pages/SystemPages'
import { useVitaRoute } from './hooks/useVitaRoute'
import { isPrivateRoute } from './utils/navigation'
import { notificationService } from './services/notificationService'
import { subscriptionService } from './services/subscriptionService'
import './pwa/registerServiceWorker'
import './productTheme.css'

type ThemePreference = 'light' | 'dark' | 'system'

export default function App() {
  const { route, status, navigate, retry } = useVitaRoute()
  const { user, role, roleLoading, loading: authLoading, recoveryMode, logout } = useAuth()
  const onboarding = useOnboardingStatus(user?.id)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [themePreference, setThemePreference] = useState<ThemePreference>('light')
  const [systemTheme, setSystemTheme] = useState<'dark' | 'light'>('light')
  const [showPlanWelcome, setShowPlanWelcome] = useState(false)
  const [showQuotaUpgrade, setShowQuotaUpgrade] = useState(false)
  const routeStageRef = useRef<HTMLDivElement>(null)
  const planWelcomeCheckRef = useRef<string | null>(null)
  const siteOrigin = typeof window === 'undefined' ? '' : window.location.origin

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const updateSystemTheme = () => setSystemTheme(mediaQuery.matches ? 'dark' : 'light')
    const savedTheme = window.localStorage.getItem('movelya-theme-preference') || window.localStorage.getItem('movelya-theme')
    if (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system') setThemePreference(savedTheme)
    updateSystemTheme()
    mediaQuery.addEventListener('change', updateSystemTheme)
    return () => mediaQuery.removeEventListener('change', updateSystemTheme)
  }, [])

  const theme = themePreference === 'system' ? systemTheme : themePreference

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
    window.localStorage.setItem('movelya-theme-preference', themePreference)
  }, [theme, themePreference])

  useEffect(() => {
    if (!user) return
    void notificationService.startReminderScheduler(user.id)
    return () => notificationService.stopReminderScheduler()
  }, [user?.id])

  useEffect(() => {
    if (!user || !onboarding.completed || onboarding.loading || !route || ['configuracao-inicial', 'checkout', 'checkout-confirmado'].includes(route.id)) return
    const key = `MOVELYA.plan-welcome.v1.${user.id}`
    if (window.localStorage.getItem(key) || planWelcomeCheckRef.current === user.id) return

    let cancelled = false
    planWelcomeCheckRef.current = user.id
    void subscriptionService.getOverview().then((overview) => {
      if (cancelled) return
      // The welcome offer is for Free accounts only. Existing paid members are
      // recorded as handled so they never see it merely because they logged in.
      window.localStorage.setItem(key, overview.code === 'FREE' ? 'shown' : 'skipped-paid')
      if (overview.code === 'FREE') setShowPlanWelcome(true)
    }).catch(() => {
      // Do not interrupt sign-in if subscription data is temporarily unavailable.
      planWelcomeCheckRef.current = null
    })

    return () => { cancelled = true }
  }, [user?.id, onboarding.completed, onboarding.loading, route?.id])

  useEffect(() => {
    if (!user || showPlanWelcome || !onboarding.completed || onboarding.loading || !route || ['configuracao-inicial', 'checkout', 'checkout-confirmado'].includes(route.id)) return
    const welcomeKey = `MOVELYA.plan-welcome.v1.${user.id}`
    if (!window.localStorage.getItem(welcomeKey)) return
    void subscriptionService.getOverview().then((overview) => {
      const nearLimit = overview.code === 'FREE' && overview.quotas.some((quota) => quota.monthly_limit > 0 && quota.used / quota.monthly_limit >= .8)
      const quotaKey = `MOVELYA.quota-upgrade.v1.${user.id}.${overview.renews_at}`
      if (nearLimit && !window.localStorage.getItem(quotaKey)) {
        window.localStorage.setItem(quotaKey, 'shown')
        setShowQuotaUpgrade(true)
      }
    }).catch(() => undefined)
  }, [user?.id, showPlanWelcome, onboarding.completed, onboarding.loading, route?.id])

  function closePlanWelcome() {
    if (user) window.localStorage.setItem(`MOVELYA.plan-welcome.v1.${user.id}`, 'seen')
    setShowPlanWelcome(false)
  }

  function closeQuotaUpgrade() { setShowQuotaUpgrade(false) }

  useEffect(() => {
    const root = routeStageRef.current
    if (!root || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const selector = [
      '.daily-panel', '.daily-insight', '.daily-metric', '.today-summary',
      '[class$="-card"]', '[class*="-card "]', '[class$="-panel"]', '[class*="-panel "]',
    ].join(',')
    const observed = new WeakSet<Element>()
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        entry.target.classList.add('is-scroll-visible')
        observer.unobserve(entry.target)
      })
    }, { threshold: 0.12, rootMargin: '0px 0px -24px' })

    const register = () => {
      root.querySelectorAll(selector).forEach((element, index) => {
        if (observed.has(element)) return
        observed.add(element)
        element.classList.add('motion-scroll-reveal')
        ;(element as HTMLElement).style.setProperty('--reveal-delay', `${Math.min(index % 4 * 55, 165)}ms`)
        observer.observe(element)
      })
    }

    register()
    const mutationObserver = new MutationObserver(register)
    mutationObserver.observe(root, { childList: true, subtree: true })
    return () => {
      observer.disconnect()
      mutationObserver.disconnect()
    }
  }, [route?.id, status])

  useEffect(() => {
    if (authLoading || roleLoading || onboarding.loading || status === 'booting' || status === 'transitioning') return
    if (import.meta.env.DEV && !user && route?.id === 'configuracao-inicial') return
    if (import.meta.env.DEV && !user && (route?.id === 'inicio' || route?.id === 'conquistas' || route?.id === 'comunidade')) return
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
    if (user && route?.id === 'administracao' && role === 'user') navigate('/inicio')
  }, [authLoading, roleLoading, onboarding.loading, onboarding.completed, status, recoveryMode, route, user, role, navigate])

  async function handleLogout() {
    await logout()
    navigate('/entrar')
  }

  if (status === 'booting' || authLoading || roleLoading || (Boolean(user) && onboarding.loading)) return <LoadingScreen />
  if (status === 'error') return <ErrorPage onRetry={retry} />
  if (import.meta.env.DEV && !user && route?.id === 'configuracao-inicial') {
    return <OnboardingPage userId="development-preview" initialName="João Silva" onComplete={() => undefined} />
  }
  if ((!user && isPrivateRoute(route) && !(import.meta.env.DEV && (route?.id === 'inicio' || route?.id === 'conquistas' || route?.id === 'comunidade'))) || (recoveryMode && route?.id !== 'redefinir-senha')) return <LoadingScreen />
  if (route?.public) return <><PwaInstallPrompt /><PwaUpdatePrompt /><AuthPage routeId={route.id} navigate={navigate} /></>
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
      <PwaUpdatePrompt />
      {showPlanWelcome ? <PlanWelcomeModal onChooseFree={closePlanWelcome} onChoosePaid={(planCode) => { closePlanWelcome(); navigate(`/checkout?plan=${planCode}`) }} /> : showQuotaUpgrade && <PlanWelcomeModal mode="quota-warning" onChooseFree={closeQuotaUpgrade} onChoosePaid={(planCode) => { closeQuotaUpgrade(); navigate(`/checkout?plan=${planCode}`) }} />}
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
            theme={theme}
            themePreference={themePreference}
            onSetTheme={setThemePreference}
          />

          <main className={`vita-main ${status === 'transitioning' ? 'is-transitioning' : ''}`}>
            <div className="route-progress" aria-hidden="true">
              {status === 'transitioning' && <span />}
            </div>
            <div className="vita-content" aria-live="polite">
              <div ref={routeStageRef} key={`${route?.id ?? 'not-found'}:${typeof window === 'undefined' ? '' : window.location.search}`} className="vita-route-stage">
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
                <ProfilePage userId={user?.id ?? ''} onLogout={handleLogout} onNavigate={navigate} />
              ) : route?.id === 'planos' && user ? (
                <PlansPage onNavigate={navigate} />
              ) : route?.id === 'checkout' && user ? (
                <CheckoutPage onNavigate={navigate} />
              ) : route?.id === 'checkout-confirmado' && user ? (
                <CheckoutConfirmationPage onNavigate={navigate} />
              ) : route?.id === 'configuracoes' && user ? (
                <HealthIntegrationsPage userId={user.id} />
              ) : route?.id === 'privacidade' && user ? (
                <PrivacyPage userId={user.id} onLogout={handleLogout} />
              ) : route?.id === 'administracao' && user && role !== 'user' ? (
                <AdminPage />
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
              ) : route?.id === 'comunidade' && (user || import.meta.env.DEV) ? (
                <CommunityPage userId={user?.id ?? 'development-preview'} onNavigate={navigate} />
              ) : route?.id === 'perfil-social' && user ? (
                <CommunityProfilePage viewerId={user.id} targetUserId={communityProfileUserId()} onNavigate={navigate} />
              ) : route ? (
                <RoutePlaceholder route={route} onNavigate={navigate} />
              ) : (
                <NotFoundPage onNavigate={() => navigate('/inicio')} />
              )}
              </div>
            </div>
          </main>
        </div>

        <MobileNavigation activeRoute={route?.id} onNavigate={navigate} />
      </div>
    </AppErrorBoundary>
  )
}

function communityProfileUserId() {
  if (typeof window === 'undefined') return ''
  const query = window.location.hash.includes('?') ? window.location.hash.split('?')[1] : window.location.search.slice(1)
  return new URLSearchParams(query).get('user') ?? ''
}
