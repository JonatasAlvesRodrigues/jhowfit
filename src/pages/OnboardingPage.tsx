import { useState, type ReactNode } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Dumbbell,
  HeartPulse,
  LoaderCircle,
  MapPin,
  Salad,
  ShieldAlert,
  Sparkles,
  UserRound,
} from 'lucide-react'
import { VitaLogo } from '../components/VitaNavigation'
import { onboardingService } from '../services/onboardingService'
import { emptyOnboardingData, type OnboardingData, type SafetyAnswer } from '../types/onboarding'
import {
  dietOptions,
  equipmentOptions,
  experienceOptions,
  goalOptions,
  locationOptions,
  restrictionOptions,
  weekDays,
} from '../utils/onboardingOptions'

const steps = [
  { title: 'Informações básicas', short: 'Você', icon: UserRound },
  { title: 'Seu objetivo', short: 'Objetivo', icon: Sparkles },
  { title: 'Experiência', short: 'Nível', icon: Dumbbell },
  { title: 'Disponibilidade', short: 'Agenda', icon: HeartPulse },
  { title: 'Local e equipamentos', short: 'Estrutura', icon: MapPin },
  { title: 'Alimentação', short: 'Dieta', icon: Salad },
  { title: 'Segurança', short: 'Saúde', icon: ShieldAlert },
] as const

export function OnboardingPage({ userId, initialName, onComplete }: { userId: string; initialName: string; onComplete: () => void }) {
  const [currentStep, setCurrentStep] = useState(0)
  const [data, setData] = useState<OnboardingData>({ ...emptyOnboardingData, name: initialName })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const progress = ((currentStep + 1) / steps.length) * 100
  const StepIcon = steps[currentStep].icon

  function update<K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) {
    setData((current) => ({ ...current, [key]: value }))
    setError('')
  }

  function toggleList(key: 'availableDays' | 'trainingLocations' | 'equipment' | 'dietaryPreferences' | 'dietaryRestrictions', value: string) {
    const current = data[key]
    update(key, current.includes(value) ? current.filter((item) => item !== value) : [...current, value])
  }

  function next() {
    const validation = validateStep(currentStep, data)
    if (validation) return setError(validation)
    setError('')
    setCurrentStep((step) => Math.min(step + 1, steps.length - 1))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function back() {
    setError('')
    setCurrentStep((step) => Math.max(step - 1, 0))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function finish() {
    const validation = validateStep(currentStep, data)
    if (validation) return setError(validation)
    setSaving(true)
    setError('')
    try {
      await onboardingService.save(userId, data)
      onComplete()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível concluir sua configuração.')
      setSaving(false)
    }
  }

  return (
    <div className="onboarding-shell">
      <header className="onboarding-header">
        <VitaLogo />
        <span>Configuração inicial</span>
      </header>
      <div className="onboarding-layout">
        <aside className="onboarding-steps">
          <div className="onboarding-steps__intro"><small>SEU PERFIL</small><h2>Vamos personalizar o VitaFit.</h2><p>Suas respostas ajudam a preparar uma experiência mais adequada à sua rotina.</p></div>
          <nav aria-label="Etapas do questionário">
            {steps.map(({ title, short, icon: Icon }, index) => (
              <div key={title} className={`${index === currentStep ? 'is-active' : ''} ${index < currentStep ? 'is-complete' : ''}`}>
                <span>{index < currentStep ? <Check size={15} /> : <Icon size={16} />}</span>
                <div><small>ETAPA {index + 1}</small><strong>{short}</strong></div>
              </div>
            ))}
          </nav>
        </aside>

        <main className="onboarding-main">
          <div className="onboarding-progress-mobile">
            <div><span>Etapa {currentStep + 1} de {steps.length}</span><strong>{Math.round(progress)}%</strong></div>
            <div className="onboarding-progress-track"><i style={{ width: `${progress}%` }} /></div>
          </div>

          <section className="onboarding-card">
            <div className="onboarding-card__heading">
              <span className="onboarding-step-icon"><StepIcon size={22} /></span>
              <div><small>ETAPA {currentStep + 1} DE {steps.length}</small><h1>{steps[currentStep].title}</h1><p>{stepDescriptions[currentStep]}</p></div>
            </div>

            {error && <div className="onboarding-error" role="alert">{error}</div>}

            <div className="onboarding-fields">
              {currentStep === 0 && <BasicStep data={data} update={update} />}
              {currentStep === 1 && <ChoiceCards value={data.goal} onChange={(value) => update('goal', value)} options={goalOptions} />}
              {currentStep === 2 && <ChoiceCards value={data.experienceLevel} onChange={(value) => update('experienceLevel', value)} options={experienceOptions} />}
              {currentStep === 3 && <AvailabilityStep data={data} update={update} toggle={(value) => toggleList('availableDays', value)} />}
              {currentStep === 4 && <LocationStep data={data} toggleList={toggleList} />}
              {currentStep === 5 && <NutritionStep data={data} update={update} toggleList={toggleList} />}
              {currentStep === 6 && <SafetyStep data={data} update={update} />}
            </div>

            <footer className="onboarding-actions">
              <button className="onboarding-back" onClick={back} disabled={currentStep === 0 || saving}><ArrowLeft size={17} /> Voltar</button>
              {currentStep < steps.length - 1
                ? <button className="onboarding-next" onClick={next}>Continuar <ArrowRight size={17} /></button>
                : <button className="onboarding-next" onClick={finish} disabled={saving}>{saving ? <><LoaderCircle className="spin" size={18} /> Salvando...</> : <>Concluir configuração <Check size={17} /></>}</button>}
            </footer>
          </section>
        </main>
      </div>
    </div>
  )
}

const stepDescriptions = [
  'Comece com os dados que nos ajudam a entender seu ponto de partida.',
  'Qual resultado é mais importante para você neste momento?',
  'Como você descreve sua experiência atual com exercícios?',
  'Encaixe os treinos na sua vida, e não o contrário.',
  'Conte onde pretende treinar e o que terá à disposição.',
  'Essas informações ajudam a adaptar futuras sugestões de refeições.',
  'Sua segurança vem primeiro. Responda com atenção.',
]

type Update = <K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) => void

function BasicStep({ data, update }: { data: OnboardingData; update: Update }) {
  return <div className="onboarding-form-grid">
    <OnboardingField label="Nome" className="is-wide"><input value={data.name} onChange={(event) => update('name', event.target.value)} autoComplete="name" placeholder="Seu nome completo" /></OnboardingField>
    <OnboardingField label="Data de nascimento"><input type="date" max={new Date().toISOString().slice(0, 10)} value={data.birthDate} onChange={(event) => update('birthDate', event.target.value)} /></OnboardingField>
    <OnboardingField label="Sexo (opcional)"><select value={data.gender} onChange={(event) => update('gender', event.target.value)}><option value="">Prefiro não informar</option><option value="female">Feminino</option><option value="male">Masculino</option><option value="non-binary">Não binário</option><option value="other">Outro</option></select></OnboardingField>
    <OnboardingField label="Altura"><div className="unit-input"><input type="number" inputMode="decimal" min="80" max="250" value={data.heightCm} onChange={(event) => update('heightCm', event.target.value)} placeholder="175" /><span>cm</span></div></OnboardingField>
    <OnboardingField label="Peso atual"><div className="unit-input"><input type="number" inputMode="decimal" min="25" max="400" step=".1" value={data.currentWeight} onChange={(event) => update('currentWeight', event.target.value)} placeholder="75,0" /><span>kg</span></div></OnboardingField>
  </div>
}

function ChoiceCards({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: readonly (readonly [string, string, string])[] }) {
  return <div className="onboarding-choice-cards">{options.map(([id, title, description]) => <button key={id} className={value === id ? 'is-selected' : ''} onClick={() => onChange(id)}><span className="choice-radio">{value === id && <i />}</span><div><strong>{title}</strong><small>{description}</small></div></button>)}</div>
}

function AvailabilityStep({ data, update, toggle }: { data: OnboardingData; update: Update; toggle: (value: string) => void }) {
  return <div className="onboarding-form-grid">
    <OnboardingField label="Dias de treino por semana"><select value={data.trainingDaysPerWeek} onChange={(event) => update('trainingDaysPerWeek', event.target.value)}><option value="">Selecione</option>{[1,2,3,4,5,6,7].map((value) => <option key={value} value={value}>{value} {value === 1 ? 'dia' : 'dias'}</option>)}</select></OnboardingField>
    <OnboardingField label="Duração média"><select value={data.averageDurationMinutes} onChange={(event) => update('averageDurationMinutes', event.target.value)}><option value="">Selecione</option><option value="20">20 minutos</option><option value="30">30 minutos</option><option value="45">45 minutos</option><option value="60">1 hora</option><option value="90">1h30</option><option value="120">2 horas</option></select></OnboardingField>
    <OnboardingField label="Horário preferido" className="is-wide"><div className="onboarding-segments">{[['morning','Manhã'],['afternoon','Tarde'],['evening','Noite'],['flexible','Flexível']].map(([id,label]) => <button key={id} className={data.preferredTime === id ? 'is-selected' : ''} onClick={() => update('preferredTime', id)}>{label}</button>)}</div></OnboardingField>
    <OnboardingField label="Dias disponíveis" className="is-wide"><div className="weekday-picker">{weekDays.map(([id,label]) => <button key={id} className={data.availableDays.includes(id) ? 'is-selected' : ''} onClick={() => toggle(id)}>{label}</button>)}</div></OnboardingField>
  </div>
}

function LocationStep({ data, toggleList }: { data: OnboardingData; toggleList: (key: 'trainingLocations' | 'equipment', value: string) => void }) {
  return <div className="onboarding-stack">
    <OnboardingField label="Onde você pretende treinar?"><div className="selection-grid">{locationOptions.map(([id,label]) => <button key={id} className={data.trainingLocations.includes(id) ? 'is-selected' : ''} onClick={() => toggleList('trainingLocations', id)}><MapPin size={17} />{label}</button>)}</div></OnboardingField>
    <OnboardingField label="Equipamentos disponíveis"><ChipPicker options={equipmentOptions} selected={data.equipment} onToggle={(value) => toggleList('equipment', value)} /></OnboardingField>
  </div>
}

function NutritionStep({ data, update, toggleList }: { data: OnboardingData; update: Update; toggleList: (key: 'dietaryPreferences' | 'dietaryRestrictions', value: string) => void }) {
  return <div className="onboarding-form-grid">
    <OnboardingField label="Refeições por dia"><select value={data.mealsPerDay} onChange={(event) => update('mealsPerDay', event.target.value)}><option value="">Selecione</option>{[1,2,3,4,5,6].map((value) => <option value={value} key={value}>{value} refeições</option>)}</select></OnboardingField>
    <OnboardingField label="Orçamento mensal aproximado"><div className="unit-input is-prefix"><span>R$</span><input type="number" min="0" step="50" value={data.monthlyFoodBudget} onChange={(event) => update('monthlyFoodBudget', event.target.value)} placeholder="Opcional" /></div></OnboardingField>
    <OnboardingField label="Preferências alimentares" className="is-wide"><ChipPicker options={dietOptions} selected={data.dietaryPreferences} onToggle={(value) => toggleList('dietaryPreferences', value)} /></OnboardingField>
    <OnboardingField label="Restrições alimentares" className="is-wide"><ChipPicker options={restrictionOptions} selected={data.dietaryRestrictions} onToggle={(value) => toggleList('dietaryRestrictions', value)} /></OnboardingField>
    <OnboardingField label="Alimentos que não consome"><textarea value={data.avoidedFoods} onChange={(event) => update('avoidedFoods', event.target.value)} placeholder="Ex.: peixe, brócolis..." /></OnboardingField>
    <OnboardingField label="Alergias"><textarea value={data.allergies} onChange={(event) => update('allergies', event.target.value)} placeholder="Informe alergias ou deixe em branco" /></OnboardingField>
  </div>
}

function SafetyStep({ data, update }: { data: OnboardingData; update: Update }) {
  const safetyItems: { key: 'injuries' | 'pain' | 'physicalLimitations' | 'healthConditions' | 'medication'; label: string; placeholder: string }[] = [
    { key: 'injuries', label: 'Possui alguma lesão?', placeholder: 'Descreva a lesão e a região afetada' },
    { key: 'pain', label: 'Sente dores recorrentes?', placeholder: 'Onde e com qual frequência?' },
    { key: 'physicalLimitations', label: 'Possui limitações físicas?', placeholder: 'Conte quais movimentos exigem cuidado' },
    { key: 'healthConditions', label: 'Possui condições de saúde?', placeholder: 'Informe apenas o que for relevante' },
    { key: 'medication', label: 'Faz uso de medicamentos?', placeholder: 'Quais medicamentos?' },
  ]
  return <div className="onboarding-stack">
    <div className="medical-notice"><ShieldAlert size={21} /><p><strong>Sua segurança é prioridade.</strong><span>O VitaFit não substitui acompanhamento médico, nutricional, fisioterapêutico ou de um profissional de educação física. Consulte um profissional antes de iniciar mudanças relevantes.</span></p></div>
    <div className="safety-list">{safetyItems.map((item) => <SafetyQuestion key={item.key} label={item.label} placeholder={item.placeholder} answer={data[item.key]} onChange={(answer) => update(item.key, answer)} />)}</div>
    <OnboardingField label="Gravidez"><div className="onboarding-segments pregnancy-options">{[['not-applicable','Não se aplica'],['no','Não'],['yes','Sim'],['prefer-not','Prefiro não informar']].map(([id,label]) => <button key={id} className={data.pregnancyStatus === id ? 'is-selected' : ''} onClick={() => update('pregnancyStatus', id)}>{label}</button>)}</div></OnboardingField>
  </div>
}

function SafetyQuestion({ label, placeholder, answer, onChange }: { label: string; placeholder: string; answer: SafetyAnswer; onChange: (answer: SafetyAnswer) => void }) {
  return <div className="safety-question"><div><strong>{label}</strong><div className="yes-no"><button className={!answer.value ? 'is-selected' : ''} onClick={() => onChange({ value: false, details: '' })}>Não</button><button className={answer.value ? 'is-selected' : ''} onClick={() => onChange({ ...answer, value: true })}>Sim</button></div></div>{answer.value && <textarea autoFocus value={answer.details} onChange={(event) => onChange({ ...answer, details: event.target.value })} placeholder={placeholder} />}</div>
}

function ChipPicker({ options, selected, onToggle }: { options: readonly string[]; selected: string[]; onToggle: (value: string) => void }) {
  return <div className="chip-picker">{options.map((option) => <button key={option} className={selected.includes(option) ? 'is-selected' : ''} onClick={() => onToggle(option)}>{selected.includes(option) && <Check size={13} />}{option}</button>)}</div>
}

function OnboardingField({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return <label className={`onboarding-field ${className}`}><span>{label}</span>{children}</label>
}

function validateStep(step: number, data: OnboardingData) {
  if (step === 0) {
    if (data.name.trim().length < 2) return 'Informe seu nome.'
    if (!data.birthDate) return 'Informe sua data de nascimento.'
    if (new Date(data.birthDate) >= new Date()) return 'Informe uma data de nascimento válida.'
    const height = Number(data.heightCm)
    if (!height || height < 80 || height > 250) return 'Informe uma altura entre 80 e 250 cm.'
    const weight = Number(data.currentWeight)
    if (!weight || weight < 25 || weight > 400) return 'Informe um peso entre 25 e 400 kg.'
  }
  if (step === 1 && !data.goal) return 'Selecione seu objetivo principal.'
  if (step === 2 && !data.experienceLevel) return 'Selecione seu nível de experiência.'
  if (step === 3) {
    if (!data.trainingDaysPerWeek) return 'Informe quantos dias pode treinar.'
    if (!data.averageDurationMinutes) return 'Selecione a duração média disponível.'
    if (!data.preferredTime) return 'Selecione seu horário preferido.'
    if (data.availableDays.length < Number(data.trainingDaysPerWeek)) return 'Selecione ao menos a quantidade de dias que pretende treinar.'
  }
  if (step === 4 && !data.trainingLocations.length) return 'Selecione pelo menos um local de treino.'
  if (step === 4 && !data.equipment.length) return 'Selecione os equipamentos disponíveis ou “Nenhum”.'
  if (step === 5) {
    if (!data.mealsPerDay) return 'Informe a quantidade de refeições.'
    if (!data.dietaryPreferences.length) return 'Selecione uma preferência alimentar.'
    if (!data.dietaryRestrictions.length) return 'Selecione uma restrição ou “Nenhuma”.'
  }
  if (step === 6) {
    const details = [data.injuries, data.pain, data.physicalLimitations, data.healthConditions, data.medication]
    if (details.some((answer) => answer.value && answer.details.trim().length < 3)) return 'Descreva os itens de saúde marcados como “Sim”.'
    if (!data.pregnancyStatus) return 'Selecione uma opção sobre gravidez.'
  }
  return ''
}
