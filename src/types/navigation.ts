import type { LucideIcon } from 'lucide-react'

export type RouteId =
  | 'inicio'
  | 'treinos'
  | 'dieta'
  | 'alimentos'
  | 'agua'
  | 'atividades'
  | 'evolucao'
  | 'relatorios'
  | 'assistente'
  | 'metas'
  | 'conquistas'
  | 'perfil'
  | 'planos'
  | 'configuracoes'
  | 'privacidade'
  | 'notificacoes'
  | 'sair'
  | 'entrar'
  | 'criar-conta'
  | 'esqueci-senha'
  | 'redefinir-senha'
  | 'confirmar-email'
  | 'configuracao-inicial'
  | 'administracao'
  | 'checkout'
  | 'checkout-confirmado'

export interface VitaRoute {
  id: RouteId
  path: string
  label: string
  mobileLabel?: string
  eyebrow: string
  description: string
  icon: LucideIcon
  public?: boolean
}
