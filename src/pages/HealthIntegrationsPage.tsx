import { useEffect, useMemo, useState } from 'react'
import { Activity, Apple, Check, Clock3, Database, HeartPulse, Link2, LockKeyhole, RefreshCw, ShieldCheck, Smartphone, TriangleAlert, Unplug, Weight } from 'lucide-react'
import { Button, Card } from '../components/ui'
import { healthIntegrationService } from '../services/healthIntegrationService'
import { defaultHealthPermissions, type HealthConnection, type HealthPermission, type HealthPermissionState, type HealthProvider, type NativeHealthAvailability } from '../types/healthIntegration'
import '../healthIntegrations.css'

const permissionContent: Array<{ key: HealthPermission; title: string; description: string; icon: typeof Activity }> = [
  { key: 'steps', title: 'Passos', description: 'Contagem diária consolidada pelo sistema.', icon: Activity },
  { key: 'distance', title: 'Distância', description: 'Caminhada, corrida e bicicleta, quando disponível.', icon: Smartphone },
  { key: 'workout', title: 'Treinos', description: 'Tipo, duração e horário das atividades.', icon: HeartPulse },
  { key: 'active_calories', title: 'Calorias ativas', description: 'Energia ativa estimada pelo dispositivo.', icon: RefreshCw },
  { key: 'weight', title: 'Peso', description: 'Opcional. Só é importado com sua autorização.', icon: Weight },
]

const nativeIntegrationReleased = false

export function HealthIntegrationsPage({ userId }: { userId: string }) {
  const [availability, setAvailability] = useState<NativeHealthAvailability | null>(null)
  const [provider, setProvider] = useState<HealthProvider>('apple_health')
  const [connection, setConnection] = useState<HealthConnection | null>(null)
  const [permissions, setPermissions] = useState<HealthPermissionState>(defaultHealthPermissions)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function load() {
    setLoading(true); setError('')
    try {
      const nextAvailability = await healthIntegrationService.availability()
      const nextProvider = nextAvailability.provider ?? provider
      setAvailability(nextAvailability); setProvider(nextProvider)
      const nextConnection = await healthIntegrationService.getConnection(userId, nextProvider)
      setConnection(nextConnection)
      setPermissions(nextConnection?.permissions ?? defaultHealthPermissions)
    } catch (requestError) { setError(message(requestError)) }
    finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [userId])
  useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(''), 4000); return () => window.clearTimeout(timer) }, [notice])

  const connected = nativeIntegrationReleased && (connection?.status === 'connected' || connection?.status === 'error')
  const authorized = useMemo(() => permissionContent.filter((item) => connection?.permissions[item.key]), [connection])

  async function connect() {
    setBusy(true); setError('')
    try { const next = await healthIntegrationService.connect(userId, provider, permissions); setConnection(next); setPermissions(next.permissions); setNotice(`${providerName(provider)} conectado com sucesso.`) }
    catch (requestError) { setError(message(requestError)) }
    finally { setBusy(false) }
  }

  async function togglePermission(key: HealthPermission) {
    const next = { ...permissions, [key]: !permissions[key] }
    setPermissions(next)
    if (!connected) return
    setBusy(true); setError('')
    try { const updated = await healthIntegrationService.updatePermissions(userId, provider, next); setConnection(updated); setPermissions(updated.permissions); setNotice('Preferências de sincronização atualizadas.') }
    catch (requestError) { setPermissions(permissions); setError(message(requestError)) }
    finally { setBusy(false) }
  }

  async function sync() {
    if (!connection) return
    setBusy(true); setError('')
    try { const result = await healthIntegrationService.sync(userId, connection); setNotice(`${result.imported} ${result.imported === 1 ? 'registro sincronizado' : 'registros sincronizados'}, sem duplicações.`); await load() }
    catch (requestError) { setError(message(requestError)); await load() }
    finally { setBusy(false) }
  }

  async function disconnect() {
    if (!window.confirm(`Desconectar o ${providerName(provider)}? Os dados já importados serão mantidos.`)) return
    setBusy(true); setError('')
    try { await healthIntegrationService.disconnect(userId, provider); setConnection(connection ? { ...connection, status: 'disconnected' } : null); setNotice('Serviço desconectado. Nenhuma nova sincronização será feita.') }
    catch (requestError) { setError(message(requestError)) }
    finally { setBusy(false) }
  }

  if (loading) return <div className="health-loading"><div /><div /><div /></div>

  return <section className="health-page">
    <div className="page-heading health-hero">
      <div><p>SAÚDE E ATIVIDADE</p><h1>Seus dados, sob seu controle.</h1><span>Conecte somente o que quiser e sincronize quando decidir.</span></div>
      <div className="health-hero-icon"><HeartPulse size={32} /></div>
    </div>

    {error && <div className="health-alert is-error"><TriangleAlert size={18} /><span>{error}</span></div>}
    {notice && <div className="health-alert is-success"><Check size={18} /><span>{notice}</span></div>}

    <div className="health-layout">
      <Card className="health-connection-card">
        <header>
          <span className={provider === 'apple_health' ? 'is-apple' : 'is-android'}>{provider === 'apple_health' ? <Apple size={25} /> : <HeartPulse size={25} />}</span>
          <div><small>SERVIÇO DESTE DISPOSITIVO</small><h2>{providerName(provider)}</h2></div>
          <i className={connected ? 'is-connected' : ''}>{connected ? 'Conectado' : 'Em breve'}</i>
        </header>

        <div className="health-connection-meta">
          <span><Clock3 size={16} /><div><small>ÚLTIMA SINCRONIZAÇÃO</small><strong>{formatDateTime(connection?.lastSyncAt)}</strong></div></span>
          <span><ShieldCheck size={16} /><div><small>DADOS AUTORIZADOS</small><strong>{authorized.length ? `${authorized.length} de ${permissionContent.length}` : 'Nenhum'}</strong></div></span>
          <span><Smartphone size={16} /><div><small>DISPOSITIVO</small><strong>{connection?.deviceLabel || availability?.deviceLabel || platformName(availability?.platform)}</strong></div></span>
        </div>

        {connected && <div className="health-authorized-list">{authorized.map((item) => <span key={item.key}><Check size={12} />{item.title}</span>)}</div>}
        {connection?.lastError && <p className="health-last-error"><TriangleAlert size={14} /> A última sincronização encontrou um problema: {connection.lastError}</p>}

        <footer>
          {!connected ? <Button onClick={() => void connect()} disabled><Link2 size={16} /> Conexão desativada nesta versão</Button> : <><Button onClick={() => void sync()} disabled={busy}><RefreshCw size={16} className={busy ? 'is-spinning' : ''} /> Sincronizar agora</Button><Button variant="secondary" onClick={() => void disconnect()} disabled={busy}><Unplug size={16} /> Desconectar</Button></>}
        </footer>
      </Card>

      <Card className="health-security-card">
        <span><LockKeyhole size={22} /></span><small>PRIVACIDADE POR PADRÃO</small><h2>Você decide o que entra.</h2>
        <p>O MOVELYA solicita somente leitura das categorias escolhidas. Peso começa desativado e nenhuma conexão é obrigatória para usar o aplicativo.</p>
        <ul><li>Identificador externo único por registro</li><li>Sincronização incremental com margem para alterações</li><li>Proteção contra duplicidade no banco</li><li>Dados separados por usuário</li></ul>
      </Card>
    </div>

    <div className="health-native-notice"><Smartphone size={22} /><div><strong>Integração desativada por enquanto</strong><p>O MOVELYA ainda não possui aplicativo nativo para iPhone ou Android. Por segurança, conectar, sincronizar e alterar permissões permanecerão bloqueados até o lançamento do app.</p></div></div>

    <Card className="health-permissions-card">
      <div className="health-section-heading"><div><small>CONTROLE INDIVIDUAL</small><h2>Permissões de sincronização</h2></div><span>Somente leitura</span></div>
      <div className="health-permission-list">
        {permissionContent.map(({ key, title, description, icon: Icon }) => <article key={key} className={key === 'weight' ? 'is-sensitive' : ''}><span><Icon size={18} /></span><div><strong>{title}{key === 'weight' && <i>OPCIONAL</i>}</strong><p>{description}</p></div><label className="health-switch"><input type="checkbox" checked={nativeIntegrationReleased && permissions[key]} disabled onChange={() => void togglePermission(key)} /><b /></label></article>)}
      </div>
      {connected && <p className="health-permission-help">Desativar uma categoria impede novas importações no MOVELYA. No iPhone, a revogação da permissão do sistema deve ser feita também no app Saúde; no Android, em Health Connect.</p>}
    </Card>

    <div className="health-limitations">
      <div><Database size={18} /><span><strong>PWA e navegador</strong><p>Não acessam HealthKit nem Health Connect. A interface funciona, mas conectar e sincronizar permanecem indisponíveis.</p></span></div>
      <div><Apple size={18} /><span><strong>Apple Health</strong><p>Exige app iOS assinado, capability HealthKit e descrições de uso. Por privacidade, o HealthKit não informa claramente quando a leitura foi negada.</p></span></div>
      <div><HeartPulse size={18} /><span><strong>Health Connect</strong><p>Exige app Android e declaração dos tipos no Play Console. No Android 13 ou anterior, o app Health Connect precisa estar instalado.</p></span></div>
    </div>
  </section>
}

function providerName(provider: HealthProvider) { return provider === 'apple_health' ? 'Apple Health' : 'Health Connect' }
function platformName(platform?: NativeHealthAvailability['platform']) { return platform === 'ios' ? 'iPhone' : platform === 'android' ? 'Android' : 'Navegador' }
function formatDateTime(value?: string | null) { return value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : 'Ainda não sincronizado' }
function message(error: unknown) { return error instanceof Error ? error.message : 'Não foi possível concluir esta ação.' }
