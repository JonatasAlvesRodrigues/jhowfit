import { Send, Sparkles } from 'lucide-react'
import { BottomNav, Sidebar } from './components/Navigation'
import { Header } from './components/Header'
import { Button, ErrorMessage, Field, LoadingState, Modal } from './components/ui'
import { useApp } from './contexts/AppContext'
import { useFitnessData } from './hooks/useFitnessData'
import { Dashboard } from './pages/Dashboard'
import { Workouts } from './pages/Workouts'
import { Nutrition } from './pages/Nutrition'
import { ProgressPage } from './pages/ProgressPage'
import { MorePage } from './pages/MorePage'

export default function App() {
  const { page, modal, closeModal } = useApp()
  const data = useFitnessData()

  function renderPage() {
    if (!data.stats || data.loading) return <LoadingState />
    if (data.error) return <ErrorMessage message={data.error} />
    if (page === 'treinos') return <Workouts workouts={data.workouts} toggleWorkout={data.toggleWorkout} />
    if (page === 'nutricao') return <Nutrition meals={data.meals} />
    if (page === 'progresso') return <ProgressPage weight={data.weight} />
    if (page === 'mais') return <MorePage />
    return <Dashboard stats={data.stats} workouts={data.workouts} addWater={data.addWater} />
  }

  return <div className="app-shell">
    <Sidebar />
    <div className="app-main"><Header/><main>{renderPage()}</main></div>
    <BottomNav />
    {modal === 'quick' && <Modal title="Registro rápido" onClose={closeModal}>
      <div className="quick-options">
        <button onClick={data.addWater}><span>💧</span><strong>Água</strong><small>+ 250 ml</small></button>
        <button><span>🍽️</span><strong>Refeição</strong><small>Registrar agora</small></button>
        <button><span>⚖️</span><strong>Peso</strong><small>Nova medida</small></button>
        <button><span>🏃</span><strong>Atividade</strong><small>Corrida ou caminhada</small></button>
      </div>
      <Button className="modal-close-button" variant="secondary" onClick={closeModal}>Concluir</Button>
    </Modal>}
    {modal === 'ai' && <Modal title="Coach Jhow IA" onClose={closeModal}>
      <div className="ai-intro"><span><Sparkles size={24}/></span><p>Olá, João! Como posso ajudar na sua evolução hoje?</p></div>
      <div className="ai-suggestions"><button>Monte um treino rápido</button><button>Analise minha alimentação</button><button>Como melhorar meu sono?</button></div>
      <div className="ai-input"><Field label="Sua mensagem" placeholder="Pergunte qualquer coisa..."/><Button aria-label="Enviar"><Send size={18}/></Button></div>
    </Modal>}
  </div>
}
