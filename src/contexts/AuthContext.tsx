import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '../integrations/supabase'
import { adminService, type AppRole } from '../services/adminService'

interface SignUpInput {
  name: string
  email: string
  password: string
}

interface AuthResult {
  success: boolean
  requiresEmailConfirmation?: boolean
  message?: string
}

interface AuthContextValue {
  user: User | null
  session: Session | null
  loading: boolean
  recoveryMode: boolean
  sessionMessage: string
  configured: boolean
  role: AppRole
  roleLoading: boolean
  login: (email: string, password: string) => Promise<AuthResult>
  signUp: (input: SignUpInput) => Promise<AuthResult>
  logout: () => Promise<void>
  recoverPassword: (email: string) => Promise<AuthResult>
  updatePassword: (password: string) => Promise<AuthResult>
  resendConfirmation: (email: string) => Promise<AuthResult>
  clearSessionMessage: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [recoveryMode, setRecoveryMode] = useState(false)
  const [sessionMessage, setSessionMessage] = useState('')
  const [role, setRole] = useState<AppRole>('user')
  const [roleLoading, setRoleLoading] = useState(false)
  const hadSession = useRef(false)
  const manualLogout = useRef(false)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }

    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession)
      setUser(nextSession?.user ?? null)
      if (nextSession?.user) {
        setRoleLoading(true)
        void adminService.getRole(nextSession.user.id).then(setRole).finally(() => setRoleLoading(false))
      } else { setRole('user'); setRoleLoading(false) }

      if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true)
      if (event === 'USER_UPDATED') setRecoveryMode(false)

      if (event === 'SIGNED_OUT') {
        if (hadSession.current && !manualLogout.current) {
          setSessionMessage('Sua sessão expirou. Entre novamente para continuar.')
        }
        hadSession.current = false
        manualLogout.current = false
      } else if (nextSession) {
        hadSession.current = true
      }
      setLoading(false)
    })

    supabase.auth.getSession().then(({ data: initial }) => {
      setSession(initial.session)
      setUser(initial.session?.user ?? null)
      if (initial.session?.user) {
        setRoleLoading(true)
        void adminService.getRole(initial.session.user.id).then(setRole).finally(() => setRoleLoading(false))
      }
      hadSession.current = Boolean(initial.session)
      setLoading(false)
    }).catch(() => {
      setSessionMessage('Não foi possível restaurar sua sessão.')
      setLoading(false)
    })

    return () => data.subscription.unsubscribe()
  }, [])

  const login = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    if (!supabase) return notConfigured()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { success: false, message: translateAuthError(error.message) }
    setSessionMessage('')
    return { success: true }
  }, [])

  const signUp = useCallback(async ({ name, email, password }: SignUpInput): Promise<AuthResult> => {
    if (!supabase) return notConfigured()
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: getAuthRedirect('/confirmar-email'),
      },
    })
    if (error) return { success: false, message: translateAuthError(error.message) }
    return { success: true, requiresEmailConfirmation: !data.session }
  }, [])

  const logout = useCallback(async () => {
    manualLogout.current = true
    setRecoveryMode(false)
    if (supabase) await supabase.auth.signOut()
    setSession(null)
    setUser(null)
    setRole('user')
    setRoleLoading(false)
  }, [])

  const recoverPassword = useCallback(async (email: string): Promise<AuthResult> => {
    if (!supabase) return notConfigured()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: getAuthRedirect('/redefinir-senha'),
    })
    if (error) return { success: false, message: translateAuthError(error.message) }
    return { success: true }
  }, [])

  const updatePassword = useCallback(async (password: string): Promise<AuthResult> => {
    if (!supabase) return notConfigured()
    const { error } = await supabase.auth.updateUser({ password })
    if (error) return { success: false, message: translateAuthError(error.message) }
    setRecoveryMode(false)
    return { success: true }
  }, [])

  const resendConfirmation = useCallback(async (email: string): Promise<AuthResult> => {
    if (!supabase) return notConfigured()
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: getAuthRedirect('/confirmar-email') },
    })
    if (error) return { success: false, message: translateAuthError(error.message) }
    return { success: true }
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    user,
    session,
    loading,
    recoveryMode,
    sessionMessage,
    configured: isSupabaseConfigured,
    role,
    roleLoading,
    login,
    signUp,
    logout,
    recoverPassword,
    updatePassword,
    resendConfirmation,
    clearSessionMessage: () => setSessionMessage(''),
  }), [user, session, loading, recoveryMode, sessionMessage, role, roleLoading, login, signUp, logout, recoverPassword, updatePassword, resendConfirmation])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth deve estar dentro de AuthProvider')
  return context
}

function getAuthRedirect(path: string) {
  const origin = window.location.origin
  if (window.location.hostname.endsWith('.github.io')) {
    const repository = window.location.pathname.split('/').filter(Boolean)[0]
    return `${origin}/${repository}/#${path}`
  }
  return `${origin}${path}`
}

function notConfigured(): AuthResult {
  return { success: false, message: 'A conexão com o Supabase ainda não foi configurada.' }
}

function translateAuthError(message: string) {
  const normalized = message.toLowerCase()
  if (normalized.includes('invalid login credentials')) return 'E-mail ou senha incorretos.'
  if (normalized.includes('email not confirmed')) return 'Confirme seu e-mail antes de entrar.'
  if (normalized.includes('user already registered')) return 'Já existe uma conta com este e-mail.'
  if (normalized.includes('password should be')) return 'A senha não atende aos requisitos mínimos.'
  if (normalized.includes('rate limit') || normalized.includes('over_email_send_rate_limit')) return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.'
  if (normalized.includes('expired') || normalized.includes('invalid token')) return 'Este link expirou ou já foi utilizado.'
  if (normalized.includes('network') || normalized.includes('fetch')) return 'Não foi possível conectar ao servidor. Verifique sua internet.'
  return 'Não foi possível concluir a solicitação. Tente novamente.'
}
