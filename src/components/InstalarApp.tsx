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
  return <aside className="instalar-app" aria-label={t("Instalar ARMY World")}>
    <button type="button" aria-expanded={help} aria-controls="world-install-help" onClick={() => void install()}><svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"><path d="M12 3v12m-4-4 4 4 4-4M5 16v4h14v-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>{t("Instalar ARMY World")}</button>
    {help && <div id="world-install-help" role="status">
      <p><strong>iPhone o iPad:</strong>{t("abrí esta página en Safari, tocá Compartir y «Agregar a inicio». Luego abrí ARMY World desde su ícono.")}</p>
      <p><strong>Android:</strong>{t("abrí el menú de Chrome y elegí «Instalar aplicación» o «Agregar a la pantalla principal».")}</p>
      <p>{t("Las conversaciones y los viajes necesitan conexión. Las notificaciones se activan por separado desde Avisos.")}</p>
    </div>}
  </aside>
}
