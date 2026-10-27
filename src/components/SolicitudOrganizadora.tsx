import { useT } from '../lib/locale'

import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

type Props = {
  sesion: Session
}

type Solicitud = {
  id: string
  nombre_organizacion: string
  estado: 'pendiente' | 'aprobada' | 'rechazada'
}

export default function SolicitudOrganizadora({ sesion }: Props) {
  const t = useT()
  const [nombre, setNombre] = useState('')
  const [pais, setPais] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [redes, setRedes] = useState('')
  const [solicitud, setSolicitud] = useState<Solicitud | null>(null)
  const [cargando, setCargando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [compartir, setCompartir] = useState(false)

  useEffect(() => {
    let activo = true

    const cargar = async () => {
      setCargando(true)

      const { data, error } = await supabase
        .from('solicitudes_organizadora')
        .select('id, nombre_organizacion, estado')
        .eq('usuario_id', sesion.user.id)
        .order('creado_en', { ascending: false })
        .limit(1)

      if (!activo) return

      if (error) {
        setMensaje('Error al consultar solicitud: ' + error.message)
      } else {
        setSolicitud(data?.[0] ?? null)
      }

      setCargando(false)
    }

    void cargar()

    return () => {
      activo = false
    }
  }, [sesion.user.id])

  const enviarSolicitud = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (enviando || solicitud || !compartir) return

    setEnviando(true)
    setMensaje('')

    const { data, error } = await supabase
      .from('solicitudes_organizadora')
      .insert({
        usuario_id: sesion.user.id,
        nombre_organizacion: nombre.trim(),
        pais: pais.trim(),
        descripcion: descripcion.trim(),
        redes_sociales: redes.trim(),
        estado: 'pendiente'
      })
      .select('id, nombre_organizacion, estado')
      .single()

    setEnviando(false)

    if (error) {
      setMensaje('No se pudo enviar: ' + error.message)
      return
    }

    setSolicitud(data)
    setMensaje('💜 ¡Solicitud enviada correctamente!')
  }

  if (cargando) return <p>{t("💜 Consultando solicitud...")}</p>

  return (
    <section className="solicitud-organizadora">
      <h2>{t("💜 Convertite en organizadora")}</h2>

      {solicitud ? (
        <div className="perfil-card">
          <h3>{solicitud.nombre_organizacion}</h3>
          <p>{t("Estado de solicitud:")}<strong> {t(solicitud.estado)}</strong>
          </p>
          <p>
            {solicitud.estado === 'pendiente'
              ? t("Estamos revisando tu solicitud.")
              : solicitud.estado === 'aprobada'
                ? t("¡Tu solicitud fue aprobada!")
                : t("Tu solicitud fue rechazada.")}
          </p>
        </div>
      ) : (
        <form className="perfil-card" onSubmit={enviarSolicitud}>
          <label htmlFor="org-nombre">{t("Nombre de la fanbase")}</label>
          <input
            id="org-nombre"
            required
            maxLength={100}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />

          <label htmlFor="org-pais">{t("País (opcional)")}</label>
          <input
            id="org-pais"
            maxLength={80}
            value={pais}
            onChange={(e) => setPais(e.target.value)}
          />

          <label htmlFor="org-descripcion">{t("Descripción")}</label>
          <textarea
            id="org-descripcion"
            required
            rows={4}
            maxLength={1000}
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder={t("Contanos qué proyectos organiza tu fanbase")}
          />

          <label htmlFor="org-redes">{t("Redes sociales (opcional)")}</label>
          <input
            id="org-redes"
            maxLength={300}
            value={redes}
            onChange={(e) => setRedes(e.target.value)}
            placeholder="Instagram, X, TikTok..."
          />

          <label className="policy-choices"><input required type="checkbox" checked={compartir} onChange={e => setCompartir(e.target.checked)} />{t('Quiero enviar estos datos a administración para revisar mi solicitud. No autoriza publicidad ni publica mis redes.')}</label>
          <button type="submit" disabled={enviando || !compartir}>
            {enviando ? t("Enviando...") : t("💜 Enviar solicitud")}
          </button>
        </form>
      )}

      {mensaje && <p role="status">{t(mensaje)}</p>}
    </section>
  )
}
