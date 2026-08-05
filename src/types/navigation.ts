import type { LucideIcon } from 'lucide-react'

export type RouteId =
  | 'inicio'
  | 'treinos'
  | 'dieta'
  | 'alimentos'
  | 'atividades'
  | 'evolucao'
  | 'relatorios'
  | 'metas'
  | 'perfil'
  | 'configuracoes'
  | 'sair'
  | 'entrar'
  | 'criar-conta'
  | 'esqueci-senha'
  | 'redefinir-senha'
  | 'confirmar-email'
  | 'configuracao-inicial'

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
