import { useT } from '../lib/locale'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

type Proyecto = {
  id: string
  titulo: string
  descripcion: string
  estado: string
  tipo: string
  pais: string | null
  ciudad: string | null
}

export default function Proyectos({ onAbrirProyecto }: { onAbrirProyecto: (id: string) => void }) {
  const t = useT()
  const [mensaje, setMensaje] = useState('')
    const [proyectos, setProyectos] = useState<Proyecto[]>([])
const [cargando, setCargando] = useState(true)
const [publicandoId, setPublicandoId] = useState<string | null>(null)

async function cargarProyectos() {

  const { data: { user }, error: authError } =
    await supabase.auth.getUser()

  if (authError || !user) {
    setMensaje(t("No se pudo verificar tu sesión."))
    setCargando(false)
    return
  }

  const { data, error } = await supabase
    .from('proyectos')
    .select('id, titulo, descripcion, estado, tipo, pais, ciudad')
    .eq('autor_id', user.id)
    .order('creado_en', { ascending: false })

  if (error) {
    setMensaje(error.message)
  } else {
    setProyectos(data ?? [])
  }

  setCargando(false)
}

useEffect(() => {
  let activo = true
  async function cargarProyectos() {

  const { data: { user }, error: authError } =
    await supabase.auth.getUser()

  if (!activo) return
  if (authError || !user) {
    setMensaje(t("No se pudo verificar tu sesión."))
    setCargando(false)
    return
  }

  const { data, error } = await supabase
    .from('proyectos')
    .select('id, titulo, descripcion, estado, tipo, pais, ciudad')
    .eq('autor_id', user.id)
    .order('creado_en', { ascending: false })

  if (!activo) return
  if (error) {
    setMensaje(error.message)
  } else {
    setProyectos(data ?? [])
  }

  setCargando(false)
}
  void cargarProyectos()
  return () => { activo = false }
}, [t])

async function publicarProyecto(id: string) {
  setPublicandoId(id)
  setMensaje('')

  const { error } = await supabase.rpc('publicar_propuesta', {
    p_proyecto_id: id,
  })

  if (error) {
    setMensaje(error.message)
  } else {
    setMensaje(t("🚀 ¡Propuesta publicada correctamente!"))
    await cargarProyectos()
  }

  setPublicandoId(null)
}
  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [pais, setPais] = useState('')
  const [ciudad, setCiudad] = useState('')
  const [concierto, setConcierto] = useState('')
  const [guardando, setGuardando] = useState(false)


  async function guardarPropuesta() {
    setMensaje('')

    if (titulo.trim().length < 3) {
      setMensaje(t("El título debe tener al menos 3 caracteres."))
      return
    }

    if (descripcion.trim().length < 10) {
      setMensaje(t("La descripción debe tener al menos 10 caracteres."))
      return
    }

    setGuardando(true)

    try {
      const { data: { user }, error: authError } =
        await supabase.auth.getUser()

      if (authError || !user) {
        throw new Error('Iniciá sesión para crear proyectos.')
      }

      const { error } = await supabase
        .from('proyectos')
        .insert({
          autor_id: user.id,
          titulo: titulo.trim(),
          descripcion: descripcion.trim(),
          pais: pais.trim() || null,
          ciudad: ciudad.trim() || null,
          concierto: concierto.trim() || null,
          tipo: 'propuesta',
          estado: 'borrador',
        })

      if (error) throw error

      setMensaje(t("✅ Propuesta guardada como borrador."))
      await cargarProyectos()
      setTitulo('')
      setDescripcion('')
      setPais('')
      setCiudad('')
      setConcierto('')
    } catch (error) {
      setMensaje(
        error instanceof Error
          ? error.message
          : t("No se pudo guardar la propuesta.")
      )
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: 20 }}>
      <h2>{t("🎤 Proyectos ARMY")}</h2>
      <p className="sharing-notice">{t('No publiques domicilio, teléfono, documentos, escuela, ubicación en tiempo real ni datos de otras personas. Usá un alias.')}</p>

      <p>{t("Compartí tus ideas para conciertos y proyectos con la comunidad ARMY.")}</p>

      <div style={{ display: 'grid', gap: 14 }}>
        <label>{t("📝 Nombre del proyecto")}<input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder={t("Ej: Purple Ocean")}
            maxLength={120}
            style={{ width: '100%', padding: 10 }}
          />
        </label>

        <label>{t("💬 Descripción")}<textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder={t("Contanos tu idea...")}
            rows={5}
            style={{ width: '100%', padding: 10 }}
          />
        </label>

        <label>{t("🌎 País")}<input
            value={pais}
            onChange={(e) => setPais(e.target.value)}
            style={{ width: '100%', padding: 10 }}
          />
        </label>

        <label>{t("📍 Ciudad")}<input
            value={ciudad}
            onChange={(e) => setCiudad(e.target.value)}
            style={{ width: '100%', padding: 10 }}
          />
        </label>

        <label>{t("🎶 Concierto")}<input
            value={concierto}
            onChange={(e) => setConcierto(e.target.value)}
            placeholder={t("Ej: BTS World Tour")}
            style={{ width: '100%', padding: 10 }}
          />
        </label>

        <button
          type="button"
          onClick={guardarPropuesta}
          disabled={guardando}
          style={{
            padding: 14,
            border: 'none',
            borderRadius: 10,
            background: '#8b5cf6',
            color: 'white',
            cursor: guardando ? 'wait' : 'pointer',
          }}
        >
          {guardando
            ? t("Guardando...")
            : t("💾 Guardar propuesta")}
        </button>

        {mensaje && <p role="status">{t(mensaje)}</p>}
      </div>
      <section style={{ marginTop: 32 }}>
  <h2>{t("📋 Mis proyectos")}</h2>

  {cargando ? (
    <p>{t("Cargando proyectos...")}</p>
  ) : proyectos.length === 0 ? (
    <p>{t("Todavía no creaste ninguna propuesta.")}</p>
  ) : (
    <div style={{ display: 'grid', gap: 16 }}>
      {proyectos.map((proyecto) => (
        <article
          key={proyecto.id}
          style={{
            padding: 18,
            border: '1px solid #8b5cf6',
            borderRadius: 12,
          }}
        >
          <h3>🎤 {proyecto.titulo}</h3>
          {proyecto.estado === 'publicado' && <button type="button" onClick={() => onAbrirProyecto(proyecto.id)}>{t("Conversar y dar finger heart")}</button>}
          <p>{proyecto.descripcion}</p>

          <p>
            📍 {[proyecto.ciudad, proyecto.pais]
              .filter(Boolean)
              .join(', ') || t("Ubicación sin definir")}
          </p>

          <p>
            {proyecto.estado === 'publicado'
              ? t("🟢 Publicado")
              : t("📝 Borrador")}
          </p>

          {proyecto.estado === 'borrador' &&
            proyecto.tipo === 'propuesta' && (
              <button
                type="button"
                disabled={publicandoId === proyecto.id}
                onClick={() => publicarProyecto(proyecto.id)}
                style={{
                  padding: 12,
                  background: '#8b5cf6',
                  color: 'white',
                  border: 'none',
                  borderRadius: 10,
                }}
              >
                {publicandoId === proyecto.id
                  ? t("Publicando...")
                  : t("🚀 Publicar propuesta")}
              </button>
            )}
        </article>
      ))}
    </div>
  )}
</section>
    </div>
  )
}
