import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { AlertTriangle, BarChart3, Bell, Database, ShieldCheck, Users, Utensils, Dumbbell } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { adminService, type AdminSummary, type AdminUser } from '../services/adminService'
import '../admin.css'

export function AdminPage() {
  const { user, role } = useAuth()
  const [summary, setSummary] = useState<AdminSummary | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [audience, setAudience] = useState('all')
  const [toast, setToast] = useState('')

  async function load() {
    setLoading(true); setError('')
    try { const [nextSummary, nextUsers] = await Promise.all([adminService.summary(), adminService.users()]); setSummary(nextSummary); setUsers(nextUsers) }
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
      <div className="admin-layout"><div className="admin-panel card"><h2>Contas e permissões</h2><p>Somente identificadores mínimos, status e função. Senhas, e-mails, fotos, mensagens e dados clínicos ficam fora desta consulta.</p><table className="admin-table"><thead><tr><th>Usuário</th><th>Função</th><th>Status</th><th /></tr></thead><tbody>{users.map((item) => <tr key={item.user_id}><td>{item.full_name || 'Sem nome'}<br /><small>{item.user_id.slice(0, 8)}…</small></td><td>{item.role}</td><td className={`admin-status ${item.account_status === 'suspended' ? 'is-suspended' : ''}`}>{item.account_status === 'active' ? 'Ativa' : 'Suspensa'}</td><td>{role === 'admin' && item.user_id !== user?.id && <button onClick={() => void toggleSuspension(item)}>{item.account_status === 'active' ? 'Suspender' : 'Reativar'}</button>}</td></tr>)}</tbody></table></div>
        <div className="admin-panel card"><h2>Notificação geral</h2><p>Crie um rascunho para comunicação operacional. O envio em massa deve passar por revisão antes da publicação.</p><form className="admin-form" onSubmit={(event) => void createBroadcast(event)}><label>Título<input required maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} /></label><label>Mensagem<textarea required maxLength={1000} value={body} onChange={(event) => setBody(event.target.value)} /></label><label>Público<select value={audience} onChange={(event) => setAudience(event.target.value)}><option value="all">Todos</option><option value="active">Usuários ativos</option><option value="moderators">Moderadores</option></select></label>{role === 'admin' && <button type="submit"><Bell size={14} /> Salvar rascunho</button>}</form></div></div>
      <div className="admin-layout"><div className="admin-panel card"><h2>Saúde do sistema</h2><p><BarChart3 size={15} /> {summary.feature_events_30d} eventos de funcionalidade e {summary.audit_events_30d} ações auditadas nos últimos 30 dias.</p><p><Database size={15} /> Exercícios, alimentos e conquistas são administrados por operações protegidas no banco.</p></div><div className="admin-callout"><ShieldCheck size={18} /><span><strong>Limite de privacidade</strong><br />O painel não consulta armazenamento de fotos, conversas da IA, medidas, peso ou refeições individuais. Sinalizações usam apenas tipo, motivo e status.</span></div></div>
    </>}
  </section>
}

function Stat({ icon, label, value, detail }: { icon: ReactNode; label: string; value: number; detail: string }) {
  return <div className="admin-stat card">{icon}<small>{label}</small><strong>{value}</strong><span>{detail}</span></div>
}
