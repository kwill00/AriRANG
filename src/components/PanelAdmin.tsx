import CheckoutPrueba from './CheckoutPrueba'
import { useT } from '../lib/locale'

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Moderacion from './Moderacion'
import DonacionAdmin from './DonacionAdmin'
import ModeracionPrevia from './ModeracionPrevia'

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

  if (cargando) return <p>{t("💜 Cargando solicitudes...")}</p>

  return (
    <section className="perfil-page">
      <h2>{t("🛡️ Administración de ARMY Travel")}</h2>
      <Moderacion />
      <ModeracionPrevia />
      <CheckoutPrueba />
      <DonacionAdmin />
      <p>{t("Solicitudes pendientes:")}{' '}{solicitudes.length}</p>

      {solicitudes.length === 0 && (
        <p>{t("No hay solicitudes pendientes.")}</p>
      )}

      {solicitudes.map((solicitud) => (
        <article className="perfil-card" key={solicitud.id}>
          <h3>💜 {solicitud.nombre_organizacion}</h3>

          <p><strong>{t("País:")}</strong> {solicitud.pais}</p>
          <p><strong>{t("Descripción:")}</strong> {solicitud.descripcion}</p>
          <p><strong>{t("Redes:")}</strong> {solicitud.redes_sociales || t("No informadas")}</p>
          <p><strong>{t("Estado:")}</strong> {t(solicitud.estado)}</p>

          <button
            type="button"
            disabled={procesando !== null}
            onClick={() => revisar(solicitud.id, true)}
          >{t('Aprobar solicitud')}</button>

          <button
            type="button"
            disabled={procesando !== null}
            onClick={() => revisar(solicitud.id, false)}
          >{t("❌ Rechazar")}</button>
        </article>
      ))}

      {mensaje && <p role="status">{t(mensaje)}</p>}
    </section>
  )
}

