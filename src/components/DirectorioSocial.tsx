import { useT } from '../lib/locale'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import PerfilSocial from './PerfilSocial'

export default function DirectorioSocial({ usuarioId }: { usuarioId: string }) {
  const t = useT()
  const [perfiles, setPerfiles] = useState<{ usuario_id: string; nombre: string }[]>([])
  const [pagina, setPagina] = useState(0)
  const [seleccion, setSeleccion] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [mensaje, setMensaje] = useState('')
  useEffect(() => {
    let activo = true
    async function cargar() {
      setCargando(true); setMensaje('')
      try {
        const { data, error } = await supabase.from('social_perfiles').select('usuario_id,nombre').eq('visible', true).order('nombre').order('usuario_id').range(pagina * 20, pagina * 20 + 20)
        if (error) throw error
        if (activo) setPerfiles(data ?? [])
      } catch { if (activo) { setPerfiles([]); setMensaje(t("No se pudo cargar el directorio social.")) } }
      finally { if (activo) setCargando(false) }
    }
    void cargar()
    return () => { activo = false }
  }, [pagina, t])
  return <section className="comunidad">
    <h2>{t("ARMY conectadas")}</h2><p>{t("Descubrí los perfiles que eligieron participar en la comunidad.")}</p>
    {mensaje && <p role="alert">{t(mensaje)}</p>}
    {cargando ? <p role="status">{t("Cargando perfiles…")}</p> : perfiles.length === 0 ? <p>{t("Todavía no hay perfiles sociales para mostrar. Podés crear el tuyo en Mi perfil.")}</p> : perfiles.slice(0, 20).map(p => <button key={p.usuario_id} type="button" aria-pressed={seleccion === p.usuario_id} onClick={() => setSeleccion(p.usuario_id)}>{p.nombre}</button>)}
    {seleccion && <PerfilSocial key={seleccion} autorId={seleccion} usuarioId={usuarioId} />}
    <div className="comunidad-acciones"><button type="button" disabled={pagina === 0 || cargando} onClick={() => setPagina(v => v - 1)}>{t("Perfiles anteriores")}</button><button type="button" disabled={perfiles.length <= 20 || cargando} onClick={() => setPagina(v => v + 1)}>{t("Perfiles siguientes")}</button></div>
  </section>
}
