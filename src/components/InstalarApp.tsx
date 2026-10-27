import { useT } from '../lib/locale'
import { useEffect, useState } from 'react'

interface InstallPrompt extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function InstalarApp() {
  const t = useT()
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null)
  const [installed, setInstalled] = useState(false)
  const [help, setHelp] = useState(false)
  useEffect(() => {
    const media = window.matchMedia('(display-mode: standalone)')
    const refresh = () => setInstalled(media.matches || !!(navigator as Navigator & { standalone?: boolean }).standalone)
    const offer = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPrompt) }
    const done = () => { setInstalled(true); setPrompt(null) }
    refresh()
    media.addEventListener('change', refresh)
    window.addEventListener('beforeinstallprompt', offer)
    window.addEventListener('appinstalled', done)
    return () => {
      media.removeEventListener('change', refresh)
      window.removeEventListener('beforeinstallprompt', offer)
      window.removeEventListener('appinstalled', done)
    }
  }, [])
  if (installed) return null
  async function install() {
    if (!prompt) { setHelp(v => !v); return }
    await prompt.prompt()
    await prompt.userChoice
    setPrompt(null)
  }
  return <aside className="instalar-app" aria-label={t("Instalar ARMY Travel")}>
    <button type="button" onClick={() => void install()}>{t("💜 Instalar ARMY Travel")}</button>
    {help && <div role="status">
      <p><strong>iPhone o iPad:</strong>{t("abrí esta página en Safari, tocá Compartir y «Agregar a inicio». Luego abrí ARMY Travel desde su ícono.")}</p>
      <p><strong>Android:</strong>{t("abrí el menú de Chrome y elegí «Instalar aplicación» o «Agregar a la pantalla principal».")}</p>
      <p>{t("Las conversaciones y los viajes necesitan conexión. Las notificaciones se activan por separado desde Avisos.")}</p>
    </div>}
  </aside>
}
