import { RefreshCw, X } from 'lucide-react'
import { useEffect, useState } from 'react'

export function PwaUpdatePrompt() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const onUpdate = (event: Event) => {
      const next = (event as CustomEvent<ServiceWorkerRegistration>).detail
      if (next?.waiting) { setRegistration(next); setVisible(true) }
    }
    window.addEventListener('movelya:pwa-update', onUpdate)
    return () => window.removeEventListener('movelya:pwa-update', onUpdate)
  }, [])
  if (!visible || !registration) return null
  return <aside className="pwa-update-prompt" role="status"><span><RefreshCw size={17} /></span><div><strong>Nova versão disponível</strong><p>Atualize para receber as melhorias do MOVELYA.</p></div><button className="pwa-update-prompt__action" onClick={() => registration.waiting?.postMessage({ type: 'SKIP_WAITING' })}>Atualizar</button><button className="pwa-update-prompt__close" onClick={() => setVisible(false)} aria-label="Fechar aviso"><X size={15} /></button></aside>
}
