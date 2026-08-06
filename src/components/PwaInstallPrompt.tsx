import { Download, X } from 'lucide-react'
import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

export function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      event.preventDefault()
      setInstallEvent(event as BeforeInstallPromptEvent)
      setVisible(true)
    }
    const onInstalled = () => {
      setVisible(false)
      setInstallEvent(null)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (!visible || !installEvent) return null

  async function install() {
    await installEvent?.prompt()
    const choice = await installEvent?.userChoice
    if (choice?.outcome === 'accepted') setVisible(false)
  }

  return <aside className="pwa-install-prompt" role="dialog" aria-label="Instalar MOVELYA">
    <span className="pwa-install-prompt__icon"><img src={`${import.meta.env.BASE_URL}icon-192.png`} alt="" /></span>
    <div><strong>Leve o MOVELYA com você</strong><p>Instale o app para abrir mais rápido e acompanhar sua rotina.</p></div>
    <button className="pwa-install-prompt__action" onClick={() => void install()}><Download size={15} /> Instalar</button>
    <button className="pwa-install-prompt__close" onClick={() => setVisible(false)} aria-label="Fechar convite"><X size={15} /></button>
  </aside>
}
