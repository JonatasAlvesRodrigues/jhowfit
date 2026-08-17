import { useState } from 'react'
import { Bell, ChevronRight, CircleHelp, Crown, Download, FileText, Goal, LockKeyhole, LogOut, Mail, Settings2, ShieldCheck, Sparkles, UserRound } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

type ProfileAction = { icon: typeof UserRound; title: string; description: string }

const accountActions: ProfileAction[] = [
  { icon: UserRound, title: 'Dados pessoais', description: 'Nome, e-mail e informações de saúde' },
  { icon: Goal, title: 'Objetivos e rotina', description: 'Metas, nível e preferências de treino' },
  { icon: Bell, title: 'Lembretes', description: 'Água, treinos e resumo semanal' },
  { icon: LockKeyhole, title: 'Privacidade e dados', description: 'Permissões, exportação e segurança' },
]

export function ProfilePage({ onLogout }: { onLogout: () => void }) {
  const { user } = useAuth()
  const [notice, setNotice] = useState('')
  const name = String(user?.user_metadata?.full_name || 'Usuário MOVELYA')
  const initials = name.split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase()
  const memberSince = user?.created_at
    ? new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date(user.created_at))
    : 'agosto de 2026'

  const showNotice = (message: string) => {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 3500)
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
            <div className="profile-plan-card__top"><div className="profile-plan-card__symbol"><Crown size={20} /></div><span>SEU PLANO</span></div>
            <div className="profile-plan-card__content">
              <div><h2>MOVELYA Plus</h2><p>Planos inteligentes, acompanhamento e recomendações personalizadas para sua rotina.</p></div>
              <button className="profile-plan-card__button" onClick={() => showNotice('Em breve você poderá gerenciar sua assinatura por aqui.')}>Gerenciar assinatura <ChevronRight size={17} /></button>
            </div>
            <div className="profile-plan-card__footer"><span><Sparkles size={15} /> Período de teste ativo</span><small>Renovação em 17 de setembro</small></div>
          </section>

          <section className="profile-section">
            <div className="profile-section__heading"><div><span className="page-eyebrow">PREFERÊNCIAS</span><h2>Sua experiência</h2></div><Settings2 size={19} /></div>
            <div className="profile-action-list">
              {accountActions.map(({ icon: Icon, title, description }) => (
                <button key={title} className="profile-action" onClick={() => showNotice(`${title}: edição disponível em breve.`)}>
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
            <button onClick={() => showNotice('Central de ajuda disponível em breve.')}><FileText size={16} /> Central de ajuda <ChevronRight size={16} /></button>
            <button onClick={() => showNotice('Vamos preparar seu arquivo para download.')}><Download size={16} /> Baixar meus dados <ChevronRight size={16} /></button>
          </section>
          <button className="profile-logout-button" onClick={onLogout}><LogOut size={18} /><span><strong>Sair da conta</strong><small>Encerra a sessão neste dispositivo</small></span></button>
        </aside>
      </div>
    </section>
  )
}
