import { ArrowLeft, ArrowRight, Construction, Dumbbell, RefreshCw, Sparkles, TriangleAlert } from 'lucide-react'
import type { VitaRoute } from '../types/navigation'

export function LoadingScreen() {
  return (
    <div className="system-screen loading-screen" role="status" aria-label="Carregando MOVELYA">
      <div className="loading-brand">
        <span><img src={`${import.meta.env.BASE_URL}movelya-logo.png`} alt="" /></span>
        <strong>MOVE<em>LYA</em></strong>
      </div>
      <div className="loading-line"><i /></div>
      <p>Preparando sua experiÃªncia</p>
    </div>
  )
}

export function ErrorPage({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="system-screen">
      <div className="system-card">
        <span className="system-card__icon error"><TriangleAlert size={27} /></span>
        <small>ALGO NÃƒO SAIU COMO ESPERADO</small>
        <h1>NÃ£o foi possÃ­vel carregar esta pÃ¡gina.</h1>
        <p>Tente novamente. Se o problema continuar, volte em alguns instantes.</p>
        <button className="vita-primary-button" onClick={onRetry}><RefreshCw size={17} /> Tentar novamente</button>
      </div>
    </div>
  )
}

export function NotFoundPage({ onNavigate }: { onNavigate: () => void }) {
  return (
    <div className="not-found">
      <div className="not-found__number">404</div>
      <div>
        <small>ROTA NÃƒO ENCONTRADA</small>
        <h1>Essa pÃ¡gina saiu para treinar.</h1>
        <p>O endereÃ§o acessado nÃ£o existe ou foi movido para outro lugar.</p>
        <button className="vita-primary-button" onClick={onNavigate}><ArrowLeft size={17} /> Voltar ao inÃ­cio</button>
      </div>
    </div>
  )
}

export function RoutePlaceholder({ route, onNavigate }: { route: VitaRoute; onNavigate: (path: string) => void }) {
  const Icon = route.icon
  const isLogout = route.id === 'sair'
  return (
    <section className="placeholder-page" key={route.id}>
      <div className="placeholder-hero">
        <div>
          <span className="page-eyebrow">{route.eyebrow}</span>
          <h1>{route.label}</h1>
          <p>{route.description}</p>
        </div>
        <div className="page-icon"><Icon size={31} /></div>
      </div>

      <div className="placeholder-grid">
        <article className="placeholder-card placeholder-card--primary">
          <div className="placeholder-card__icon"><Construction size={24} /></div>
          <small>ETAPA 1 Â· ESTRUTURA</small>
          <h2>{isLogout ? 'SaÃ­da ainda nÃ£o habilitada' : `${route.label} estÃ¡ ganhando forma`}</h2>
          <p>
            {isLogout
              ? 'A autenticaÃ§Ã£o e o encerramento de sessÃ£o serÃ£o conectados em uma prÃ³xima etapa.'
              : 'A estrutura visual e a navegaÃ§Ã£o jÃ¡ estÃ£o prontas. As funcionalidades desta Ã¡rea serÃ£o adicionadas nas prÃ³ximas etapas.'}
          </p>
          {isLogout && <button className="vita-secondary-button" onClick={() => onNavigate('/inicio')}>Permanecer no aplicativo</button>}
        </article>

        <article className="placeholder-card placeholder-card--detail">
          <div className="detail-orb"><Sparkles size={20} /></div>
          <div>
            <small>IDENTIDADE MOVELYA</small>
            <h3>Simples, focado e consistente.</h3>
            <p>Uma base mobile-first criada para evoluir sem perder clareza ou usabilidade.</p>
          </div>
        </article>
      </div>

      <div className="next-stage">
        <span><Dumbbell size={18} /></span>
        <div><small>PRÃ“XIMAS ETAPAS</small><strong>ConteÃºdo e funcionalidades internas</strong></div>
        <ArrowRight size={19} />
      </div>
    </section>
  )
}

