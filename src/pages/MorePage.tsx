import { Bell, Bot, ChevronRight, Goal, HelpCircle, LogOut, Settings2, ShieldCheck } from 'lucide-react'
import { Card } from '../components/ui'
import { useApp } from '../contexts/AppContext'

export function MorePage() {
  const { openModal } = useApp()
  const items = [
    { icon: Goal, title: 'Minhas metas', desc: 'Objetivos de peso e performance' },
    { icon: Bot, title: 'Coach Jhow IA', desc: 'Orientações personalizadas', action: () => openModal('ai') },
    { icon: Bell, title: 'Notificações', desc: 'Lembretes de treino, água e refeições' },
    { icon: ShieldCheck, title: 'Privacidade', desc: 'Controle seus dados pessoais' },
    { icon: Settings2, title: 'Preferências', desc: 'Unidades, tema e integrações' },
    { icon: HelpCircle, title: 'Central de ajuda', desc: 'Dúvidas e suporte' },
  ]
  return <div className="page">
    <div className="page-heading"><div><p>PERSONALIZE</p><h1>Mais opções</h1><span>Seu aplicativo, do seu jeito.</span></div></div>
    <Card className="settings-card">
      {items.map(({icon: Icon, title, desc, action}) => <button key={title} onClick={action}><span><Icon size={20}/></span><div><strong>{title}</strong><small>{desc}</small></div><ChevronRight size={18}/></button>)}
      <button className="logout"><span><LogOut size={20}/></span><div><strong>Sair da conta</strong><small>Você poderá entrar novamente</small></div></button>
    </Card>
  </div>
}
