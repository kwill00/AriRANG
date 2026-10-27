import { useT } from '../lib/locale'

import { useContext, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import SolicitudOrganizadora from './SolicitudOrganizadora'
import PerfilSocial from './PerfilSocial'
import './Comunidad.css'
import PrivacyAccount from './PrivacyAccount'
import { safeAvatar } from '../lib/privacy'
import { ConsentContext } from '../lib/consentContext'

type Props = {
  sesion: Session
  cantidadViajes: number
}

type Perfil = {
  nombre: string | null
  avatar_url: string | null
  biografia: string | null
  pais: string | null
  rol: string
  verificada: boolean
}

export default function MiPerfil({
  sesion,
  cantidadViajes
}: Props) {
  const t = useT()
  const consent = useContext(ConsentContext)
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [nombre, setNombre] = useState('')
  const [biografia, setBiografia] = useState('')
  const [pais, setPais] = useState('')
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState('')

  useEffect(() => {
    let activo = true

    const cargarPerfil = async () => {
      setCargando(true)
      setMensaje('')

      const { data, error } = await supabase
        .from('perfiles')
        .select(
          'nombre, avatar_url, biografia, pais, rol, verificada'
        )
        .eq('id', sesion.user.id)
        .single()

      if (!activo) return

      if (error) {
        setMensaje('No se pudo cargar el perfil: ' + error.message)
      } else {
        setPerfil(data)
        setNombre(data.nombre ?? '')
        setBiografia(data.biografia ?? '')
        setPais(data.pais ?? '')
      }

      setCargando(false)
    }

    void cargarPerfil()

    return () => {
      activo = false
    }
  }, [sesion.user.id])

  const guardarPerfil = async () => {
    setGuardando(true)
    setMensaje('')

    const { error } = await supabase
      .from('perfiles')
      .update({
        nombre: nombre.trim(),
        biografia: biografia.trim(),
        pais: pais.trim()
      })
      .eq('id', sesion.user.id)

    setGuardando(false)

    if (error) {
      setMensaje('Error al guardar: ' + error.message)
    } else {
      setMensaje('💜 ¡Perfil actualizado correctamente!')
    }
  }

  if (cargando) {
    return <p>{t("💜 Cargando tu perfil...")}</p>
  }

  const avatar = safeAvatar(perfil?.avatar_url || sesion.user.user_metadata?.avatar_url, consent?.externalMedia === true)

  return (
    <section className="perfil-page">
      <h2>{t("💜 Mi perfil ARMY")}</h2>

      <div className="perfil-card">
        {avatar ? (
          <img
            className="perfil-avatar"
            src={avatar}
            alt={t("Foto de perfil")}
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="perfil-avatar perfil-avatar-vacio">
            💜
          </div>
        )}

        <h3>{nombre || t("Miembro ARMY")}</h3>
        <p>{sesion.user.email}</p>

        <span className="perfil-rol">
          {perfil?.rol === 'admin'
            ? t("Administrador")
            : perfil?.rol === 'organizadora'
              ? t("Organizadora")
              : 'ARMY'}
          {perfil?.verificada ? t(' · Solicitud aprobada por administración') : ''}
        </span>

        <p>{t("✈️ Viajes planificados:")}{' '}{cantidadViajes}</p>
      </div>

      <div className="perfil-card">
        <h3>{t("✏️ Editar perfil")}</h3>

        <p>{t("Usá un alias. País y biografía son opcionales; no incluyas datos de contacto ni ubicación precisa.")}</p>
        <label htmlFor="perfil-nombre">{t("Nombre")}</label>
        <input
          id="perfil-nombre"
          value={nombre}
          maxLength={80}
          onChange={(e) => setNombre(e.target.value)}
        />

        <label htmlFor="perfil-pais">{t("País")}</label>
        <input
          id="perfil-pais"
          value={pais}
          maxLength={80}
          onChange={(e) => setPais(e.target.value)}
        />

        <label htmlFor="perfil-biografia">{t("Biografía")}</label>
        <textarea
          id="perfil-biografia"
          value={biografia}
          maxLength={500}
          rows={4}
          onChange={(e) => setBiografia(e.target.value)}
          placeholder={t("Contanos un poco sobre vos y BTS 💜")}
        />

        <button
          type="button"
          onClick={guardarPerfil}
          disabled={guardando || !perfil}
        >
          {guardando ? t("Guardando...") : t("💾 Guardar perfil")}
        </button>

        {mensaje && <p role="status">{t(mensaje)}</p>}
      </div>

      <div className="comunidad"><PerfilSocial editable autorId={sesion.user.id} usuarioId={sesion.user.id} /></div>
      <SolicitudOrganizadora sesion={sesion} />
      <PrivacyAccount />
    </section>
  )
}
