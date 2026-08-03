import type { LucideIcon } from 'lucide-react'

export type RouteId =
  | 'inicio'
  | 'treinos'
  | 'dieta'
  | 'atividades'
  | 'evolucao'
  | 'relatorios'
  | 'metas'
  | 'perfil'
  | 'configuracoes'
  | 'sair'

export interface VitaRoute {
  id: RouteId
  path: string
  label: string
  mobileLabel?: string
  eyebrow: string
  description: string
  icon: LucideIcon
}
