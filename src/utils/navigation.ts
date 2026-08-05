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
  { id: 'inicio', path: '/inicio', label: 'InÃ­cio', eyebrow: 'VISÃƒO GERAL', description: 'Seu dia, seus indicadores e prÃ³ximos passos em um sÃ³ lugar.', icon: House },
  { id: 'treinos', path: '/treinos', label: 'Treinos', mobileLabel: 'Treino', eyebrow: 'MOVIMENTO', description: 'Planeje sessÃµes e acompanhe sua rotina de exercÃ­cios.', icon: Dumbbell },
  { id: 'dieta', path: '/dieta', label: 'Dieta', eyebrow: 'NUTRIÃ‡ÃƒO', description: 'Organize refeiÃ§Ãµes e mantenha sua alimentaÃ§Ã£o no caminho certo.', icon: Apple },
  { id: 'atividades', path: '/atividades', label: 'Atividades', mobileLabel: 'Atividade', eyebrow: 'VIDA ATIVA', description: 'Corridas, caminhadas, passos e todas as suas atividades.', icon: Activity },
  { id: 'evolucao', path: '/evolucao', label: 'EvoluÃ§Ã£o', eyebrow: 'PROGRESSO', description: 'Visualize mudanÃ§as no corpo e celebre cada avanÃ§o.', icon: ChartNoAxesCombined },
  { id: 'relatorios', path: '/relatorios', label: 'RelatÃ³rios', eyebrow: 'ANÃLISES', description: 'Entenda seus hÃ¡bitos por meio de relatÃ³rios claros.', icon: ClipboardMinus },
  { id: 'metas', path: '/metas', label: 'Metas', eyebrow: 'OBJETIVOS', description: 'Defina aonde quer chegar e acompanhe seu ritmo.', icon: Goal },
  { id: 'perfil', path: '/perfil', label: 'Perfil', eyebrow: 'SUA CONTA', description: 'Gerencie suas informaÃ§Ãµes e preferÃªncias pessoais.', icon: UserRound },
  { id: 'configuracoes', path: '/configuracoes', label: 'ConfiguraÃ§Ãµes', eyebrow: 'PREFERÃŠNCIAS', description: 'Ajuste o MOVELYA para funcionar do seu jeito.', icon: Settings },
  { id: 'sair', path: '/sair', label: 'Sair', eyebrow: 'SESSÃƒO', description: 'Encerre sua sessÃ£o com seguranÃ§a.', icon: LogOut },
]

export const authRoutes: VitaRoute[] = [
  { id: 'entrar', path: '/entrar', label: 'Entrar', eyebrow: 'BEM-VINDO', description: 'Acesse sua conta MOVELYA.', icon: KeyRound, public: true },
  { id: 'criar-conta', path: '/criar-conta', label: 'Criar conta', eyebrow: 'COMECE AGORA', description: 'Crie sua conta MOVELYA.', icon: UserPlus, public: true },
  { id: 'esqueci-senha', path: '/esqueci-senha', label: 'Recuperar senha', eyebrow: 'RECUPERAÃ‡ÃƒO', description: 'Receba um link para redefinir sua senha.', icon: KeyRound, public: true },
  { id: 'redefinir-senha', path: '/redefinir-senha', label: 'Redefinir senha', eyebrow: 'NOVA SENHA', description: 'Escolha uma nova senha para sua conta.', icon: KeyRound, public: true },
  { id: 'confirmar-email', path: '/confirmar-email', label: 'Confirmar e-mail', eyebrow: 'CONFIRMAÃ‡ÃƒO', description: 'Confirme seu endereÃ§o de e-mail.', icon: MailCheck, public: true },
]

export const onboardingRoute: VitaRoute = {
  id: 'configuracao-inicial',
  path: '/configuracao-inicial',
  label: 'ConfiguraÃ§Ã£o inicial',
  eyebrow: 'PERSONALIZAÃ‡ÃƒO',
  description: 'Conte-nos um pouco sobre vocÃª.',
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

