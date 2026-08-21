import { useEffect, useMemo, useState } from 'react'
import { Activity, Apple, Check, ClipboardList, CloudDownload, Eye, FileText, KeyRound, Link2Off, LockKeyhole, LogOut, MessageSquareLock, RefreshCw, ShieldCheck, Trash2, UserRound, UsersRound, Utensils, Weight, X } from 'lucide-react'
import { Button, Card } from '../components/ui'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../integrations/supabase'
import { healthIntegrationService } from '../services/healthIntegrationService'
import '../privacy.css'
import { defaultPrivacyPermissions, privacyService, type ConsentType, type PrivacyCategory, type PrivacyPermissions } from '../services/privacyService'
import { communityService, defaultCommunityProfileSettings, type CommunityProfileSettings } from '../services/communityService'

const categories: Array<{ key: PrivacyCategory; title: string; description: string; icon: typeof UserRound; sensitive?: boolean }> = [
  { key: 'profile', title: 'Perfil', description: 'Nome, objetivo e informações básicas.', icon: UserRound },
  { key: 'nutrition', title: 'Alimentação', description: 'Refeições, nutrientes e registros alimentares.', icon: Utensils },
  { key: 'workouts', title: 'Treinos', description: 'Planos, sessões, cargas e histórico.', icon: Activity },
  { key: 'weight', title: 'Peso', description: 'Registros de peso corporal.', icon: Weight, sensitive: true },
  { key: 'measurements', title: 'Medidas', description: 'Circunferências e composição corporal.', icon: Eye, sensitive: true },
  { key: 'photos', title: 'Fotos', description: 'Fotos privadas de evolução corporal.', icon: LockKeyhole, sensitive: true },
  { key: 'activities', title: 'Atividades', description: 'Passos, água e atividades sincronizadas.', icon: RefreshCw },
]

const consentLabels: Record<ConsentType, string> = { privacy_policy: 'Política de privacidade', terms_of_use: 'Termos de uso', ai_data_processing: 'Uso de dados pela IA', health_integration: 'Integrações de saúde' }

export function PrivacyPage({ userId, onLogout }: { userId: string; onLogout: () => void }) {
  const { user, updatePassword } = useAuth()
  const [permissions, setPermissions] = useState<PrivacyPermissions>(defaultPrivacyPermissions)
  const [communitySettings, setCommunitySettings] = useState<CommunityProfileSettings>(defaultCommunityProfileSettings)
  const [consents, setConsents] = useState<Awaited<ReturnType<typeof privacyService.load>>['consents']>([])
  const [audits, setAudits] = useState<Awaited<ReturnType<typeof privacyService.load>>['audits']>([])
  const [session, setSession] = useState<{ createdAt: string | null; expiresAt: string | null } | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [documentView, setDocumentView] = useState<'privacy' | 'terms' | null>(null)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [deleteText, setDeleteText] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)

  async function load() {
    setLoading(true); setError('')
    try {
      const [data, socialSettings] = await Promise.all([privacyService.load(userId), communityService.loadMyProfileSettings(userId)])
      setPermissions(data.permissions); setConsents(data.consents); setAudits(data.audits)
      setCommunitySettings(socialSettings)
      const current = await supabase?.auth.getSession()
      const authSession = current?.data.session
      setSession({ createdAt: authSession?.user?.created_at ?? null, expiresAt: authSession?.expires_at ? new Date(authSession.expires_at * 1000).toISOString() : null })
    } catch (requestError) { setError(message(requestError)) }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [userId])
  useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(''), 4500); return () => window.clearTimeout(timer) }, [notice])

  const latestConsent = useMemo(() => new Map(consents.map((item) => [item.type, item])), [consents])
  const enabledCount = Object.values(permissions).filter(Boolean).length

  async function togglePermission(key: PrivacyCategory) {
    const next = { ...permissions, [key]: !permissions[key] }
    setPermissions(next); setBusy(true); setError('')
    try { await privacyService.savePermissions(userId, next); setNotice('Preferência da IA atualizada.'); await load() }
    catch (requestError) { setPermissions(permissions); setError(message(requestError)) }
    finally { setBusy(false) }
  }

  async function saveCommunitySettings(next: CommunityProfileSettings) {
    const previous = communitySettings
    setCommunitySettings(next); setBusy(true); setError('')
    try { await communityService.saveMyProfileSettings(userId, next); setNotice('Preferências da Comunidade atualizadas.') }
    catch (requestError) { setCommunitySettings(previous); setError(message(requestError)) }
    finally { setBusy(false) }
  }

  async function toggleConsent(type: ConsentType, granted: boolean) {
    setBusy(true); setError('')
    try { await privacyService.saveConsent(userId, type, granted); setNotice(granted ? 'Consentimento registrado.' : 'Consentimento revogado.'); await load() }
    catch (requestError) { setError(message(requestError)) }
    finally { setBusy(false) }
  }

  async function exportData() {
    setBusy(true); setError('')
    try { const payload = await privacyService.exportData(userId); const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const link = window.document.createElement('a'); link.href = url; link.download = `movelya-dados-${new Date().toISOString().slice(0, 10)}.json`; link.click(); URL.revokeObjectURL(url); setNotice('Exportação preparada no seu dispositivo.'); await load() }
    catch (requestError) { setError(message(requestError)) }
    finally { setBusy(false) }
  }

  async function disconnectIntegrations() {
    if (!window.confirm('Desconectar integrações de saúde? Os registros já importados serão mantidos.')) return
    setBusy(true); setError('')
    try { await Promise.all([healthIntegrationService.disconnect(userId, 'apple_health'), healthIntegrationService.disconnect(userId, 'health_connect')]); await privacyService.log('health_integrations_disconnected'); setNotice('Integrações desconectadas.'); await load() }
    catch (requestError) { setError(message(requestError)) }
    finally { setBusy(false) }
  }

  async function changePassword(event: React.FormEvent) {
    event.preventDefault(); setError('')
    if (password.length < 8) { setError('Use uma senha com pelo menos 8 caracteres.'); return }
    if (password !== confirmPassword) { setError('As senhas não coincidem.'); return }
    setBusy(true)
    try { const result = await updatePassword(password); if (!result.success) throw new Error(result.message); await privacyService.log('password_changed'); setPassword(''); setConfirmPassword(''); setNotice('Senha alterada com segurança.') }
    catch (requestError) { setError(message(requestError)) }
    finally { setBusy(false) }
  }

  async function signOutOthers() {
    if (!supabase) return
    setBusy(true); setError('')
    try { const { error: signOutError } = await supabase.auth.signOut({ scope: 'others' }); if (signOutError) throw signOutError; await privacyService.log('other_sessions_revoked'); setNotice('As outras sessões foram encerradas.') }
    catch (requestError) { setError(message(requestError)) }
    finally { setBusy(false) }
  }

  async function deleteAccount() {
    if (deleteText !== 'EXCLUIR MINHA CONTA') return
    setBusy(true); setError('')
    try { await privacyService.deleteAccount(); await supabase?.auth.signOut({ scope: 'local' }); onLogout() }
    catch (requestError) { setError(message(requestError)); setBusy(false) }
  }

  if (loading) return <div className="privacy-loading"><span /><span /><span /></div>

  return <section className="privacy-page">
    <header className="privacy-hero"><div><span className="page-eyebrow">DADOS E SEGURANÇA</span><h1>Privacidade sob seu controle.</h1><p>Escolha o que o MOVELYA pode acessar, consulte seus consentimentos e tenha caminhos claros para exportar ou excluir seus dados.</p></div><div className="privacy-hero__badge"><ShieldCheck size={27} /><strong>Proteção ativa</strong><small>RLS · bucket privado · auditoria</small></div></header>
    {error && <div className="privacy-alert is-error"><X size={16} />{error}</div>}{notice && <div className="privacy-alert is-success"><Check size={16} />{notice}</div>}

    <section className="privacy-summary"><article><ShieldCheck size={18} /><div><strong>Conta protegida</strong><small>Dados separados por usuário</small></div></article><article><MessageSquareLock size={18} /><div><strong>{enabledCount} de 7</strong><small>categorias liberadas para a IA</small></div></article><article><ClipboardList size={18} /><div><strong>{audits.length}</strong><small>ações recentes registradas</small></div></article></section>

    <Card className="privacy-card privacy-ai-card"><div className="privacy-card-heading"><div><small>CONTROLE DA IA</small><h2>Você escolhe o que pode ser usado</h2><p>A IA só recebe categorias liberadas aqui. A permissão para fotos é separada e começa desligada.</p></div><MessageSquareLock size={24} /></div><div className="privacy-permission-grid">{categories.map(({ key, title, description, icon: Icon, sensitive }) => <label className={`privacy-permission ${sensitive ? 'is-sensitive' : ''}`} key={key}><span><Icon size={17} /></span><div><strong>{title}{sensitive && <i>SENSÍVEL</i>}</strong><small>{description}</small></div><input type="checkbox" checked={permissions[key]} disabled={busy} onChange={() => void togglePermission(key)} /><b /></label>)}</div><div className="privacy-photo-notice"><LockKeyhole size={16} /><span><strong>Fotos nunca entram por padrão.</strong> Mesmo com a chave ligada, o envio só deve acontecer em uma ação futura que peça autorização específica para aquela foto.</span></div></Card>

    <Card className="privacy-card community-privacy-card"><div className="privacy-card-heading"><div><small>COMUNIDADE</small><h2>O que aparece no seu perfil social</h2><p>Essas escolhas valem apenas para a Comunidade. Peso, altura, calorias e dados de saúde continuam privados.</p></div><UsersRound size={24} /></div><div className="community-privacy-settings"><label><span><strong>Perfil na Comunidade</strong><small>Um perfil privado só mostra seus conteúdos para seus seguidores.</small></span><select value={communitySettings.profileVisibility} disabled={busy} onChange={(event) => void saveCommunitySettings({ ...communitySettings, profileVisibility: event.target.value as CommunityProfileSettings['profileVisibility'] })}><option value="public">Público</option><option value="private">Privado</option></select></label><label><span><strong>Resumo de atividade</strong><small>Controla a sequência e o total de treinos exibidos no perfil social.</small></span><select value={communitySettings.activityVisibility} disabled={busy} onChange={(event) => void saveCommunitySettings({ ...communitySettings, activityVisibility: event.target.value as CommunityProfileSettings['activityVisibility'] })}><option value="public">Público</option><option value="private">Privado</option></select></label><label className="community-privacy-toggle"><span><strong>Mostrar distância acumulada</strong><small>Compartilha apenas o total, nunca o trajeto ou dados detalhados.</small></span><input type="checkbox" checked={communitySettings.shareDistance} disabled={busy} onChange={() => void saveCommunitySettings({ ...communitySettings, shareDistance: !communitySettings.shareDistance })} /><b /></label><label className="community-privacy-toggle"><span><strong>Compartilhar conquistas</strong><small>Exibe apenas medalhas escolhidas para a Comunidade.</small></span><input type="checkbox" checked={communitySettings.shareAchievements} disabled={busy} onChange={() => void saveCommunitySettings({ ...communitySettings, shareAchievements: !communitySettings.shareAchievements })} /><b /></label></div></Card>

    <div className="privacy-two-col"><Card className="privacy-card"><div className="privacy-card-heading"><div><small>TRANSPARÊNCIA</small><h2>Políticas e consentimentos</h2><p>Leia os documentos e altere suas escolhas quando quiser.</p></div><FileText size={23} /></div><div className="privacy-document-actions"><button onClick={() => setDocumentView('privacy')}><FileText size={16} /><span><strong>Política de privacidade</strong><small>Como tratamos dados pessoais e de saúde</small></span><Eye size={15} /></button><button onClick={() => setDocumentView('terms')}><ClipboardList size={16} /><span><strong>Termos de uso</strong><small>Regras de utilização do MOVELYA</small></span><Eye size={15} /></button></div><div className="privacy-consent-list">{(Object.keys(consentLabels) as ConsentType[]).map((type) => { const current = latestConsent.get(type); return <label key={type}><span><strong>{consentLabels[type]}</strong><small>{current?.granted ? `Aceito em ${formatDate(current.grantedAt)}` : 'Ainda não aceito'}</small></span><input type="checkbox" checked={Boolean(current?.granted)} disabled={busy} onChange={(event) => void toggleConsent(type, event.target.checked)} /><b /></label> })}</div></Card>
      <Card className="privacy-card privacy-history-card"><div className="privacy-card-heading"><div><small>HISTÓRICO</small><h2>Rastro de segurança</h2><p>Consentimentos e ações importantes da sua conta.</p></div><ClipboardList size={23} /></div><div className="privacy-audit-list">{audits.length ? audits.slice(0, 7).map((item) => <article key={item.id}><span><Check size={13} /></span><div><strong>{auditLabel(item.action)}</strong><small>{formatDateTime(item.createdAt)}</small></div></article>) : <p>Nenhuma ação registrada ainda.</p>}</div></Card></div>

    <Card className="privacy-card privacy-data-card"><div className="privacy-card-heading"><div><small>SEUS DADOS</small><h2>Exportar, desconectar ou sair</h2><p>As ações abaixo são protegidas, registradas e não compartilham seus arquivos privados.</p></div><CloudDownload size={24} /></div><div className="privacy-action-grid"><button onClick={() => void exportData()} disabled={busy}><CloudDownload size={18} /><span><strong>Exportar meus dados</strong><small>Baixe um JSON com seus registros e preferências.</small></span></button><button onClick={() => void disconnectIntegrations()} disabled={busy}><Link2Off size={18} /><span><strong>Desconectar integrações</strong><small>Interrompe novas sincronizações de saúde.</small></span></button></div></Card>

    <div className="privacy-two-col"><Card className="privacy-card"><div className="privacy-card-heading"><div><small>SENHA</small><h2>Alterar senha</h2><p>Use uma senha única com pelo menos 8 caracteres.</p></div><KeyRound size={23} /></div><form className="privacy-password-form" onSubmit={changePassword}><input type="password" autoComplete="new-password" placeholder="Nova senha" value={password} onChange={(event) => setPassword(event.target.value)} /><input type="password" autoComplete="new-password" placeholder="Repita a nova senha" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /><Button disabled={busy}><KeyRound size={14} /> Salvar nova senha</Button></form></Card><Card className="privacy-card"><div className="privacy-card-heading"><div><small>SESSÕES CONECTADAS</small><h2>Onde sua conta está ativa</h2><p>O Supabase mantém a sessão atual protegida e permite revogar as demais.</p></div><UserRound size={23} /></div><div className="privacy-session"><span><Check size={16} /></span><div><strong>Este dispositivo</strong><small>{user?.email} · sessão atual</small><small>Iniciada {formatDate(session?.createdAt)}</small></div><i>Ativa</i></div><button className="privacy-secondary-action" onClick={() => void signOutOthers()} disabled={busy}><LogOut size={15} /> Encerrar outras sessões</button></Card></div>

    <Card className="privacy-card privacy-danger-card"><div className="privacy-card-heading"><div><small>CONTROLE DEFINITIVO</small><h2>Excluir minha conta e dados</h2><p>A exclusão remove sua conta, registros, conversas, integrações e fotos privadas. Esta ação não pode ser desfeita.</p></div><Trash2 size={24} /></div><Button className="privacy-delete-button" onClick={() => setDeleteOpen(true)}><Trash2 size={15} /> Excluir definitivamente</Button></Card>

    {documentView && <div className="privacy-modal-backdrop" onMouseDown={() => setDocumentView(null)}><div className="privacy-modal" onMouseDown={(event) => event.stopPropagation()}><button onClick={() => setDocumentView(null)} aria-label="Fechar"><X size={17} /></button><span className="page-eyebrow">MOVELYA · VERSÃO 1.0</span><h2>{documentView === 'privacy' ? 'Política de privacidade' : 'Termos de uso'}</h2>{documentView === 'privacy' ? <><p>Coletamos apenas dados necessários para exibir sua evolução, oferecer recursos personalizados e manter sua conta segura.</p><h3>Dados de saúde</h3><p>Informações de peso, medidas, atividades, alimentação e fotos são privadas, vinculadas à sua conta e não são públicas.</p><h3>IA</h3><p>A IA recebe somente categorias autorizadas por você. Fotos de evolução não são enviadas automaticamente.</p><h3>Seus direitos</h3><p>Você pode consultar, exportar, corrigir, revogar consentimentos e excluir sua conta a qualquer momento.</p></> : <><p>Use o MOVELYA como ferramenta de acompanhamento e educação. Ele não substitui avaliação médica, nutricional ou de educação física.</p><h3>Uso responsável</h3><p>Não compartilhe sua senha. Confira sugestões antes de aplicá-las e procure um profissional diante de dor, lesão ou sintomas.</p><h3>Conta</h3><p>Você é responsável pelos dados inseridos e pode encerrar sua conta pelo painel de privacidade.</p></>}</div></div>}
    {deleteOpen && <div className="privacy-modal-backdrop" onMouseDown={() => setDeleteOpen(false)}><div className="privacy-modal privacy-delete-modal" onMouseDown={(event) => event.stopPropagation()}><button onClick={() => setDeleteOpen(false)} aria-label="Fechar"><X size={17} /></button><Trash2 size={27} /><h2>Excluir tudo definitivamente?</h2><p>Essa ação remove a conta e todos os dados relacionados. Digite <strong>EXCLUIR MINHA CONTA</strong> para confirmar.</p><input value={deleteText} onChange={(event) => setDeleteText(event.target.value)} placeholder="EXCLUIR MINHA CONTA" /><div><Button variant="secondary" onClick={() => setDeleteOpen(false)}>Cancelar</Button><Button className="privacy-delete-button" disabled={deleteText !== 'EXCLUIR MINHA CONTA' || busy} onClick={() => void deleteAccount()}><Trash2 size={14} /> Excluir tudo</Button></div></div></div>}
  </section>
}

function formatDate(value?: string | null) { return value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(value)) : '—' }
function formatDateTime(value: string) { return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) }
function auditLabel(value: string) { return ({ ai_permissions_updated: 'Permissões da IA atualizadas', consent_granted: 'Consentimento aceito', consent_revoked: 'Consentimento revogado', data_exported: 'Dados exportados', password_changed: 'Senha alterada', health_integrations_disconnected: 'Integrações desconectadas', other_sessions_revoked: 'Outras sessões encerradas' } as Record<string, string>)[value] ?? value }
function message(error: unknown) { return error instanceof Error ? error.message : 'Não foi possível concluir esta ação.' }
