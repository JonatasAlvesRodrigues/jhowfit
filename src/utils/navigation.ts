import {
  Activity, Apple, ChartNoAxesCombined, ClipboardMinus, Droplets, Dumbbell, Goal, House, Library, Sparkles,
  Bell, KeyRound, LogOut, MailCheck, Medal, Settings, ShieldCheck, UserPlus, UserRound, LockKeyhole, Crown,
} from 'lucide-react'
import type { RouteId, VitaRoute } from '../types/navigation'

export const vitaRoutes: VitaRoute[] = [
  { id: 'inicio', path: '/inicio', label: 'Início', eyebrow: 'VISÃO GERAL', description: 'Seu dia, seus indicadores e próximos passos em um só lugar.', icon: House },
  { id: 'treinos', path: '/treinos', label: 'Treinos', mobileLabel: 'Treino', eyebrow: 'MOVIMENTO', description: 'Planeje sessões e acompanhe sua rotina de exercícios.', icon: Dumbbell },
  { id: 'dieta', path: '/dieta', label: 'Dieta', eyebrow: 'NUTRIÇÃO', description: 'Organize refeições e mantenha sua alimentação no caminho certo.', icon: Apple },
  { id: 'alimentos', path: '/alimentos', label: 'Banco de alimentos', mobileLabel: 'Alimentos', eyebrow: 'NUTRIÇÃO', description: 'Consulte informações nutricionais e gerencie seus alimentos.', icon: Library },
  { id: 'agua', path: '/agua', label: 'Água', eyebrow: 'HIDRATAÇÃO', description: 'Registre seu consumo e acompanhe sua hidratação diária.', icon: Droplets },
  { id: 'atividades', path: '/atividades', label: 'Atividades', mobileLabel: 'Atividade', eyebrow: 'VIDA ATIVA', description: 'Corridas, caminhadas, passos e todas as suas atividades.', icon: Activity },
  { id: 'evolucao', path: '/evolucao', label: 'Evolução', eyebrow: 'PROGRESSO', description: 'Visualize mudanças no corpo e celebre cada avanço.', icon: ChartNoAxesCombined },
  { id: 'relatorios', path: '/relatorios', label: 'Relatórios', eyebrow: 'ANÁLISES', description: 'Entenda seus hábitos por meio de relatórios claros.', icon: ClipboardMinus },
  { id: 'assistente', path: '/assistente', label: 'Assistente IA', mobileLabel: 'IA', eyebrow: 'INTELIGÊNCIA', description: 'Converse com a IA usando apenas os dados que você autorizar.', icon: Sparkles },
  { id: 'metas', path: '/metas', label: 'Metas', eyebrow: 'OBJETIVOS', description: 'Defina aonde quer chegar e acompanhe seu ritmo.', icon: Goal },
  { id: 'conquistas', path: '/conquistas', label: 'Conquistas', eyebrow: 'CONSISTÊNCIA', description: 'Celebre sua constância, suas medalhas e cada passo da sua evolução.', icon: Medal },
  { id: 'perfil', path: '/perfil', label: 'Perfil', eyebrow: 'SUA CONTA', description: 'Gerencie suas informações e preferências pessoais.', icon: UserRound },
  { id: 'planos', path: '/planos', label: 'Planos e assinatura', mobileLabel: 'Planos', eyebrow: 'ASSINATURA', description: 'Conheça os benefícios do seu plano e acompanhe suas cotas mensais.', icon: Crown },
  { id: 'configuracoes', path: '/configuracoes', label: 'Configurações', eyebrow: 'PREFERÊNCIAS', description: 'Ajuste o MOVELYA para funcionar do seu jeito.', icon: Settings },
  { id: 'privacidade', path: '/privacidade', label: 'Privacidade', eyebrow: 'DADOS E SEGURANÇA', description: 'Controle consentimentos, IA, integrações e sua conta.', icon: ShieldCheck },
  { id: 'notificacoes', path: '/notificacoes', label: 'Notificações', eyebrow: 'LEMBRETES', description: 'Escolha quando e como o MOVELYA deve lembrar você.', icon: Bell },
  { id: 'sair', path: '/sair', label: 'Sair', eyebrow: 'SESSÃO', description: 'Encerre sua sessão com segurança.', icon: LogOut },
]

export const authRoutes: VitaRoute[] = [
  { id: 'entrar', path: '/entrar', label: 'Entrar', eyebrow: 'BEM-VINDO', description: 'Acesse sua conta MOVELYA.', icon: KeyRound, public: true },
  { id: 'criar-conta', path: '/criar-conta', label: 'Criar conta', eyebrow: 'COMECE AGORA', description: 'Crie sua conta MOVELYA.', icon: UserPlus, public: true },
  { id: 'esqueci-senha', path: '/esqueci-senha', label: 'Recuperar senha', eyebrow: 'RECUPERAÇÃO', description: 'Receba um link para redefinir sua senha.', icon: KeyRound, public: true },
  { id: 'redefinir-senha', path: '/redefinir-senha', label: 'Redefinir senha', eyebrow: 'NOVA SENHA', description: 'Escolha uma nova senha para sua conta.', icon: KeyRound, public: true },
  { id: 'confirmar-email', path: '/confirmar-email', label: 'Confirmar e-mail', eyebrow: 'CONFIRMAÇÃO', description: 'Confirme seu endereço de e-mail.', icon: MailCheck, public: true },
]

export const onboardingRoute: VitaRoute = { id: 'configuracao-inicial', path: '/configuracao-inicial', label: 'Configuração inicial', eyebrow: 'PERSONALIZAÇÃO', description: 'Conte-nos um pouco sobre você.', icon: UserRound }
export const adminRoute: VitaRoute = { id: 'administracao', path: '/administracao', label: 'Administração', eyebrow: 'CONTROLE', description: 'Painel operacional protegido por função.', icon: LockKeyhole }
export const mobileRouteIds: RouteId[] = ['inicio', 'treinos', 'assistente', 'atividades', 'perfil']
export const mobileRoutes = mobileRouteIds.map((id) => vitaRoutes.find((route) => route.id === id)!)
export const checkoutRoute: VitaRoute = { id: 'checkout', path: '/checkout', label: 'Finalizar assinatura', eyebrow: 'CHECKOUT', description: 'Revise seu plano antes de seguir para o pagamento seguro.', icon: Crown }
export const checkoutConfirmationRoute: VitaRoute = { id: 'checkout-confirmado', path: '/checkout-confirmado', label: 'Confirmação de compra', eyebrow: 'ASSINATURA', description: 'Acompanhamento seguro da confirmação do seu pagamento.', icon: ShieldCheck }
export function findRoute(pathname: string) { const normalized = (pathname === '/' ? '/inicio' : pathname.replace(/\/+$/, '').toLowerCase()).split('?')[0]; return [...vitaRoutes, adminRoute, checkoutRoute, checkoutConfirmationRoute, ...authRoutes, onboardingRoute].find((route) => route.path === normalized) ?? null }
export function isPrivateRoute(route: VitaRoute | null) { return Boolean(route && !route.public) }
