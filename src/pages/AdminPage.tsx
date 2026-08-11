import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { AlertTriangle, BarChart3, Bell, Database, ShieldCheck, Users, Utensils, Dumbbell, Crown, CreditCard, Save } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { adminService, type AdminPlanLimit, type AdminSubscription, type AdminSubscriptionSummary, type AdminSummary, type AdminUser } from '../services/adminService'
import '../admin.css'

export function AdminPage() {
  const { user, role } = useAuth()
  const [summary, setSummary] = useState<AdminSummary | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [subscriptionSummary, setSubscriptionSummary] = useState<AdminSubscriptionSummary | null>(null)
  const [subscriptions, setSubscriptions] = useState<AdminSubscription[]>([])
  const [planLimits, setPlanLimits] = useState<AdminPlanLimit[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [audience, setAudience] = useState('all')
  const [toast, setToast] = useState('')
  const [syncingExercises, setSyncingExercises] = useState(false)

  async function load() {
    setLoading(true); setError('')
    try {
      const [nextSummary, nextUsers] = await Promise.all([adminService.summary(), adminService.users()])
      setSummary(nextSummary); setUsers(nextUsers)
      if (role === 'admin') {
        const [nextSubscriptionSummary, nextSubscriptions, nextLimits] = await Promise.all([adminService.subscriptionSummary(), adminService.subscriptions(), adminService.planLimits()])
        setSubscriptionSummary(nextSubscriptionSummary); setSubscriptions(nextSubscriptions); setPlanLimits(nextLimits)
      }
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Acesso administrativo não autorizado.') }
    finally { setLoading(false) }
  }
  useEffect(() => { if (role !== 'user') void load() }, [role])

  async function toggleSuspension(item: AdminUser) {
    try { await adminService.setSuspension(item.user_id, item.account_status === 'active'); setUsers((current) => current.map((userItem) => userItem.user_id === item.user_id ? { ...userItem, account_status: item.account_status === 'active' ? 'suspended' : 'active' } : userItem)); setToast('Status da conta atualizado.') }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível atualizar a conta.') }
  }
  async function createBroadcast(event: FormEvent) {
    event.preventDefault()
    try { await adminService.createBroadcast(title, body, audience); setTitle(''); setBody(''); setToast('Notificação salva como rascunho.'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível salvar a notificação.') }
  }
  async function syncExercises() {
    setSyncingExercises(true); setError('')
    try { const count = await adminService.syncExercises('', 100); setToast(`${count} exercícios sincronizados com a biblioteca local.`); await load() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível sincronizar os exercícios.') }
    finally { setSyncingExercises(false) }
  }

  if (role === 'user') return <section className="admin-page"><div className="admin-error"><ShieldCheck size={16} /> Esta área é restrita a moderadores e administradores.</div></section>
  return <section className="admin-page">
    <div className="admin-hero"><div><span className="page-eyebrow">CONTROLE OPERACIONAL</span><h1>Painel administrativo</h1><p>Visão agregada do produto, sem acesso a fotos privadas, conversas ou detalhes de saúde.</p></div><span className="admin-role">{role === 'admin' ? 'Administrador' : 'Moderador'}</span></div>
    {error && <div className="admin-error"><AlertTriangle size={16} /> {error}</div>}
    {toast && <div className="admin-callout"><ShieldCheck size={16} /> {toast}</div>}
    {loading ? <div className="admin-panel">Carregando indicadores protegidos…</div> : summary && <>
      <div className="admin-grid">
        <Stat icon={<Users size={17} color="var(--vita-green)" />} label="Usuários" value={summary.users} detail={`${summary.active_users} ativos nos últimos 30 dias`} />
        <Stat icon={<Dumbbell size={17} color="var(--vita-green)" />} label="Exercícios" value={summary.exercises} detail="Biblioteca oficial" />
        <Stat icon={<Utensils size={17} color="var(--vita-green)" />} label="Alimentos" value={summary.foods} detail="Itens públicos" />
        <Stat icon={<AlertTriangle size={17} color="var(--vita-green)" />} label="Sinalizações" value={summary.flags_open} detail="Aguardando moderação" />
      </div>
      {role === 'admin' && subscriptionSummary && <AdminSubscriptions summary={subscriptionSummary} subscriptions={subscriptions} limits={planLimits} onChanged={() => void load()} onError={setError} onToast={setToast} />}
      <div className="admin-layout"><div className="admin-panel card"><h2>Contas e permissões</h2><p>Somente identificadores mínimos, status e função. Senhas, e-mails, fotos, mensagens e dados clínicos ficam fora desta consulta.</p><table className="admin-table"><thead><tr><th>Usuário</th><th>Função</th><th>Status</th><th /></tr></thead><tbody>{users.map((item) => <tr key={item.user_id}><td>{item.full_name || 'Sem nome'}<br /><small>{item.user_id.slice(0, 8)}…</small></td><td>{item.role}</td><td className={`admin-status ${item.account_status === 'suspended' ? 'is-suspended' : ''}`}>{item.account_status === 'active' ? 'Ativa' : 'Suspensa'}</td><td>{role === 'admin' && item.user_id !== user?.id && <button onClick={() => void toggleSuspension(item)}>{item.account_status === 'active' ? 'Suspender' : 'Reativar'}</button>}</td></tr>)}</tbody></table></div>
        <div className="admin-panel card"><h2>Notificação geral</h2><p>Crie um rascunho para comunicação operacional. O envio em massa deve passar por revisão antes da publicação.</p><form className="admin-form" onSubmit={(event) => void createBroadcast(event)}><label>Título<input required maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} /></label><label>Mensagem<textarea required maxLength={1000} value={body} onChange={(event) => setBody(event.target.value)} /></label><label>Público<select value={audience} onChange={(event) => setAudience(event.target.value)}><option value="all">Todos</option><option value="active">Usuários ativos</option><option value="moderators">Moderadores</option></select></label>{role === 'admin' && <button type="submit"><Bell size={14} /> Salvar rascunho</button>}</form></div></div>
      <div className="admin-layout"><div className="admin-panel card"><h2>Saúde do sistema</h2><p><BarChart3 size={15} /> {summary.feature_events_30d} eventos de funcionalidade e {summary.audit_events_30d} ações auditadas nos últimos 30 dias.</p><p><Database size={15} /> Exercícios, alimentos e conquistas são administrados por operações protegidas no banco.</p><button className="admin-sync-button" onClick={() => void syncExercises()} disabled={syncingExercises}><Dumbbell size={15} /> {syncingExercises ? 'Sincronizando...' : 'Sincronizar exercícios'}</button></div><div className="admin-callout"><ShieldCheck size={18} /><span><strong>Limite de privacidade</strong><br />O painel não consulta armazenamento de fotos, conversas da IA, medidas, peso ou refeições individuais. Sinalizações usam apenas tipo, motivo e status.</span></div></div>
    </>}
  </section>
}

const limitLabels: Record<string, string> = { chat_message: 'Mensagens IA', workout_adjustment: 'Ajustes de treino', workout_generation: 'Treinos por IA', food_photo_analysis: 'Fotos de refeição', diet_generation: 'Planos alimentares', smart_report: 'Relatórios inteligentes', full_replanning: 'Replanejamentos' }

function AdminSubscriptions({ summary, subscriptions, limits, onChanged, onError, onToast }: { summary: AdminSubscriptionSummary; subscriptions: AdminSubscription[]; limits: AdminPlanLimit[]; onChanged: () => void; onError: (message: string) => void; onToast: (message: string) => void }) {
  const [selectedPlan, setSelectedPlan] = useState<'FREE' | 'PRO' | 'PRO_PLUS'>('PRO')
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>(() => Object.fromEntries(summary.plans.map((plan) => [plan.code, String(plan.price_monthly_cents / 100).replace('.', ',')])))
  const [limitDrafts, setLimitDrafts] = useState<Record<string, string>>(() => Object.fromEntries(limits.map((item) => [`${item.plan_code}:${item.action_type}`, String(item.monthly_limit)])))
  const [busy, setBusy] = useState('')
  const visibleLimits = limits.filter((item) => item.plan_code === selectedPlan)

  async function savePrice(code: 'FREE' | 'PRO' | 'PRO_PLUS') {
    const cents = Math.round(Number((priceDrafts[code] || '').replace(',', '.')) * 100)
    if (!Number.isInteger(cents) || cents < 0) return onError('Informe um valor mensal válido.')
    setBusy(`price:${code}`); onError('')
    try { await adminService.updateSubscriptionPlan(code, cents); onToast(`Valor do plano ${code.replace('_', ' ')} atualizado.`); onChanged() }
    catch { onError('Não foi possível atualizar o valor do plano.') }
    finally { setBusy('') }
  }
  async function saveLimit(item: AdminPlanLimit) {
    const key = `${item.plan_code}:${item.action_type}`, value = Number(limitDrafts[key])
    if (!Number.isInteger(value) || value < 0) return onError('O limite precisa ser um número inteiro igual ou maior que zero.')
    setBusy(`limit:${key}`); onError('')
    try { await adminService.updatePlanActionLimit(item.plan_code, item.action_type, value); onToast('Limite mensal atualizado.'); onChanged() }
    catch { onError('Não foi possível atualizar o limite.') }
    finally { setBusy('') }
  }
  async function assign(userId: string, planCode: 'FREE' | 'PRO' | 'PRO_PLUS') {
    setBusy(`user:${userId}`); onError('')
    try { await adminService.assignSubscription(userId, planCode); onToast(`Assinatura ${planCode.replace('_', ' ')} atribuída.`); onChanged() }
    catch { onError('Não foi possível atualizar a assinatura.') }
    finally { setBusy('') }
  }

  return <section className="admin-billing">
    <div className="admin-billing__heading"><div><span className="page-eyebrow">ASSINATURAS</span><h2>Planos e receita</h2><p>Controles internos protegidos por papel administrativo e registrados em auditoria.</p></div><Crown /></div>
    <div className="admin-grid admin-grid--billing">
      <Stat icon={<CreditCard size={17} color="var(--vita-green)" />} label="Assinaturas ativas" value={summary.active_total} detail="Ciclos vigentes" />
      <Stat icon={<BarChart3 size={17} color="var(--vita-green)" />} label="Receita mensal" value={money(summary.monthly_revenue_cents)} detail="Assinaturas internas ativas" />
      <Stat icon={<AlertTriangle size={17} color="var(--vita-green)" />} label="Canceladas" value={summary.cancelled_30d} detail="Nos últimos 30 dias" />
      <Stat icon={<CreditCard size={17} color="var(--vita-green)" />} label="Pagamentos pendentes" value={summary.pending_payments} detail="Integração futura" />
    </div>
    <div className="admin-billing__plans">{summary.plans.map((plan) => <article key={plan.code}><div><strong>{plan.name}</strong><small>{plan.active_subscriptions} assinatura(s) ativa(s)</small></div><label>Valor mensal (R$)<input value={priceDrafts[plan.code] ?? ''} onChange={(event) => setPriceDrafts((current) => ({ ...current, [plan.code]: event.target.value }))} inputMode="decimal" disabled={plan.code === 'FREE'} /></label><button onClick={() => void savePrice(plan.code)} disabled={plan.code === 'FREE' || busy === `price:${plan.code}`}><Save size={13} /> {busy === `price:${plan.code}` ? 'Salvando...' : 'Salvar valor'}</button></article>)}</div>
    <div className="admin-billing__layout"><div className="admin-panel card"><div className="admin-billing__subhead"><div><h3>Limites de recursos</h3><p>Esses valores definem cotas mensais. O usuário nunca vê créditos internos.</p></div><select value={selectedPlan} onChange={(event) => setSelectedPlan(event.target.value as typeof selectedPlan)}><option value="FREE">Free</option><option value="PRO">Pro</option><option value="PRO_PLUS">Pro Plus</option></select></div><div className="admin-limits">{visibleLimits.map((item) => { const key = `${item.plan_code}:${item.action_type}`; return <div key={key}><span>{limitLabels[item.action_type] ?? item.action_type}</span><input type="number" min="0" value={limitDrafts[key] ?? item.monthly_limit} onChange={(event) => setLimitDrafts((current) => ({ ...current, [key]: event.target.value }))} /><button onClick={() => void saveLimit(item)} disabled={busy === `limit:${key}`}>Salvar</button></div> })}</div></div>
      <div className="admin-panel card"><h3>Assinaturas recentes</h3><p>Alterações manuais servem para suporte e testes. Cobranças reais serão atualizadas pelo gateway de pagamento.</p><div className="admin-subscription-list">{subscriptions.slice(0, 8).map((item) => <article key={item.user_id}><div><strong>{item.full_name || 'Sem nome'}</strong><small>{item.plan_code.replace('_', ' ')} · até {new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(new Date(item.current_period_end))}</small></div><select value={item.plan_code} onChange={(event) => void assign(item.user_id, event.target.value as 'FREE' | 'PRO' | 'PRO_PLUS')} disabled={busy === `user:${item.user_id}`}><option value="FREE">Free</option><option value="PRO">Pro</option><option value="PRO_PLUS">Pro Plus</option></select></article>)}</div></div></div>
  </section>
}

function money(cents: number) { return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }

function Stat({ icon, label, value, detail }: { icon: ReactNode; label: string; value: ReactNode; detail: string }) {
  return <div className="admin-stat card">{icon}<small>{label}</small><strong>{value}</strong><span>{detail}</span></div>
}
