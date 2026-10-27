import { useT } from '../lib/locale'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import './Comunidad.css'

type Reporte = { id: string; motivo: string; estado: string; creado_en: string; titulo: string; contenido: string; oculto: boolean; comentario: boolean; nota_revision: string | null }
export default function Moderacion() {
  const t = useT()
  const [reportes, setReportes] = useState<Reporte[]>([])
  const [filtro, setFiltro] = useState('pendiente')
  const [pagina, setPagina] = useState(0)
  const [revision, setRevision] = useState(0)
  const [cargando, setCargando] = useState(true)
  const [ocupado, setOcupado] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [notas, setNotas] = useState<Record<string, string>>({})
  useEffect(() => {
    let activo = true
    async function cargar() {
      setCargando(true); setMensaje('')
      try {
        const { data, error } = await supabase.rpc('comunidad_listar_reportes', { p_estado: filtro, p_pagina: pagina })
        if (error) throw error
        if (activo) setReportes(data ?? [])
      } catch (error) {
        if (activo) {
          setReportes([])
          setMensaje((error as { code?: string })?.code === 'PGRST202' ? t("La moderación necesita su migración de Supabase.") : t("No se pudieron cargar los reportes. Verificá tus permisos y volvé a intentar."))
        }
      } finally { if (activo) setCargando(false) }
    }
    void cargar()
    return () => { activo = false }
  }, [filtro, pagina, revision, t])
  async function revisar(reporte: Reporte, accion: 'ocultar' | 'descartar' | 'restaurar') {
    const nota = (notas[reporte.id] ?? '').trim()
    if (ocupado || nota.length < 5) return
    setOcupado(true); setMensaje('')
    try {
      const { error } = await supabase.rpc('comunidad_revisar_reporte', { p_reporte_id: reporte.id, p_accion: accion, p_nota: nota })
      if (error) throw error
      setNotas(v => ({ ...v, [reporte.id]: '' })); setRevision(v => v + 1)
    } catch { setMensaje(t("No se pudo completar la revisión. Actualizá los reportes y revisá tus permisos.")) }
    finally { setOcupado(false) }
  }
  return <section className="comunidad" aria-label={t("Moderación comunitaria")}>
    <h3>{t("Reportes de la comunidad")}</h3>
    <p>{t("Ocultar retira el contenido del feed. Restaurar permite volver a mostrarlo sin borrar datos.")}</p>
    <label>{t("Estado de reportes")}<select disabled={ocupado} value={filtro} onChange={e => { setFiltro(e.target.value); setPagina(0) }}><option value="pendiente">{t("Pendientes")}</option><option value="oculto">{t("Ocultados")}</option><option value="descartado">{t("Descartados")}</option><option value="restaurado">{t("Restaurados")}</option></select></label>
    <button type="button" disabled={cargando || ocupado} onClick={() => setRevision(v => v + 1)}>{t("Actualizar reportes")}</button>
    {mensaje && <p role="alert">{t(mensaje)}</p>}
    {cargando ? <p role="status">{t("Cargando reportes…")}</p> : reportes.length === 0 ? <p>{t("No hay reportes en este estado.")}</p> : reportes.slice(0, 20).map(r => <article className="comunidad-tarjeta" key={r.id}>
      <small>{r.comentario ? 'Comentario' : t("Publicación")} · {new Date(r.creado_en).toLocaleString('es-AR')} · {r.estado}</small>
      <h4>{r.titulo}</h4><p className="comunidad-texto">{r.contenido}</p>
      <p className="comunidad-texto"><strong>{t("Motivo:")}</strong> {r.motivo}</p>
      {r.nota_revision && <p className="comunidad-texto"><strong>{t("Última revisión:")}</strong> {r.nota_revision}</p>}
      <label>{t("Nota de moderación")}<textarea maxLength={1000} rows={2} value={notas[r.id] ?? ''} onChange={e => setNotas(v => ({ ...v, [r.id]: e.target.value }))} /></label>
      <div className="comunidad-acciones">
        <button type="button" disabled={ocupado || (notas[r.id] ?? '').trim().length < 5 || r.oculto} onClick={() => void revisar(r, 'ocultar')}>{t("Ocultar contenido")}</button>
        <button type="button" disabled={ocupado || (notas[r.id] ?? '').trim().length < 5 || !r.oculto} onClick={() => void revisar(r, 'restaurar')}>{t("Restaurar contenido")}</button>
        {r.estado === 'pendiente' && <button type="button" disabled={ocupado || (notas[r.id] ?? '').trim().length < 5} onClick={() => void revisar(r, 'descartar')}>{t("Descartar reporte")}</button>}
      </div>
    </article>)}
    <div className="comunidad-acciones"><button type="button" disabled={pagina === 0 || cargando || ocupado} onClick={() => setPagina(v => v - 1)}>{t("Reportes anteriores")}</button><span>{t("Página")}{' '}{pagina + 1}</span><button type="button" disabled={reportes.length <= 20 || cargando || ocupado} onClick={() => setPagina(v => v + 1)}>{t("Reportes siguientes")}</button></div>
  </section>
}

