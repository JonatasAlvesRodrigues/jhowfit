import { LogOut, Mail, ShieldCheck, UserRound } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

export function ProfilePage({ onLogout }: { onLogout: () => void }) {
  const { user } = useAuth()
  const name = String(user?.user_metadata?.full_name || 'Usuário VitaFit')
  const initials = name.split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase()

  return (
    <section className="placeholder-page profile-page">
      <div className="placeholder-hero">
        <div><span className="page-eyebrow">SUA CONTA</span><h1>Perfil</h1><p>Gerencie suas informações e sua sessão.</p></div>
        <div className="page-icon"><UserRound size={31} /></div>
      </div>
      <div className="profile-account-card">
        <div className="profile-account-avatar">{initials}</div>
        <div className="profile-account-copy"><small>CONTA VITAFIT</small><h2>{name}</h2><p><Mail size={15} /> {user?.email}</p></div>
        <span className="profile-confirmed"><ShieldCheck size={16} /> E-mail confirmado</span>
      </div>
      <button className="profile-logout-button" onClick={onLogout}><LogOut size={18} /><span><strong>Sair da conta</strong><small>Encerra a sessão neste dispositivo</small></span></button>
    </section>
  )
}
