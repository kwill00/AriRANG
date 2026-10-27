import { useLanguage, useT } from '../lib/locale'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { permits } from '../lib/privacy'
import { revokePush } from '../lib/pushPrivacy'

type Aviso = { id: string; leida: boolean; creado_en: string }
export default function AvisosSociales({ onVerComunidad }: { onVerComunidad: () => void }) {
  const t = useT()
  const language = useLanguage()
  const [avisos, setAvisos] = useState<Aviso[]>([])
  const [error, setError] = useState('')
  const [abierto, setAbierto] = useState(false)
  const [revision, setRevision] = useState(0)
  const [mensajePush, setMensajePush] = useState('')
  const [configurandoPush, setConfigurandoPush] = useState(false)
  useEffect(() => {
    let activo = true
    async function cargar() {
      const { data, error } = await supabase.from('social_notificaciones').select('id,leida,creado_en').order('creado_en', { ascending: false }).order('id', { ascending: false }).limit(20)
      if (activo) { if (error) setError(t("No se pudieron cargar tus avisos.")); else { setError(''); setAvisos(data ?? []) } }
    }
    void cargar()
    const timer = window.setInterval(() => void cargar(), 30000)
    return () => { activo = false; window.clearInterval(timer) }
  }, [revision, t])
  async function leer(id: string) {
    const { error } = await supabase.from('social_notificaciones').update({ leida: true }).eq('id', id)
    if (error) { setError(t("No se pudo marcar el aviso.")); return }
    setRevision(v => v + 1); onVerComunidad()
  }
  async function activarPush() {
    if (configurandoPush) return
    setConfigurandoPush(true)
    let pendingSubscription: PushSubscription | null = null
    try {
      if (!permits('push')) throw new Error('Primero permití push desde Configurar privacidad. Podés rechazarlo y seguir usando la app.')
      const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
      if (ios && !window.matchMedia('(display-mode: standalone)').matches && !(navigator as Navigator & { standalone?: boolean }).standalone) throw new Error('En iPhone o iPad, agregá ARMY Travel a Inicio desde Compartir en Safari. Abrí su ícono y volvé a activar los avisos.')
      if (!window.isSecureContext) throw new Error('Las notificaciones requieren un sitio HTTPS.')
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) throw new Error('Este navegador no permite notificaciones push.')
      const clave = import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY
      if (!clave) throw new Error('El envío push todavía necesita su configuración de servidor.')
      const permiso = await Notification.requestPermission()
      if (permiso !== 'granted') throw new Error('Las notificaciones no están autorizadas en este dispositivo.')
      if (!permits('push')) throw new Error('Primero permití push desde Configurar privacidad. Podés rechazarlo y seguir usando la app.')
      const registro = await navigator.serviceWorker.register('/social-push-sw.js')
      await navigator.serviceWorker.ready
      const base = clave.replace(/-/g, '+').replace(/_/g, '/')
      const decoded = atob(base.padEnd(Math.ceil(base.length / 4) * 4, '='))
      const bytes = Uint8Array.from(decoded, c => c.charCodeAt(0))
      const subscripcion = await registro.pushManager.getSubscription() ?? await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes })
      pendingSubscription = subscripcion
      if (!permits('push')) throw new Error('Primero permití push desde Configurar privacidad. Podés rechazarlo y seguir usando la app.')
      const datos = subscripcion.toJSON()
      const { error } = await supabase.rpc('social_guardar_push', { p_endpoint: datos.endpoint, p_p256dh: datos.keys?.p256dh, p_auth: datos.keys?.auth })
      if (error) throw new Error('No se pudo registrar el dispositivo para recibir avisos.')
      pendingSubscription = null
      setMensajePush(t("Dispositivo registrado para recibir avisos de nuevas publicaciones."))
    } catch (error) { await pendingSubscription?.unsubscribe().catch(() => false); setMensajePush(error instanceof Error ? t(error.message) : t("No se pudo activar push.")) } finally { setConfigurandoPush(false) }
  }
  async function desactivarPush() {
    if (configurandoPush) return
    setConfigurandoPush(true)
    try {
      await revokePush()
      setMensajePush(t("Notificaciones desactivadas en este dispositivo."))
    } catch { setMensajePush(t("No se pudo desactivar el dispositivo. Intentá nuevamente.")) } finally { setConfigurandoPush(false) }
  }
  return <section className="comunidad avisos-sociales" aria-label={t("Avisos de cuentas seguidas")}>
    <button type="button" aria-expanded={abierto} onClick={() => setAbierto(v => !v)}>{t("🔔 Avisos (")}{avisos.filter(a => !a.leida).length}{t("sin leer entre los últimos 20)")}</button>
    {abierto && <div className="comunidad-tarjeta"><p>{t("Publicaciones de las cuentas que seguís. Los avisos se actualizan cada 30 segundos.")}</p>
      {avisos.length === 0 && <p>{t("No tenés avisos para mostrar.")}</p>}
      {avisos.map(a => <p key={a.id}><button type="button" onClick={() => void leer(a.id)}>{a.leida ? 'Visto' : 'Nuevo'}{t("· Una cuenta que seguís publicó ·")}{' '}{new Date(a.creado_en).toLocaleString(language)}</button></p>)}
      <button type="button" disabled={configurandoPush} onClick={() => void activarPush()}>{t("Activar push en este dispositivo")}</button>
      <button type="button" disabled={configurandoPush} onClick={() => void desactivarPush()}>{t("Desactivar push en este dispositivo")}</button>
      {mensajePush && <p role="status">{t(mensajePush)}</p>}
    </div>}{error && <p role="status">{t(error)}</p>}
  </section>
}
