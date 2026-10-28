import CheckoutPrueba from './CheckoutPrueba'
import { useT } from '../lib/locale'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import Moderacion from './Moderacion'
import DonacionAdmin from './DonacionAdmin'
import ModeracionPrevia from './ModeracionPrevia'
import './Admin.css'

const sections = [
  { id: 'revision', label: 'Revisión previa', icon: 'M12 3 4 6v6c0 4 4 7 8 9 4-2 8-5 8-9V6L12 3Zm-4 9 3 3 5-6' },
  { id: 'reportes', label: 'Reportes', icon: 'M5 21V4m0 1c5-5 9 5 14 0v10c-5 5-9-5-14 0' },
  { id: 'solicitudes', label: 'Solicitudes', icon: 'M16 21v-2c0-5-12-5-12 0v2m16-1v-2c0-3-2-4-4-4M14 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Zm3-3c4 0 4 6 0 6' },
  { id: 'pagos', label: 'Pagos de prueba', icon: 'M20 8H5a2 2 0 0 1 0-4h13v4M4 6v13h16V8m-5 4h6v4h-6Z' },
] as const
type AdminSection = typeof sections[number]['id']

type Solicitud = {
  id: string
  nombre_organizacion: string
  pais: string
  descripcion: string
  redes_sociales: string | null
  estado: string
  creado_en: string
}

export default function PanelAdmin() {
  const t = useT()
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([])
  const [cargando, setCargando] = useState(true)
  const [procesando, setProcesando] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState('')
  const [section, setSection] = useState<AdminSection>(() => new URLSearchParams(window.location.search).has('checkout_test') ? 'pagos' : 'revision')
  const tabs = useRef<(HTMLButtonElement | null)[]>([])

  const cargarSolicitudes = async () => {

    const { data, error } = await supabase
      .from('solicitudes_organizadora')
      .select(
        'id, nombre_organizacion, pais, descripcion, redes_sociales, estado, creado_en'
      )
      .eq('estado', 'pendiente')
      .order('creado_en', { ascending: true })

    if (error) {
      setMensaje('Error al cargar solicitudes: ' + error.message)
    } else {
      setSolicitudes(data ?? [])
    }

    setCargando(false)
  }

  useEffect(() => {
  let activo = true
  const cargarSolicitudes = async () => {

    const { data, error } = await supabase
      .from('solicitudes_organizadora')
      .select(
        'id, nombre_organizacion, pais, descripcion, redes_sociales, estado, creado_en'
      )
      .eq('estado', 'pendiente')
      .order('creado_en', { ascending: true })

    if (!activo) return
    if (error) {
      setMensaje('Error al cargar solicitudes: ' + error.message)
    } else {
      setSolicitudes(data ?? [])
    }

    setCargando(false)
  }
  void cargarSolicitudes()
  return () => { activo = false }
}, [])

  const revisar = async (id: string, aprobar: boolean) => {
    if (!window.confirm(t(aprobar ? '¿Aprobar esta solicitud?' : '¿Rechazar esta solicitud?'))) {
      return
    }

    setProcesando(id)
    setMensaje('')

    const { error } = await supabase.rpc('revisar_solicitud', {
      p_solicitud_id: id,
      p_aprobar: aprobar
    })

    setProcesando(null)

    if (error) {
      setMensaje('Error: ' + error.message)
      return
    }

    setMensaje(
      aprobar
        ? 'Solicitud aprobada por administración.'
        : 'Solicitud rechazada correctamente.'
    )

    await cargarSolicitudes()
  }

  return (
    <section className="perfil-page admin-page" aria-labelledby="admin-title">
      <header className="admin-header"><span className="admin-header-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d={sections[0].icon}/></svg></span><div><p className="admin-eyebrow">ARMY World</p><h2 id="admin-title">{t('Administración')}</h2><p>{t('Revisá publicaciones, solicitudes y pruebas de pago desde un solo lugar.')}</p></div></header>
      <div className="admin-tabs" role="tablist" aria-label={t('Secciones de administración')}>
        {sections.map((item,index)=><button type="button" role="tab" key={item.id} id={`admin-tab-${item.id}`} aria-controls={`admin-panel-${item.id}`} aria-selected={section===item.id} tabIndex={section===item.id?0:-1} ref={node=>{tabs.current[index]=node}} onClick={()=>setSection(item.id)} onKeyDown={event=>{
          const next=event.key==='ArrowRight'?(index+1)%sections.length:event.key==='ArrowLeft'?(index+sections.length-1)%sections.length:event.key==='Home'?0:event.key==='End'?sections.length-1:null
          if(next!==null){event.preventDefault();setSection(sections[next].id);tabs.current[next]?.focus()}
        }}><svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"><path d={item.icon}/></svg><span>{t(item.label)}</span></button>)}
      </div>
      <div className="admin-panel" role="tabpanel" id="admin-panel-revision" aria-labelledby="admin-tab-revision" tabIndex={0} hidden={section!=='revision'}><ModeracionPrevia /></div>
      <div className="admin-panel" role="tabpanel" id="admin-panel-reportes" aria-labelledby="admin-tab-reportes" tabIndex={0} hidden={section!=='reportes'}><Moderacion /></div>
      <div className="admin-panel" role="tabpanel" id="admin-panel-pagos" aria-labelledby="admin-tab-pagos" tabIndex={0} hidden={section!=='pagos'}><CheckoutPrueba /><details className="admin-external"><summary>{t('Registros de pagos externos')}</summary><DonacionAdmin /></details></div>
      <div className="admin-panel" role="tabpanel" id="admin-panel-solicitudes" aria-labelledby="admin-tab-solicitudes" tabIndex={0} hidden={section!=='solicitudes'}>
      <div className="admin-section-heading"><h3>{t('Solicitudes de organizadoras')}</h3><span className="admin-count">{cargando?'…':mensaje.startsWith('Error')?'—':solicitudes.length}</span></div>
      {cargando && <p role="status">{t('💜 Cargando solicitudes...')}</p>}

      {!cargando && solicitudes.length === 0 && !mensaje.startsWith('Error') && (
        <p className="admin-empty">{t("No hay solicitudes pendientes.")}</p>
      )}

      {solicitudes.map((solicitud) => (
        <article className="perfil-card" key={solicitud.id}>
          <h4>{solicitud.nombre_organizacion}</h4>

          <p><strong>{t("País:")}</strong> {solicitud.pais}</p>
          <p><strong>{t("Descripción:")}</strong> {solicitud.descripcion}</p>
          <p><strong>{t("Redes:")}</strong> {solicitud.redes_sociales || t("No informadas")}</p>
          <p><strong>{t("Estado:")}</strong> {t(solicitud.estado)}</p>

          <div className="admin-request-actions"><button
            type="button"
            disabled={procesando !== null}
            onClick={() => revisar(solicitud.id, true)}
          >{t('Aprobar solicitud')}</button>

          <button
            type="button"
            disabled={procesando !== null}
            onClick={() => revisar(solicitud.id, false)}
          >{t("❌ Rechazar")}</button></div>
        </article>
      ))}

      {mensaje && <p role="status">{t(mensaje)}</p>}
      </div>
    </section>
  )
}

