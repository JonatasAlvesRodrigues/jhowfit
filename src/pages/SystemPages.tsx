import { ArrowLeft, ArrowRight, Construction, Dumbbell, RefreshCw, Sparkles, TriangleAlert } from 'lucide-react'
import type { VitaRoute } from '../types/navigation'

export function LoadingScreen() {
  return (
    <div className="system-screen loading-screen" role="status" aria-label="Carregando VitaFit">
      <div className="loading-brand">
        <span>V</span>
        <strong>Vita<em>Fit</em></strong>
      </div>
      <div className="loading-line"><i /></div>
      <p>Preparando sua experiência</p>
    </div>
  )
}

export function ErrorPage({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="system-screen">
      <div className="system-card">
        <span className="system-card__icon error"><TriangleAlert size={27} /></span>
        <small>ALGO NÃO SAIU COMO ESPERADO</small>
        <h1>Não foi possível carregar esta página.</h1>
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
        <small>ROTA NÃO ENCONTRADA</small>
        <h1>Essa página saiu para treinar.</h1>
        <p>O endereço acessado não existe ou foi movido para outro lugar.</p>
        <button className="vita-primary-button" onClick={onNavigate}><ArrowLeft size={17} /> Voltar ao início</button>
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
          <small>ETAPA 1 · ESTRUTURA</small>
          <h2>{isLogout ? 'Saída ainda não habilitada' : `${route.label} está ganhando forma`}</h2>
          <p>
            {isLogout
              ? 'A autenticação e o encerramento de sessão serão conectados em uma próxima etapa.'
              : 'A estrutura visual e a navegação já estão prontas. As funcionalidades desta área serão adicionadas nas próximas etapas.'}
          </p>
          {isLogout && <button className="vita-secondary-button" onClick={() => onNavigate('/inicio')}>Permanecer no aplicativo</button>}
        </article>

        <article className="placeholder-card placeholder-card--detail">
          <div className="detail-orb"><Sparkles size={20} /></div>
          <div>
            <small>IDENTIDADE VITAFIT</small>
            <h3>Simples, focado e consistente.</h3>
            <p>Uma base mobile-first criada para evoluir sem perder clareza ou usabilidade.</p>
          </div>
        </article>
      </div>

      <div className="next-stage">
        <span><Dumbbell size={18} /></span>
        <div><small>PRÓXIMAS ETAPAS</small><strong>Conteúdo e funcionalidades internas</strong></div>
        <ArrowRight size={19} />
      </div>
    </section>
  )
}
