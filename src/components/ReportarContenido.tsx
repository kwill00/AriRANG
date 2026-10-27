import { useT } from '../lib/locale'
import { useId, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function ReportarContenido({ publicacionId, comentarioId }: { publicacionId?: string; comentarioId?: string }) {
  const t = useT()
  const id = useId()
  const [abierto, setAbierto] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [mensaje, setMensaje] = useState('')
  async function enviar() {
    if (ocupado || motivo.trim().length < 10) return
    setOcupado(true); setMensaje('')
    try {
      const { error } = await supabase.rpc('comunidad_reportar', {
        p_publicacion_id: publicacionId ?? null,
        p_comentario_id: comentarioId ?? null,
        p_motivo: motivo.trim(),
      })
      if (error) throw error
      setEnviado(true); setAbierto(false); setMotivo('')
      setMensaje(t("Reporte recibido. El equipo lo revisará."))
    } catch (error) {
      const code = (error as { code?: string })?.code
      setMensaje(code === '23505' ? t("Ya reportaste este contenido.") : code === 'PGRST202' ? t("Los reportes todavía necesitan la migración de moderación.") : t("No se pudo enviar el reporte. Intentá nuevamente."))
    } finally { setOcupado(false) }
  }
  return <div>
    <button type="button" disabled={enviado || ocupado} aria-expanded={abierto} aria-controls={id} onClick={() => setAbierto(v => !v)}>{t("Reportar")}{' '}{comentarioId ? t('comentario') : t("publicación")}</button>
    {abierto && <form id={id} onSubmit={e => { e.preventDefault(); void enviar() }}>
      <label htmlFor={`${id}-motivo`}>{t("Motivo del reporte")}</label>
      <textarea id={`${id}-motivo`} required minLength={10} maxLength={1000} rows={3} value={motivo} onChange={e => setMotivo(e.target.value)} />
      <p>{t("Explicá el problema sin incluir datos personales. El reporte solo será visible para administración.")}</p>
      <button disabled={ocupado || motivo.trim().length < 10}>{ocupado ? t("Enviando…") : t("Enviar reporte")}</button>
      <button type="button" disabled={ocupado} onClick={() => setAbierto(false)}>{t("Cancelar")}</button>
    </form>}
    {mensaje && <p role="status">{t(mensaje)}</p>}
  </div>
}
