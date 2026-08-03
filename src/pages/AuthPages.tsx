import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  Mail,
  MailCheck,
  UserRound,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import type { RouteId } from '../types/navigation'
import { VitaLogo } from '../components/VitaNavigation'

interface AuthPageProps {
  routeId: RouteId
  navigate: (path: string) => void
}

export function AuthPage({ routeId, navigate }: AuthPageProps) {
  return (
    <div className="auth-layout">
      <aside className="auth-story">
        <VitaLogo />
        <div className="auth-story__content">
          <span>EVOLUA COM PROPÓSITO</span>
          <h2>Seu bem-estar começa com um passo.</h2>
          <p>Treinos, alimentação e evolução reunidos em uma experiência simples e pessoal.</p>
        </div>
        <small>VitaFit · Sua jornada, no seu ritmo.</small>
      </aside>
      <main className="auth-main">
        <div className="auth-mobile-logo"><VitaLogo /></div>
        {routeId === 'entrar' && <LoginForm navigate={navigate} />}
        {routeId === 'criar-conta' && <SignUpForm navigate={navigate} />}
        {routeId === 'esqueci-senha' && <ForgotPasswordForm navigate={navigate} />}
        {routeId === 'redefinir-senha' && <ResetPasswordForm navigate={navigate} />}
        {routeId === 'confirmar-email' && <ConfirmEmailPage navigate={navigate} />}
      </main>
    </div>
  )
}

function LoginForm({ navigate }: Pick<AuthPageProps, 'navigate'>) {
  const { login, sessionMessage, clearSessionMessage, configured } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    clearSessionMessage()
    const validation = validateEmail(email) || (!password ? 'Informe sua senha.' : '')
    if (validation) return setError(validation)
    setLoading(true)
    setError('')
    const result = await login(email.trim(), password)
    setLoading(false)
    if (!result.success) return setError(result.message ?? '')
    navigate('/inicio')
  }

  return (
    <AuthCard
      eyebrow="BEM-VINDO DE VOLTA"
      title="Entre na sua conta"
      description="Continue sua evolução de onde parou."
    >
      {!configured && <AuthAlert type="error">A conexão com o Supabase não está disponível neste ambiente.</AuthAlert>}
      {sessionMessage && <AuthAlert>{sessionMessage}</AuthAlert>}
      {error && <AuthAlert type="error">{error}</AuthAlert>}
      <form className="auth-form" onSubmit={submit} noValidate>
        <AuthInput label="E-mail" type="email" value={email} onChange={setEmail} placeholder="voce@exemplo.com" icon={<Mail size={17} />} autoComplete="email" />
        <PasswordInput label="Senha" value={password} onChange={setPassword} autoComplete="current-password" />
        <button type="button" className="auth-text-button auth-forgot" onClick={() => navigate('/esqueci-senha')}>Esqueci minha senha</button>
        <SubmitButton loading={loading}>Entrar <ArrowRight size={17} /></SubmitButton>
      </form>
      <AuthDivider />
      <p className="auth-switch">Ainda não tem uma conta? <button onClick={() => navigate('/criar-conta')}>Criar conta</button></p>
    </AuthCard>
  )
}

function SignUpForm({ navigate }: Pick<AuthPageProps, 'navigate'>) {
  const { signUp } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [terms, setTerms] = useState(false)
  const [privacy, setPrivacy] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const validation = validateSignUp({ name, email, password, confirmPassword, terms, privacy })
    if (validation) return setError(validation)
    setLoading(true)
    setError('')
    const result = await signUp({ name: name.trim(), email: email.trim(), password })
    setLoading(false)
    if (!result.success) return setError(result.message ?? '')
    sessionStorage.setItem('vitafit.pendingEmail', email.trim())
    navigate(result.requiresEmailConfirmation ? '/confirmar-email' : '/inicio')
  }

  return (
    <AuthCard eyebrow="SUA JORNADA COMEÇA AQUI" title="Crie sua conta" description="Leva menos de um minuto.">
      {error && <AuthAlert type="error">{error}</AuthAlert>}
      <form className="auth-form" onSubmit={submit} noValidate>
        <AuthInput label="Nome" value={name} onChange={setName} placeholder="Como podemos chamar você?" icon={<UserRound size={17} />} autoComplete="name" />
        <AuthInput label="E-mail" type="email" value={email} onChange={setEmail} placeholder="voce@exemplo.com" icon={<Mail size={17} />} autoComplete="email" />
        <PasswordInput label="Senha" value={password} onChange={setPassword} autoComplete="new-password" hint="Mínimo de 8 caracteres, com letra maiúscula e número." />
        <PasswordInput label="Confirmar senha" value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" />
        <div className="auth-checks">
          <AuthCheckbox checked={terms} onChange={setTerms}>Li e aceito os <a href="#termos" onClick={(event) => event.preventDefault()}>Termos de Uso</a>.</AuthCheckbox>
          <AuthCheckbox checked={privacy} onChange={setPrivacy}>Li e aceito a <a href="#privacidade" onClick={(event) => event.preventDefault()}>Política de Privacidade</a>.</AuthCheckbox>
        </div>
        <SubmitButton loading={loading}>Criar minha conta <ArrowRight size={17} /></SubmitButton>
      </form>
      <AuthDivider />
      <p className="auth-switch">Já possui uma conta? <button onClick={() => navigate('/entrar')}>Entrar</button></p>
    </AuthCard>
  )
}

function ForgotPasswordForm({ navigate }: Pick<AuthPageProps, 'navigate'>) {
  const { recoverPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const validation = validateEmail(email)
    if (validation) return setError(validation)
    setLoading(true)
    setError('')
    const result = await recoverPassword(email.trim())
    setLoading(false)
    if (!result.success) return setError(result.message ?? '')
    setSent(true)
  }

  if (sent) {
    return <AuthStatus icon={<MailCheck size={29} />} eyebrow="E-MAIL ENVIADO" title="Confira sua caixa de entrada" description={`Enviamos as instruções de recuperação para ${email}.`} actionLabel="Voltar para entrar" onAction={() => navigate('/entrar')} />
  }

  return (
    <AuthCard eyebrow="RECUPERAR ACESSO" title="Esqueceu sua senha?" description="Informe seu e-mail e enviaremos um link seguro.">
      {error && <AuthAlert type="error">{error}</AuthAlert>}
      <form className="auth-form" onSubmit={submit} noValidate>
        <AuthInput label="E-mail" type="email" value={email} onChange={setEmail} placeholder="voce@exemplo.com" icon={<Mail size={17} />} autoComplete="email" />
        <SubmitButton loading={loading}>Enviar link de recuperação <ArrowRight size={17} /></SubmitButton>
      </form>
      <button className="auth-back" onClick={() => navigate('/entrar')}><ArrowLeft size={16} /> Voltar para entrar</button>
    </AuthCard>
  )
}

function ResetPasswordForm({ navigate }: Pick<AuthPageProps, 'navigate'>) {
  const { updatePassword, session, recoveryMode } = useAuth()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const validation = validatePassword(password) || (password !== confirmPassword ? 'As senhas não coincidem.' : '')
    if (validation) return setError(validation)
    setLoading(true)
    setError('')
    const result = await updatePassword(password)
    setLoading(false)
    if (!result.success) return setError(result.message ?? '')
    setDone(true)
  }

  if (!session && !recoveryMode) {
    return <AuthStatus icon={<KeyRound size={29} />} eyebrow="LINK INVÁLIDO" title="Solicite um novo link" description="Este link de recuperação expirou ou já foi utilizado." actionLabel="Recuperar senha" onAction={() => navigate('/esqueci-senha')} />
  }

  if (done) {
    return <AuthStatus icon={<Check size={29} />} eyebrow="SENHA ATUALIZADA" title="Tudo certo!" description="Sua nova senha já está ativa. Você pode continuar no VitaFit." actionLabel="Ir para o início" onAction={() => navigate('/inicio')} />
  }

  return (
    <AuthCard eyebrow="PROTEJA SUA CONTA" title="Crie uma nova senha" description="Escolha uma senha forte e diferente das anteriores.">
      {error && <AuthAlert type="error">{error}</AuthAlert>}
      <form className="auth-form" onSubmit={submit} noValidate>
        <PasswordInput label="Nova senha" value={password} onChange={setPassword} autoComplete="new-password" hint="Mínimo de 8 caracteres, com letra maiúscula e número." />
        <PasswordInput label="Confirmar nova senha" value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" />
        <SubmitButton loading={loading}>Salvar nova senha <Check size={17} /></SubmitButton>
      </form>
    </AuthCard>
  )
}

function ConfirmEmailPage({ navigate }: Pick<AuthPageProps, 'navigate'>) {
  const { user, resendConfirmation } = useAuth()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const email = user?.email ?? (typeof window !== 'undefined' ? sessionStorage.getItem('vitafit.pendingEmail') : '') ?? ''
  const confirmed = Boolean(user?.email_confirmed_at)

  useEffect(() => {
    if (!confirmed) return
    const timer = setTimeout(() => navigate('/inicio'), 1800)
    return () => clearTimeout(timer)
  }, [confirmed, navigate])

  async function resend() {
    if (!email) return setMessage('Volte ao cadastro e informe seu e-mail novamente.')
    setLoading(true)
    const result = await resendConfirmation(email)
    setLoading(false)
    setMessage(result.success ? 'Um novo e-mail de confirmação foi enviado.' : result.message ?? '')
  }

  return (
    <AuthStatus
      icon={confirmed ? <Check size={29} /> : <MailCheck size={29} />}
      eyebrow={confirmed ? 'E-MAIL CONFIRMADO' : 'VERIFIQUE SEU E-MAIL'}
      title={confirmed ? 'Conta confirmada!' : 'Falta só confirmar seu e-mail'}
      description={confirmed ? 'Você será direcionado ao VitaFit em instantes.' : `Enviamos um link de confirmação para ${email || 'o endereço informado'}.`}
      actionLabel={confirmed ? 'Ir para o início' : loading ? 'Enviando...' : 'Reenviar e-mail'}
      onAction={confirmed ? () => navigate('/inicio') : resend}
      secondaryLabel={confirmed ? undefined : 'Voltar para entrar'}
      onSecondary={() => navigate('/entrar')}
      message={message}
    />
  )
}

function AuthCard({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: ReactNode }) {
  return (
    <section className="auth-card">
      <div className="auth-card__heading"><span>{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>
      {children}
    </section>
  )
}

function AuthInput({ label, value, onChange, icon, ...props }: { label: string; value: string; onChange: (value: string) => void; icon: ReactNode } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  return <label className="auth-field"><span>{label}</span><div>{icon}<input {...props} value={value} onChange={(event) => onChange(event.target.value)} /></div></label>
}

function PasswordInput({ label, value, onChange, hint, autoComplete }: { label: string; value: string; onChange: (value: string) => void; hint?: string; autoComplete: string }) {
  const [visible, setVisible] = useState(false)
  return (
    <label className="auth-field">
      <span>{label}</span>
      <div><LockKeyhole size={17} /><input type={visible ? 'text' : 'password'} value={value} onChange={(event) => onChange(event.target.value)} autoComplete={autoComplete} /><button type="button" onClick={() => setVisible((current) => !current)} aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}>{visible ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
      {hint && <small>{hint}</small>}
    </label>
  )
}

function AuthCheckbox({ checked, onChange, children }: { checked: boolean; onChange: (value: boolean) => void; children: ReactNode }) {
  return <label className="auth-checkbox"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span className="auth-checkbox__box">{checked && <Check size={13} />}</span><span>{children}</span></label>
}

function SubmitButton({ loading, children }: { loading: boolean; children: ReactNode }) {
  return <button className="auth-submit" type="submit" disabled={loading}>{loading ? <><LoaderCircle className="spin" size={18} /> Aguarde...</> : children}</button>
}

function AuthAlert({ children, type = 'info' }: { children: ReactNode; type?: 'info' | 'error' }) {
  return <div className={`auth-alert is-${type}`} role="alert">{children}</div>
}

function AuthDivider() {
  return <div className="auth-divider"><span /></div>
}

function AuthStatus({ icon, eyebrow, title, description, actionLabel, onAction, secondaryLabel, onSecondary, message }: { icon: ReactNode; eyebrow: string; title: string; description: string; actionLabel: string; onAction: () => void; secondaryLabel?: string; onSecondary?: () => void; message?: string }) {
  return (
    <section className="auth-card auth-status">
      <span className="auth-status__icon">{icon}</span>
      <div className="auth-card__heading"><span>{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>
      {message && <AuthAlert>{message}</AuthAlert>}
      <button className="auth-submit" onClick={onAction}>{actionLabel}</button>
      {secondaryLabel && <button className="auth-back" onClick={onSecondary}><ArrowLeft size={16} /> {secondaryLabel}</button>}
    </section>
  )
}

function validateEmail(email: string) {
  if (!email.trim()) return 'Informe seu e-mail.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Informe um e-mail válido.'
  return ''
}

function validatePassword(password: string) {
  if (!password) return 'Informe uma senha.'
  if (password.length < 8) return 'A senha deve ter pelo menos 8 caracteres.'
  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) return 'Use ao menos uma letra maiúscula, uma minúscula e um número.'
  return ''
}

function validateSignUp(input: { name: string; email: string; password: string; confirmPassword: string; terms: boolean; privacy: boolean }) {
  if (input.name.trim().length < 2) return 'Informe seu nome.'
  const emailError = validateEmail(input.email)
  if (emailError) return emailError
  const passwordError = validatePassword(input.password)
  if (passwordError) return passwordError
  if (input.password !== input.confirmPassword) return 'As senhas não coincidem.'
  if (!input.terms) return 'Você precisa aceitar os Termos de Uso.'
  if (!input.privacy) return 'Você precisa aceitar a Política de Privacidade.'
  return ''
}
