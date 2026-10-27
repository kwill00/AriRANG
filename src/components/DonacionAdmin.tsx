import { useT } from '../lib/locale'
import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function DonacionAdmin() {
  const t = useT()
  const [tipo, setTipo] = useState('donacion')
  const [miembro, setMiembro] = useState('')
  const [hasta, setHasta] = useState('')
  const [perfil, setPerfil] = useState('')
  const [referencia, setReferencia] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [mensaje, setMensaje] = useState('')
  async function registrar() {
    if (ocupado) return
    setOcupado(true); setMensaje('')
    try {
      const { error } = tipo === 'donacion'
        ? await supabase.rpc('social_registrar_donacion', { p_perfil_id: perfil.trim(), p_referencia: referencia.trim() })
        : await supabase.rpc('social_registrar_suscripcion', { p_usuario_id: miembro.trim(), p_perfil_id: perfil.trim(), p_referencia: referencia.trim(), p_vigente_hasta: new Date(hasta).toISOString() })
      if (error) throw error
      setReferencia(''); setMensaje(t("Registro verificado guardado. El contador se actualizará al consultar el perfil."))
    } catch (error) { setMensaje((error as { code?: string })?.code === '23505' ? t("Esa referencia ya fue registrada.") : t("No se pudo registrar. Revisá el perfil, la referencia y tus permisos.")) }
    finally { setOcupado(false) }
  }
  return <section className="comunidad"><h3>{t("Donaciones y suscripciones pagas verificadas")}</h3><p>{t("Registrá únicamente pagos externos cuya recepción ya hayas comprobado. No se guardan importes ni se cobran pagos.")}</p>
    <form onSubmit={e => { e.preventDefault(); void registrar() }}>
      <label>{t("Tipo de registro")}<select value={tipo} onChange={e => setTipo(e.target.value)}><option value="donacion">{t("Donación verificada")}</option><option value="suscripcion">{t("Suscripción paga verificada")}</option></select></label>
      {tipo === 'suscripcion' && <><label>{t("ID de la persona suscrita")}<input required pattern="[0-9a-fA-F-]{36}" value={miembro} onChange={e => setMiembro(e.target.value)} /></label><label>{t("Vigente hasta")}<input required type="datetime-local" value={hasta} onChange={e => setHasta(e.target.value)} /></label></>}
      <label>{t("ID del perfil receptor")}<input required pattern="[0-9a-fA-F-]{36}" value={perfil} onChange={e => setPerfil(e.target.value)} /></label>
      <label>{t("Referencia interna única")}<input required minLength={5} maxLength={150} value={referencia} onChange={e => setReferencia(e.target.value)} /></label>
      <p>{t("No incluyas datos bancarios, documentos ni información personal en la referencia.")}</p>
      <button disabled={ocupado || referencia.trim().length < 5}>{ocupado ? t("Registrando…") : t("Registrar pago verificado")}</button>
    </form>{mensaje && <p role="status">{t(mensaje)}</p>}
  </section>
}

