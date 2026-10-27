import { useT } from '../lib/locale'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import ConexionesSociales from './ConexionesSociales'
import { POLICY_VERSION } from '../lib/privacy'

type Social = { usuario_id: string; nombre: string; biografia: string; visible: boolean; seguidores: number; siguiendo: number; suscripciones: number; donaciones: number; lo_sigo: boolean }
type Props = { autorId: string; usuarioId: string; editable?: boolean }
export default function PerfilSocial({ autorId, usuarioId, editable = false }: Props) {
  const t = useT()
  const [ruta, setRuta] = useState<string[]>([])
  const actual = ruta.at(-1) ?? autorId
  return <div className="social-navegacion">
    {ruta.length > 0 && <button type="button" onClick={() => setRuta(v => v.slice(0, -1))}>{t("Volver al perfil anterior")}</button>}
    <PerfilSocialDetalle key={actual} autorId={actual} usuarioId={usuarioId} editable={editable && actual === autorId} onAbrir={id => { if (id !== actual) setRuta(v => [...v, id]) }} />
  </div>
}

function PerfilSocialDetalle({ autorId, usuarioId, editable = false, onAbrir }: Props & { onAbrir: (id: string) => void }) {
  const t = useT()
  const [lista, setLista] = useState<'seguidores' | 'siguiendo' | null>(null)
  const [perfil, setPerfil] = useState<Social | null>(null)
  const [cargando, setCargando] = useState(true)
  const [ocupado, setOcupado] = useState(false)
  const [revision, setRevision] = useState(0)
  const [nombre, setNombre] = useState('')
  const [bio, setBio] = useState('')
  const [visible, setVisible] = useState(false)
  const [mensaje, setMensaje] = useState('')
  useEffect(() => {
    let activo = true
    async function cargar() {
      setCargando(true)
      try {
        const { data, error } = await supabase.rpc('social_perfil', { p_usuario_id: autorId })
        if (error) throw error
        if (activo) { setPerfil(data); setNombre(data?.nombre ?? ''); setBio(data?.biografia ?? ''); setVisible(data?.visible ?? false) }
      } catch { if (activo) { setPerfil(null); setMensaje(t("No se pudo cargar el perfil social. Intentá actualizar.")) } }
      finally { if (activo) setCargando(false) }
    }
    void cargar()
    return () => { activo = false }
  }, [autorId, revision, t])
  async function guardar() {
    if (ocupado || nombre.trim().length < 2) return
    setOcupado(true); setMensaje('')
    try {
      const valores = { nombre: nombre.trim(), biografia: bio.trim(), visible, visibility_consent_version: visible ? POLICY_VERSION : null }
      const { error } = perfil
        ? await supabase.from('social_perfiles').update(valores).eq('usuario_id', usuarioId)
        : await supabase.from('social_perfiles').insert({ usuario_id: usuarioId, ...valores })
      if (error) throw error
      setRevision(v => v + 1); setMensaje(t("Perfil social guardado."))
    } catch { setMensaje(t("No se pudo guardar el perfil social.")) }
    finally { setOcupado(false) }
  }
  async function interactuar(tipo: 'seguir', activo: boolean) {
    if (ocupado) return
    setOcupado(true); setMensaje('')
    try {
      const { error } = await supabase.rpc('social_interactuar', { p_perfil_id: autorId, p_tipo: tipo, p_activo: activo })
      if (error) throw error
      setRevision(v => v + 1)
    } catch { setMensaje(t("No se pudo completar la acción. Volvé a intentar.")) }
    finally { setOcupado(false) }
  }
  return <section className="comunidad-tarjeta" aria-label={t("Perfil social")}>
    {cargando ? <p role="status">{t("Cargando perfil social…")}</p> : perfil ? <>
      <h3>{perfil.nombre}</h3><p className="comunidad-texto">{perfil.biografia}</p>
      <div className="comunidad-acciones" aria-label={t("Conexiones del perfil")}>
        <button type="button" aria-expanded={lista === "seguidores"} onClick={() => setLista(v => v === "seguidores" ? null : "seguidores")}>{perfil.seguidores}{t("seguidores")}</button>
        <button type="button" aria-expanded={lista === "siguiendo"} onClick={() => setLista(v => v === "siguiendo" ? null : "siguiendo")}>{perfil.siguiendo}{t("siguiendo")}</button>
      </div>
      {!perfil.visible && <p>{t("Tu perfil social está oculto para otras personas.")}</p>}
      {lista && <ConexionesSociales key={lista} perfilId={autorId} usuarioId={usuarioId} tipo={lista} onAbrir={onAbrir} onCambio={() => setRevision(v => v + 1)} />}
      <p>{perfil.suscripciones}{t("suscripciones pagas verificadas ·")}{' '}{perfil.donaciones}{t("donaciones verificadas")}</p>
      <p>{t("Las cantidades no muestran importes. Los pagos se verifican por administración; esta app no procesa cobros.")}</p>
      {autorId !== usuarioId && <div className="comunidad-acciones">
        <button type="button" aria-pressed={perfil.lo_sigo} disabled={ocupado || cargando} onClick={() => void interactuar('seguir', !perfil.lo_sigo)}>{perfil.lo_sigo ? t("Dejar de seguir") : t("Seguir")}</button>
      </div>}
    </> : <p>{t("Esta persona todavía no tiene un perfil social visible.")}</p>}
    {editable && autorId === usuarioId && !cargando && <form onSubmit={e => { e.preventDefault(); void guardar() }}>
      <h4>{t("Tu perfil social")}</h4><p>{t("Solo se publican los campos que completes aquí. Tu correo y tus viajes no forman parte del perfil social.")}</p>
      <label>{t("Nombre social")}<input required minLength={2} maxLength={80} value={nombre} onChange={e => setNombre(e.target.value)} /></label>
      <label>{t("Biografía social")}<textarea maxLength={500} rows={3} value={bio} onChange={e => setBio(e.target.value)} /></label>
      <label><input style={{ width: 'auto' }} type="checkbox" checked={visible} onChange={e => setVisible(e.target.checked)} />{t("Mostrar mi perfil a otras ARMY con sesión iniciada")}</label>
      <button disabled={ocupado || nombre.trim().length < 2}>{ocupado ? t("Guardando…") : t("Guardar perfil social")}</button>
    </form>}
    <button type="button" disabled={ocupado || cargando} onClick={() => setRevision(v => v + 1)}>{t("Actualizar perfil social")}</button>
    {mensaje && <p role="status">{t(mensaje)}</p>}
  </section>
}


