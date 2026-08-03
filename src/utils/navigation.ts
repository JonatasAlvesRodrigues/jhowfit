import {
  Activity,
  Apple,
  ChartNoAxesCombined,
  ClipboardMinus,
  Dumbbell,
  Goal,
  House,
  LogOut,
  Settings,
  KeyRound,
  MailCheck,
  UserPlus,
  UserRound,
} from 'lucide-react'
import type { RouteId, VitaRoute } from '../types/navigation'

export const vitaRoutes: VitaRoute[] = [
  { id: 'inicio', path: '/inicio', label: 'Início', eyebrow: 'VISÃO GERAL', description: 'Seu dia, seus indicadores e próximos passos em um só lugar.', icon: House },
  { id: 'treinos', path: '/treinos', label: 'Treinos', mobileLabel: 'Treino', eyebrow: 'MOVIMENTO', description: 'Planeje sessões e acompanhe sua rotina de exercícios.', icon: Dumbbell },
  { id: 'dieta', path: '/dieta', label: 'Dieta', eyebrow: 'NUTRIÇÃO', description: 'Organize refeições e mantenha sua alimentação no caminho certo.', icon: Apple },
  { id: 'atividades', path: '/atividades', label: 'Atividades', mobileLabel: 'Atividade', eyebrow: 'VIDA ATIVA', description: 'Corridas, caminhadas, passos e todas as suas atividades.', icon: Activity },
  { id: 'evolucao', path: '/evolucao', label: 'Evolução', eyebrow: 'PROGRESSO', description: 'Visualize mudanças no corpo e celebre cada avanço.', icon: ChartNoAxesCombined },
  { id: 'relatorios', path: '/relatorios', label: 'Relatórios', eyebrow: 'ANÁLISES', description: 'Entenda seus hábitos por meio de relatórios claros.', icon: ClipboardMinus },
  { id: 'metas', path: '/metas', label: 'Metas', eyebrow: 'OBJETIVOS', description: 'Defina aonde quer chegar e acompanhe seu ritmo.', icon: Goal },
  { id: 'perfil', path: '/perfil', label: 'Perfil', eyebrow: 'SUA CONTA', description: 'Gerencie suas informações e preferências pessoais.', icon: UserRound },
  { id: 'configuracoes', path: '/configuracoes', label: 'Configurações', eyebrow: 'PREFERÊNCIAS', description: 'Ajuste o VitaFit para funcionar do seu jeito.', icon: Settings },
  { id: 'sair', path: '/sair', label: 'Sair', eyebrow: 'SESSÃO', description: 'Encerre sua sessão com segurança.', icon: LogOut },
]

export const authRoutes: VitaRoute[] = [
  { id: 'entrar', path: '/entrar', label: 'Entrar', eyebrow: 'BEM-VINDO', description: 'Acesse sua conta VitaFit.', icon: KeyRound, public: true },
  { id: 'criar-conta', path: '/criar-conta', label: 'Criar conta', eyebrow: 'COMECE AGORA', description: 'Crie sua conta VitaFit.', icon: UserPlus, public: true },
  { id: 'esqueci-senha', path: '/esqueci-senha', label: 'Recuperar senha', eyebrow: 'RECUPERAÇÃO', description: 'Receba um link para redefinir sua senha.', icon: KeyRound, public: true },
  { id: 'redefinir-senha', path: '/redefinir-senha', label: 'Redefinir senha', eyebrow: 'NOVA SENHA', description: 'Escolha uma nova senha para sua conta.', icon: KeyRound, public: true },
  { id: 'confirmar-email', path: '/confirmar-email', label: 'Confirmar e-mail', eyebrow: 'CONFIRMAÇÃO', description: 'Confirme seu endereço de e-mail.', icon: MailCheck, public: true },
]

export const onboardingRoute: VitaRoute = {
  id: 'configuracao-inicial',
  path: '/configuracao-inicial',
  label: 'Configuração inicial',
  eyebrow: 'PERSONALIZAÇÃO',
  description: 'Conte-nos um pouco sobre você.',
  icon: UserRound,
}

export const mobileRouteIds: RouteId[] = ['inicio', 'treinos', 'dieta', 'atividades', 'perfil']

export const mobileRoutes = mobileRouteIds.map((id) => vitaRoutes.find((route) => route.id === id)!)

export function findRoute(pathname: string) {
  const normalized = pathname === '/' ? '/inicio' : pathname.replace(/\/+$/, '').toLowerCase()
  return [...vitaRoutes, ...authRoutes, onboardingRoute].find((route) => route.path === normalized) ?? null
}

export function isPrivateRoute(route: VitaRoute | null) {
  return Boolean(route && !route.public)
}
