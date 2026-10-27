import { useT } from '../lib/locale'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type Conexion = { usuario_id: string; nombre: string; puede_abrir: boolean; lo_sigo: boolean }
export default function ConexionesSociales({ perfilId, usuarioId, tipo, onAbrir, onCambio }: { perfilId: string; usuarioId: string; tipo: 'seguidores' | 'siguiendo'; onAbrir: (id: string) => void; onCambio: () => void }) {
  const t = useT()
  const [filas, setFilas] = useState<Conexion[]>([])
  const [pagina, setPagina] = useState(0)
  const [revision, setRevision] = useState(0)
  const [cargando, setCargando] = useState(true)
  const [ocupado, setOcupado] = useState(false)
  const [mensaje, setMensaje] = useState('')
  useEffect(() => {
    let activo = true
    async function cargar() {
      setCargando(true); setMensaje('')
      try {
        const { data, error } = await supabase.rpc('social_listar_conexiones', { p_usuario_id: perfilId, p_tipo: tipo, p_pagina: pagina })
        if (error) throw error
        if (activo) setFilas(data ?? [])
      } catch { if (activo) { setFilas([]); setMensaje(t("No se pudo cargar la lista. Intentá actualizarla.")) } }
      finally { if (activo) setCargando(false) }
    }
    void cargar()
    return () => { activo = false }
  }, [perfilId, tipo, pagina, revision, t])
  async function seguir(fila: Conexion) {
    if (ocupado) return
    setOcupado(true); setMensaje('')
    try {
      const { error } = await supabase.rpc('social_interactuar', { p_perfil_id: fila.usuario_id, p_tipo: 'seguir', p_activo: !fila.lo_sigo })
      if (error) throw error
      setRevision(v => v + 1); onCambio()
    } catch { setMensaje(t("No se pudo completar la acción. El perfil puede haber cambiado de visibilidad.")) }
    finally { setOcupado(false) }
  }
  return <section className="social-conexiones" aria-label={tipo === "seguidores" ? t("Lista de seguidores") : t("Lista de cuentas seguidas")}>
    <h4>{tipo === "seguidores" ? 'Seguidores' : 'Siguiendo'}</h4>
    <p>{t("Se muestran los perfiles visibles. Los totales pueden incluir cuentas que no comparten su perfil.")}</p>
    {cargando ? <p role="status">{t("Cargando conexiones…")}</p> : filas.length === 0 ? <p>{t("No hay perfiles para mostrar en esta página.")}</p> : <ul>{filas.slice(0, 20).map(f => <li key={f.usuario_id}>
      {f.puede_abrir ? <button type="button" onClick={() => onAbrir(f.usuario_id)}>{f.nombre}{f.usuario_id === usuarioId ? ' · Vos' : ''}</button> : <span>{t("Perfil no visible")}</span>}
      {f.usuario_id !== usuarioId && (f.puede_abrir || f.lo_sigo) && <button type="button" disabled={ocupado} aria-pressed={f.lo_sigo} onClick={() => void seguir(f)}>{f.lo_sigo ? t("Dejar de seguir") : t("Seguir")}</button>}
    </li>)}</ul>}
    {mensaje && <p role="alert">{t(mensaje)}</p>}
    <div className="comunidad-acciones"><button type="button" disabled={pagina === 0 || cargando || ocupado} onClick={() => setPagina(v => v - 1)}>{t("Conexiones anteriores")}</button><span>{t("Página")}{' '}{pagina + 1}</span><button type="button" disabled={filas.length <= 20 || cargando || ocupado} onClick={() => setPagina(v => v + 1)}>{t("Conexiones siguientes")}</button><button type="button" disabled={cargando || ocupado} onClick={() => setRevision(v => v + 1)}>{t("Actualizar conexiones")}</button></div>
  </section>
}
