import { useState } from 'react'
import { AppErrorBoundary } from './components/AppErrorBoundary'
import { VitaHeader } from './components/VitaHeader'
import { MobileNavigation, VitaSidebar } from './components/VitaNavigation'
import { ErrorPage, LoadingScreen, NotFoundPage, RoutePlaceholder } from './pages/SystemPages'
import { useVitaRoute } from './hooks/useVitaRoute'

export default function App() {
  const { route, status, navigate, retry } = useVitaRoute()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  if (status === 'booting') return <LoadingScreen />
  if (status === 'error') return <ErrorPage onRetry={retry} />

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
              {route ? (
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
