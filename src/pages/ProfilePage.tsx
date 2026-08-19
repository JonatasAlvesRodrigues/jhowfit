import { FormEvent, useEffect, useState } from 'react'
import { Bell, ChevronRight, CircleAlert, CircleHelp, Crown, Download, FileText, Goal, LoaderCircle, LockKeyhole, LogOut, Mail, Settings2, ShieldCheck, Sparkles, UserRound, X } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../integrations/supabase'
import { privacyService } from '../services/privacyService'
import { subscriptionService, type PlanOverview } from '../services/subscriptionService'

type ProfileAction = { icon: typeof UserRound; title: string; description: string }

const accountActions: ProfileAction[] = [
  { icon: UserRound, title: 'Dados pessoais', description: 'Nome, e-mail e informações de saúde' },
  { icon: Goal, title: 'Objetivos e rotina', description: 'Metas, nível e preferências de treino' },
  { icon: Bell, title: 'Lembretes', description: 'Água, treinos e resumo semanal' },
  { icon: LockKeyhole, title: 'Privacidade e dados', description: 'Permissões, exportação e segurança' },
]

export function ProfilePage({ userId, onLogout, onNavigate }: { userId: string; onLogout: () => void; onNavigate: (path: string) => void }) {
  const { user } = useAuth()
  const [notice, setNotice] = useState('')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [plan, setPlan] = useState<PlanOverview | null>(null)
  const [planError, setPlanError] = useState('')
  const name = String(user?.user_metadata?.full_name || 'Usuário MOVELYA')
  const [fullName, setFullName] = useState(name)
  const initials = name.split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase()
  const memberSince = user?.created_at
    ? new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date(user.created_at))
    : 'agosto de 2026'

  useEffect(() => {
    void subscriptionService.getOverview().then(setPlan).catch(() => setPlanError('Não foi possível carregar sua assinatura agora.'))
  }, [])

  const showNotice = (message: string) => {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 3500)
  }

  async function savePersonalData(event: FormEvent) {
    event.preventDefault()
    const cleanName = fullName.trim()
    if (cleanName.length < 2) return showNotice('Informe seu nome completo para salvar.')
    if (!supabase) return showNotice('A conexão com sua conta ainda não está disponível.')
    setSaving(true)
    try {
      const authResult = await supabase.auth.updateUser({ data: { full_name: cleanName } })
      if (authResult?.error) throw authResult.error
      const profileResult = await supabase.from('profiles').upsert({ id: userId, full_name: cleanName, updated_at: new Date().toISOString() }, { onConflict: 'id' })
      if (profileResult?.error) throw profileResult.error
      setEditing(false)
      showNotice('Dados pessoais atualizados.')
    } catch (error) {
      showNotice(error instanceof Error ? error.message : 'Não foi possível salvar seus dados agora.')
    } finally { setSaving(false) }
  }

  async function downloadData() {
    try {
      const payload = await privacyService.exportData(userId)
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = window.document.createElement('a')
      link.href = url
      link.download = `movelya-dados-${new Date().toISOString().slice(0, 10)}.json`
      link.click()
      URL.revokeObjectURL(url)
      showNotice('Seu arquivo está sendo baixado.')
    } catch (error) { showNotice(error instanceof Error ? error.message : 'Não foi possível preparar o download.') }
  }

  return (
    <section className="profile-page profile-hub">
      <header className="profile-hub__hero">
        <div className="profile-hub__identity">
          <div className="profile-account-avatar">{initials}</div>
          <div><span className="page-eyebrow">SUA CONTA</span><h1>{name}</h1><p><Mail size={14} /> {user?.email || 'email@movelya.com'}</p></div>
        </div>
        <span className="profile-confirmed"><ShieldCheck size={15} /> Conta verificada</span>
      </header>

      {notice && <div className="profile-notice" role="status">{notice}</div>}

      <div className="profile-hub__grid">
        <div className="profile-hub__main">
          <section className="profile-plan-card">
            {plan ? <CurrentPlanCard plan={plan} onNavigate={onNavigate} /> : planError ? <div className="profile-plan-card__unavailable"><CircleAlert size={20} /><div><strong>Assinatura indisponível</strong><span>{planError}</span></div><button onClick={() => onNavigate('/planos')}>Ver planos <ChevronRight size={16} /></button></div> : <div className="profile-plan-card__loading"><LoaderCircle className="is-spinning" size={21} /> Carregando seu plano...</div>}
            <div className="profile-plan-card__top"><div className="profile-plan-card__symbol"><Crown size={20} /></div><span>SEU PLANO</span></div>
            <div className="profile-plan-card__content">
              <div><h2>MOVELYA Plus</h2><p>Planos inteligentes, acompanhamento e recomendações personalizadas para sua rotina.</p></div>
              <button className="profile-plan-card__button" onClick={() => onNavigate('/planos')}>Gerenciar assinatura <ChevronRight size={17} /></button>
            </div>
            <div className="profile-plan-card__footer"><span><Sparkles size={15} /> Período de teste ativo</span><small>Renovação em 17 de setembro</small></div>
          </section>

          <section className="profile-section">
            <div className="profile-section__heading"><div><span className="page-eyebrow">PREFERÊNCIAS</span><h2>Sua experiência</h2></div><Settings2 size={19} /></div>
            <div className="profile-action-list">
              {accountActions.map(({ icon: Icon, title, description }, index) => (
                <button key={title} className="profile-action" onClick={() => index === 0 ? setEditing(true) : onNavigate(index === 1 ? '/metas' : index === 2 ? '/notificacoes' : '/privacidade')}>
                  <span className="profile-action__icon"><Icon size={18} /></span><span><strong>{title}</strong><small>{description}</small></span><ChevronRight size={18} />
                </button>
              ))}
            </div>
          </section>
        </div>

        <aside className="profile-hub__aside">
          <section className="profile-summary-card">
            <span className="page-eyebrow">SUA JORNADA</span><h2>Seu ritmo importa.</h2>
            <div className="profile-summary-card__stats"><div><strong>0</strong><small>treinos</small></div><div><strong>0</strong><small>dias ativos</small></div><div><strong>0</strong><small>conquistas</small></div></div>
            <p>Membro desde {memberSince}.</p>
          </section>
          <section className="profile-support-card">
            <div className="profile-support-card__title"><CircleHelp size={18} /><h2>Precisa de ajuda?</h2></div>
            <button onClick={() => window.location.assign('mailto:suporte@movelya.com.br?subject=Ajuda%20com%20o%20MOVELYA')}><FileText size={16} /> Falar com o suporte <ChevronRight size={16} /></button>
            <button onClick={() => void downloadData()}><Download size={16} /> Baixar meus dados <ChevronRight size={16} /></button>
          </section>
          <button className="profile-logout-button" onClick={onLogout}><LogOut size={18} /><span><strong>Sair da conta</strong><small>Encerra a sessão neste dispositivo</small></span></button>
        </aside>
      </div>
      {editing && <div className="profile-modal-backdrop" onMouseDown={() => setEditing(false)}>
        <form className="profile-edit-modal" onSubmit={savePersonalData} onMouseDown={(event) => event.stopPropagation()}>
          <button type="button" className="profile-edit-modal__close" onClick={() => setEditing(false)} aria-label="Fechar"><X size={18} /></button>
          <span className="page-eyebrow">DADOS PESSOAIS</span><h2>Como podemos chamar você?</h2><p>Seu nome aparece nos resumos e recomendações do MOVELYA.</p>
          <label>Nome completo<input value={fullName} onChange={(event) => setFullName(event.target.value)} autoFocus autoComplete="name" /></label>
          <label>E-mail<input value={user?.email || ''} disabled /></label>
          <div className="profile-edit-modal__actions"><button type="button" onClick={() => setEditing(false)}>Cancelar</button><button type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Salvar alterações'}</button></div>
        </form>
      </div>}
    </section>
  )
}

function CurrentPlanCard({ plan, onNavigate }: { plan: PlanOverview; onNavigate: (path: string) => void }) {
  const isFree = plan.code === 'FREE'
  const status = isFree ? 'Plano gratuito ativo' : plan.cancel_at_period_end ? 'Cancelamento agendado' : 'Assinatura ativa'
  const renewal = isFree ? 'Você pode fazer upgrade quando quiser' : `Renovação em ${formatPlanDate(plan.renews_at)}`
  return <div className={`profile-plan-card__loaded is-${plan.code.toLowerCase()}`}>
    <div className="profile-plan-card__top"><div className="profile-plan-card__symbol"><Crown size={20} /></div><span>SEU PLANO ATUAL</span></div>
    <div className="profile-plan-card__content"><div><h2>MOVELYA {plan.name}</h2><p>{plan.description}</p></div><button className="profile-plan-card__button" onClick={() => onNavigate('/planos')}>{isFree ? 'Conhecer planos' : 'Gerenciar assinatura'} <ChevronRight size={17} /></button></div>
    <div className="profile-plan-card__footer"><span><Sparkles size={15} /> {status}</span><small>{renewal}</small></div>
  </div>
}

function formatPlanDate(value: string) { return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long' }).format(new Date(value)) }
