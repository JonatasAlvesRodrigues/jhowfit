import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, BarChart3, Bell, Database, ShieldCheck, Users, Utensils, Dumbbell, Crown, CreditCard, Save, BadgePercent, Pause, Archive, Play, Flag, Eye, X } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { adminService, type AdminAuditEvent, type AdminCancellationReason, type AdminCommunityReport, type AdminCommunityReportStatus, type AdminCommunityReportTarget, type AdminCoupon, type AdminCouponSummary, type AdminInternalAlert, type AdminPlanLimit, type AdminSubscription, type AdminSubscriptionSummary, type AdminSummary, type AdminUser } from '../services/adminService'
import '../admin.css'
import '../admin-coupons.css'
import '../admin-cancellations.css'

export function AdminPage() {
  const { user, role } = useAuth()
  const [summary, setSummary] = useState<AdminSummary | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [subscriptionSummary, setSubscriptionSummary] = useState<AdminSubscriptionSummary | null>(null)
  const [subscriptions, setSubscriptions] = useState<AdminSubscription[]>([])
  const [planLimits, setPlanLimits] = useState<AdminPlanLimit[]>([])
  const [couponSummary, setCouponSummary] = useState<AdminCouponSummary | null>(null)
  const [coupons, setCoupons] = useState<AdminCoupon[]>([])
  const [couponDays, setCouponDays] = useState(0)
  const [audit, setAudit] = useState<AdminAuditEvent[]>([])
  const [auditDays, setAuditDays] = useState(30)
  const [alerts, setAlerts] = useState<AdminInternalAlert[]>([])
  const [cancellationReasons, setCancellationReasons] = useState<AdminCancellationReason[]>([])
  const [cancellationDays, setCancellationDays] = useState(90)
  const [communityReports, setCommunityReports] = useState<AdminCommunityReport[]>([])
  const [reportStatus, setReportStatus] = useState<AdminCommunityReportStatus | 'all'>('open')
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
      const [nextSummary, nextUsers, nextReports] = await Promise.all([adminService.summary(), adminService.users(), adminService.communityReports(reportStatus)])
      setSummary(nextSummary); setUsers(nextUsers); setCommunityReports(nextReports)
      if (role === 'admin') {
        const [nextSubscriptionSummary, nextSubscriptions, nextLimits, nextCouponSummary, nextCoupons,nextAudit,nextAlerts,nextReasons] = await Promise.all([adminService.subscriptionSummary(), adminService.subscriptions(), adminService.planLimits(), adminService.couponSummary(couponDays), adminService.coupons(couponDays),adminService.auditHistory(auditDays),adminService.internalAlerts(),adminService.cancellationReasons(cancellationDays)])
        setSubscriptionSummary(nextSubscriptionSummary); setSubscriptions(nextSubscriptions); setPlanLimits(nextLimits); setCouponSummary(nextCouponSummary); setCoupons(nextCoupons);setAudit(nextAudit);setAlerts(nextAlerts);setCancellationReasons(nextReasons)
      }
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Acesso administrativo não autorizado.') }
    finally { setLoading(false) }
  }
  useEffect(() => { if (role !== 'user') void load() }, [role, couponDays,auditDays,cancellationDays,reportStatus])

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
  async function updateReport(reportId:string,status:Exclude<AdminCommunityReportStatus,'open'>) { setError(''); try { await adminService.updateCommunityReportStatus(reportId,status); setCommunityReports(current=>current.map(item=>item.id===reportId?{...item,status,reviewed_at:new Date().toISOString()}:item)); setToast(status==='reviewing'?'Denúncia marcada como em análise.':status==='resolved'?'Denúncia resolvida.':'Denúncia descartada.') } catch(cause) { setError(cause instanceof Error?cause.message:'Não foi possível atualizar a denúncia.') } }

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
      <AdminCommunityReports reports={communityReports} status={reportStatus} onStatusChange={setReportStatus} onUpdate={updateReport} />
      {role === 'admin' && subscriptionSummary && <AdminSubscriptions summary={subscriptionSummary} subscriptions={subscriptions} limits={planLimits} onChanged={() => void load()} onError={setError} onToast={setToast} />}
      {role === 'admin' && couponSummary && <AdminCoupons summary={couponSummary} coupons={coupons} days={couponDays} onDaysChange={setCouponDays} onChanged={() => void load()} onError={setError} onToast={setToast} />}
      {role === 'admin' && <section className="admin-panel card"><h2>Histórico administrativo</h2><select value={auditDays} onChange={e=>setAuditDays(Number(e.target.value))}><option value={7}>Últimos 7 dias</option><option value={30}>Últimos 30 dias</option><option value={90}>Últimos 90 dias</option><option value={0}>Todo histórico</option></select><button onClick={()=>downloadAudit(audit)}>Exportar CSV</button><div className="admin-subscription-list">{audit.slice(0,20).map(item=><article key={`${item.created_at}${item.action}`}><div><strong>{item.action.split('_').join(' ')}</strong><small>{new Date(item.created_at).toLocaleString('pt-BR')} · {item.actor_name||'Admin'}</small></div></article>)}</div></section>}
      {role === 'admin' && <section className="admin-panel card"><h2>Alertas internos</h2><p>Somente dados operacionais agregados.</p><div className="admin-subscription-list">{alerts.length ? alerts.map(item=><article key={item.id}><div><strong>{item.title}</strong><small>{item.severity.toUpperCase()} · {Object.entries(item.details).map(([key,value])=>`${key}: ${value}`).join(' · ')}</small></div></article>) : <p>Nenhum alerta operacional aberto.</p>}</div></section>}
      {role === 'admin' && <section className="admin-panel card"><div className="admin-billing__subhead"><div><h2>Motivos de cancelamento</h2><p>Ranking por plano, a partir dos motivos informados pelos assinantes.</p></div><select value={cancellationDays} onChange={e=>setCancellationDays(Number(e.target.value))}><option value={30}>30 dias</option><option value={90}>90 dias</option><option value={180}>6 meses</option><option value={0}>Todo histórico</option></select></div><div className="admin-cancellation-report">{(['PRO','PRO_PLUS'] as const).map(plan=><article key={plan}><h3>{plan === 'PRO' ? 'Movelya Pro' : 'Movelya Pro Plus'}</h3>{cancellationReasons.filter(item=>item.plan_code===plan).length?cancellationReasons.filter(item=>item.plan_code===plan).map(item=><div key={item.reason}><span>{cancellationReasonLabel(item.reason)}</span><strong>{item.cancellations} · {item.percentage}%</strong><i style={{width:`${item.percentage}%`}} /></div>):<p>Sem cancelamentos no período.</p>}</article>)}</div></section>}
      <div className="admin-layout"><div className="admin-panel card"><h2>Contas e permissões</h2><p>Somente identificadores mínimos, status e função. Senhas, e-mails, fotos, mensagens e dados clínicos ficam fora desta consulta.</p><table className="admin-table"><thead><tr><th>Usuário</th><th>Função</th><th>Status</th><th /></tr></thead><tbody>{users.map((item) => <tr key={item.user_id}><td>{item.full_name || 'Sem nome'}<br /><small>{item.user_id.slice(0, 8)}…</small></td><td>{item.role}</td><td className={`admin-status ${item.account_status === 'suspended' ? 'is-suspended' : ''}`}>{item.account_status === 'active' ? 'Ativa' : 'Suspensa'}</td><td>{role === 'admin' && item.user_id !== user?.id && <button onClick={() => void toggleSuspension(item)}>{item.account_status === 'active' ? 'Suspender' : 'Reativar'}</button>}</td></tr>)}</tbody></table></div>
        <div className="admin-panel card"><h2>Notificação geral</h2><p>Crie um rascunho para comunicação operacional. O envio em massa deve passar por revisão antes da publicação.</p><form className="admin-form" onSubmit={(event) => void createBroadcast(event)}><label>Título<input required maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} /></label><label>Mensagem<textarea required maxLength={1000} value={body} onChange={(event) => setBody(event.target.value)} /></label><label>Público<select value={audience} onChange={(event) => setAudience(event.target.value)}><option value="all">Todos</option><option value="active">Usuários ativos</option><option value="moderators">Moderadores</option></select></label>{role === 'admin' && <button type="submit"><Bell size={14} /> Salvar rascunho</button>}</form></div></div>
      <div className="admin-layout"><div className="admin-panel card"><h2>Saúde do sistema</h2><p><BarChart3 size={15} /> {summary.feature_events_30d} eventos de funcionalidade e {summary.audit_events_30d} ações auditadas nos últimos 30 dias.</p><p><Database size={15} /> Exercícios, alimentos e conquistas são administrados por operações protegidas no banco.</p><button className="admin-sync-button" onClick={() => void syncExercises()} disabled={syncingExercises}><Dumbbell size={15} /> {syncingExercises ? 'Sincronizando...' : 'Sincronizar exercícios'}</button></div><div className="admin-callout"><ShieldCheck size={18} /><span><strong>Limite de privacidade</strong><br />O painel não consulta armazenamento de fotos, conversas da IA, medidas, peso ou refeições individuais. Sinalizações usam apenas tipo, motivo e status.</span></div></div>
    </>}
  </section>
}

function AdminCommunityReports({ reports, status, onStatusChange, onUpdate }: { reports: AdminCommunityReport[]; status: AdminCommunityReportStatus | 'all'; onStatusChange: (status: AdminCommunityReportStatus | 'all') => void; onUpdate: (reportId:string,status:Exclude<AdminCommunityReportStatus,'open'>) => Promise<void> }) {
  const [busy, setBusy] = useState('')
  const [selected, setSelected] = useState<AdminCommunityReport | null>(null)
  const [target, setTarget] = useState<AdminCommunityReportTarget | null>(null)
  const [targetLoading, setTargetLoading] = useState(false)
  const [targetError, setTargetError] = useState('')
  async function act(reportId:string, nextStatus:Exclude<AdminCommunityReportStatus,'open'>) { setBusy(`${reportId}:${nextStatus}`); try { await onUpdate(reportId,nextStatus) } finally { setBusy('') } }
  async function openTarget(item:AdminCommunityReport) { setSelected(item); setTarget(null); setTargetError(''); setTargetLoading(true); try { setTarget(await adminService.communityReportTarget(item.id)) } catch { setTargetError('Não foi possível abrir este conteúdo. Ele pode já ter sido removido.') } finally { setTargetLoading(false) } }
  return <section className="admin-panel admin-reports card">
    <div className="admin-reports__head"><div><span className="page-eyebrow">MODERAÇÃO DA COMUNIDADE</span><h2><Flag size={15} /> Denúncias</h2><p>Fila manual de publicações, comentários e perfis. Nenhuma decisão é automática.</p></div><select aria-label="Filtrar denúncias" value={status} onChange={(event)=>onStatusChange(event.target.value as AdminCommunityReportStatus|'all')}><option value="open">Em aberto</option><option value="reviewing">Em análise</option><option value="resolved">Resolvidas</option><option value="dismissed">Descartadas</option><option value="all">Todas</option></select></div>
    <div className="admin-reports__list">{reports.length ? reports.map(item=><article key={item.id}>
      <div className="admin-reports__meta"><span className={`admin-report-type is-${item.target_type}`}>{reportTargetLabel(item.target_type)}</span><span className={`admin-report-status is-${item.status}`}>{reportStatusLabel(item.status)}</span><time>{new Date(item.created_at).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})}</time></div>
      <strong>{reportReasonLabel(item.reason)}</strong><p>Alvo: {item.target_name || 'Conteúdo removido ou perfil indisponível'}{item.reporter_name ? ` · Reportado por ${item.reporter_name}` : ''}</p>{item.details && <blockquote>{item.details}</blockquote>}
      <div className="admin-reports__actions"><button className="view" onClick={()=>void openTarget(item)}><Eye size={13} /> Ver conteúdo</button>{item.status==='open' && <button onClick={()=>void act(item.id,'reviewing')} disabled={Boolean(busy)}>{busy===`${item.id}:reviewing`?'Salvando...':'Analisar'}</button>}{item.status!=='resolved' && <button onClick={()=>void act(item.id,'resolved')} disabled={Boolean(busy)}>{busy===`${item.id}:resolved`?'Salvando...':'Resolver'}</button>}{item.status!=='dismissed' && <button className="danger" onClick={()=>void act(item.id,'dismissed')} disabled={Boolean(busy)}>{busy===`${item.id}:dismissed`?'Salvando...':'Descartar'}</button>}</div>
    </article>) : <p className="admin-reports__empty">Não há denúncias neste filtro.</p>}</div>
    {selected && <ReportTargetModal report={selected} target={target} loading={targetLoading} error={targetError} onClose={()=>setSelected(null)} />}
  </section>
}

function ReportTargetModal({ report, target, loading, error, onClose }: { report:AdminCommunityReport; target:AdminCommunityReportTarget|null; loading:boolean; error:string; onClose:()=>void }) {
  const content=<div className="admin-report-modal-backdrop" role="presentation" onMouseDown={(event)=>event.target===event.currentTarget&&onClose()}><section className="admin-report-modal" role="dialog" aria-modal="true" aria-label="Conteúdo denunciado"><header><div><span className="page-eyebrow">ANÁLISE DE DENÚNCIA</span><h2>{reportTargetLabel(report.target_type)} denunciado</h2></div><button onClick={onClose} aria-label="Fechar"><X size={18} /></button></header>{loading?<p className="admin-report-modal__state">Carregando conteúdo…</p>:error?<p className="admin-report-modal__state is-error">{error}</p>:target&&<div className="admin-report-modal__body"><div className="admin-report-modal__meta"><span>{target.author_name||'Membro MOVELYA'}</span>{target.created_at&&<time>{new Date(target.created_at).toLocaleString('pt-BR')}</time>}</div>{target.comment_content&&<div className="admin-report-modal__comment"><small>Comentário denunciado</small><p>{target.comment_content}</p></div>}{target.media_url&&<img src={target.media_url} alt="Imagem da publicação denunciada" />}{target.caption&&<div className="admin-report-modal__caption"><small>{target.post_type?reportPostTypeLabel(target.post_type):'Publicação'}</small><p>{target.caption}</p></div>}<div className="admin-report-modal__reason"><strong>Motivo: {reportReasonLabel(report.reason)}</strong>{report.details&&<p>{report.details}</p>}</div></div>}</section></div>
  return typeof document==='undefined'?content:createPortal(content,document.body)
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

function AdminCoupons({ summary, coupons, days, onDaysChange, onChanged, onError, onToast }: { summary: AdminCouponSummary; coupons: AdminCoupon[]; days: number; onDaysChange: (days: number) => void; onChanged: () => void; onError: (message: string) => void; onToast: (message: string) => void }) {
  const [code, setCode] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<'percent' | 'fixed_cents'>('percent')
  const [value, setValue] = useState('10')
  const [limit, setLimit] = useState('')
  const [plans, setPlans] = useState<Array<'PRO' | 'PRO_PLUS'>>(['PRO', 'PRO_PLUS'])
  const [busy, setBusy] = useState('')
  const togglePlan = (plan: 'PRO' | 'PRO_PLUS') => setPlans((current) => current.includes(plan) ? current.filter((item) => item !== plan) : [...current, plan])
  async function create() {
    const amount = type === 'percent' ? Number(value) : Math.round(Number(value.replace(',', '.')) * 100)
    const max = limit.trim() ? Number(limit) : null
    if (!code.trim() || !description.trim() || !Number.isInteger(amount) || amount < 1 || !plans.length || (max !== null && (!Number.isInteger(max) || max < 1))) return onError('Preencha código, descrição, desconto, planos e limite corretamente.')
    setBusy('create'); onError('')
    try { await adminService.createCoupon({ code: code.trim().toUpperCase(), description: description.trim(), discountType: type, discountValue: amount, appliesTo: plans, maxRedemptions: max }); setCode(''); setDescription(''); setValue('10'); setLimit(''); onToast('Cupom salvo e ativo.'); onChanged() }
    catch { onError('Não foi possível salvar o cupom.') } finally { setBusy('') }
  }
  async function action(item: AdminCoupon, next: 'activate' | 'pause' | 'archive') { if (next === 'archive' && !window.confirm(`Arquivar o cupom ${item.code}? O histórico será preservado.`)) return; setBusy(`${next}:${item.code}`); try { await adminService.setCouponStatus(item.code, next); onToast(next === 'archive' ? 'Cupom arquivado.' : next === 'pause' ? 'Cupom pausado.' : 'Cupom reativado.'); onChanged() } catch { onError('Não foi possível atualizar este cupom.') } finally { setBusy('') } }
  return <section className="admin-coupons"><div className="admin-coupons__head"><div><span className="page-eyebrow">CUPONS E PROMOÇÕES</span><h2>Descontos sob controle</h2><p>Acompanhe somente pagamentos confirmados no período selecionado.</p></div><label className="coupon-period">Período<select value={days} onChange={(event) => onDaysChange(Number(event.target.value))}><option value={30}>Últimos 30 dias</option><option value={90}>Últimos 90 dias</option><option value={0}>Todo o histórico</option></select></label></div>
    <div className="coupon-metrics"><div className="coupon-metric"><small>Cupons ativos</small><strong>{summary.active_coupons}</strong><span>Aceitando novos usos</span></div><div className="coupon-metric"><small>Usos confirmados</small><strong>{summary.redemptions_total}</strong><span>No período selecionado</span></div><div className="coupon-metric"><small>Desconto concedido</small><strong>{money(summary.discount_total_cents)}</strong><span>Economia dos clientes</span></div><div className="coupon-metric"><small>Receita com cupom</small><strong>{money(summary.net_revenue_cents)}</strong><span>Após os descontos</span></div></div>
    <div className="admin-coupon-layout"><div className="coupon-create"><h3>Criar cupom</h3><p>O desconto é aplicado apenas ao primeiro ciclo.</p><div className="admin-coupon-form"><input value={code} maxLength={32} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="CÓDIGO" /><input value={description} className="wide" maxLength={120} onChange={(event) => setDescription(event.target.value)} placeholder="Descrição para o cliente" /><select value={type} onChange={(event) => setType(event.target.value as typeof type)}><option value="percent">Percentual (%)</option><option value="fixed_cents">Valor fixo (R$)</option></select><input value={value} inputMode="decimal" onChange={(event) => setValue(event.target.value)} placeholder={type === 'percent' ? '10' : '5,00'} /><input value={limit} className="wide" inputMode="numeric" onChange={(event) => setLimit(event.target.value)} placeholder="Limite de usos (opcional)" /><div className="admin-coupon-plans"><label><input type="checkbox" checked={plans.includes('PRO')} onChange={() => togglePlan('PRO')} /> Pro</label><label><input type="checkbox" checked={plans.includes('PRO_PLUS')} onChange={() => togglePlan('PRO_PLUS')} /> Pro Plus</label></div><button onClick={() => void create()} disabled={busy === 'create'}><Save size={13} /> {busy === 'create' ? 'Salvando...' : 'Criar cupom'}</button></div></div>
      <div className="coupon-catalog"><h3>Cupons cadastrados</h3><p>Use, desconto e receita consideram o filtro selecionado.</p><div className="admin-coupon-list">{coupons.map((item) => <article key={item.code}><div><strong>{item.code}</strong><small>{item.description}</small><div className="coupon-tags"><span>{item.discount_type === 'percent' ? `${item.discount_value}% OFF` : `${money(item.discount_value)} OFF`}</span><span>{item.redemptions_count}{item.max_redemptions ? ` / ${item.max_redemptions}` : ''} usos</span><span className="muted">Desconto {money(item.discount_total_cents)}</span><span className="muted">Receita {money(item.net_revenue_cents)}</span></div></div><div className="admin-coupon-actions">{item.archived_at ? <button onClick={() => void action(item, 'activate')} disabled={busy === `activate:${item.code}`}><Play size={12} /> Reativar</button> : item.active ? <button onClick={() => void action(item, 'pause')} disabled={busy === `pause:${item.code}`}><Pause size={12} /> Pausar</button> : <button onClick={() => void action(item, 'activate')} disabled={busy === `activate:${item.code}`}><Play size={12} /> Ativar</button>}{!item.archived_at && <button className="danger" onClick={() => void action(item, 'archive')} disabled={busy === `archive:${item.code}`}><Archive size={12} /> Arquivar</button>}</div></article>)}</div></div></div>
  </section>
}

function money(cents: number) { return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
function reportTargetLabel(type:AdminCommunityReport['target_type']) { return ({post:'Publicação',comment:'Comentário',user:'Usuário'} as const)[type] }
function reportStatusLabel(status:AdminCommunityReportStatus) { return ({open:'Em aberto',reviewing:'Em análise',resolved:'Resolvida',dismissed:'Descartada'} as const)[status] }
function reportReasonLabel(reason:AdminCommunityReport['reason']) { return ({spam:'Spam',harassment:'Assédio',inappropriate_content:'Conteúdo inadequado',off_topic:'Fora do tema',other:'Outro'} as const)[reason] }
function reportPostTypeLabel(type:string) { return ({workout:'Treino',running:'Corrida',walking:'Caminhada',food:'Refeição',achievement:'Conquista',general_fitness:'Fitness'} as Record<string,string>)[type]||'Publicação' }
function cancellationReasonLabel(reason: string) { return ({too_expensive:'Está caro',not_using:'Não está usando',missing_features:'Faltam recursos',technical_issue:'Problema técnico',other:'Outro motivo',not_informed:'Não informado'} as Record<string,string>)[reason] || reason }
function downloadAudit(items: AdminAuditEvent[]) { const rows=items.map(i=>[i.created_at,i.action,i.actor_name||'',i.target_user_id||'',JSON.stringify(i.metadata)].map(x=>`"${String(x).split('"').join('""')}"`).join(',')); const csv=['Data,Ação,Administrador,Usuário alvo,Detalhes',...rows].join('\n'); const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})); const a=document.createElement('a');a.href=url;a.download='historico-administrativo.csv';a.click();URL.revokeObjectURL(url) }

function Stat({ icon, label, value, detail }: { icon: ReactNode; label: string; value: ReactNode; detail: string }) {
  return <div className="admin-stat card">{icon}<small>{label}</small><strong>{value}</strong><span>{detail}</span></div>
}
