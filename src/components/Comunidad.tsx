import { useLanguage, useT } from '../lib/locale'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import './Comunidad.css'
import ReportarContenido from './ReportarContenido'
import AutorSocial from './AutorSocial'
import { nombresSociales } from '../lib/nombresSociales'

type Publicacion = { id: string; autor_id: string; titulo: string; contenido: string; tipo: 'publicacion' | 'debate'; creado_en: string; proyecto_id: string | null; proyectos?: { pais: string | null; ciudad: string | null; concierto: string | null } | null }
type Comentario = { id: string; autor_id: string; contenido: string; creado_en: string }
type Filtros = { titulo: string; pais: string; ciudad: string; concierto: string; soloProyectos: boolean }
const sinFiltros: Filtros = { titulo: '', pais: '', ciudad: '', concierto: '', soloProyectos: false }
const contiene = (valor: string) => '%' + valor.replace(/[\\%_]/g, c => '\\' + c) + '%'
const PAGE_SIZE = 10
const fecha = (value: string, language: string) => new Date(value).toLocaleString(language)
const errorTexto = (error: unknown) => {
  const code = (error as { code?: string })?.code
  if (code === '42P01' || code === 'PGRST205') return 'La comunidad todavía necesita su migración de Supabase. Consultá supabase/COMUNIDAD.md.'
  return 'No se pudo completar la operación. Revisá tu conexión y volvé a intentar.'
}

function FingerHeart() {
  // Original geometric heart illustration, replacing the undocumented asset.
  return <svg viewBox="0 0 40 44" width="30" height="34" aria-hidden="true" focusable="false">
    <circle cx="20" cy="22" r="17" fill="#f3eafa" />
    <path d="M20 32 10 22C2 11 17 7 20 16c3-9 18-5 10 6Z" fill="#e9d5ff" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    <path d="m32 5 1.5 4.5L38 11l-4.5 1.5L32 17l-1.5-4.5L26 11l4.5-1.5Z" fill="currentColor" />
  </svg>
}

function Conversacion({ post, usuarioId }: { post: Publicacion; usuarioId: string }) {
  const t = useT()
  const language = useLanguage()
  const [nombres, setNombres] = useState<Record<string, string>>({})
  const [comentarios, setComentarios] = useState<Comentario[]>([])
  const [texto, setTexto] = useState('')
  const [pagina, setPagina] = useState(0)
  const [hayMas, setHayMas] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [ocupado, setOcupado] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let activo = true
    async function cargar() {
      setCargando(true)
      try {
        const { data, error } = await supabase.from('comunidad_comentarios').select('id, autor_id, contenido, creado_en').eq('publicacion_id', post.id).order('creado_en').order('id').range(pagina * 20, pagina * 20 + 20)
        if (error) throw error
        const autores = await nombresSociales((data ?? []).slice(0, 20).map(c => c.autor_id))
        if (activo) { setNombres(autores); setComentarios((data ?? []).slice(0, 20)); setHayMas((data?.length ?? 0) > 20) }
      } catch (error) { if (activo) setMensaje(errorTexto(error)) }
      finally { if (activo) setCargando(false) }
    }
    void cargar()
    return () => { activo = false }
  }, [post.id, pagina, revision])
  async function enviar() {
    if (ocupado || !texto.trim()) return
    setOcupado(true); setMensaje('')
    try {
      const { error } = await supabase.from('comunidad_comentarios').insert({ publicacion_id: post.id, autor_id: usuarioId, contenido: texto.trim() })
      if (error) throw error
      setTexto(''); setPagina(0); setRevision(v => v + 1)
    } catch (error) { setMensaje(errorTexto(error)) }
    finally { setOcupado(false) }
  }
  async function eliminar(id: string) {
    if (ocupado || !window.confirm(t('¿Eliminar tu comentario?'))) return
    setOcupado(true); setMensaje('')
    try {
      const { data, error } = await supabase.from('comunidad_comentarios').delete().eq('id', id).eq('autor_id', usuarioId).select('id')
      if (error) throw error
      if (!data?.length) throw new Error('Sin permiso')
      setRevision(v => v + 1)
    } catch (error) { setMensaje(errorTexto(error)) }
    finally { setOcupado(false) }
  }
  return <section className="comunidad-comentarios" aria-label={t("Comentarios del debate")}>
    {cargando ? <p role="status">{t("Cargando comentarios…")}</p> : comentarios.length === 0 ? <p>{t("Sé la primera persona en responder.")}</p> : comentarios.map(c => <article key={c.id}>
      <AutorSocial autorId={c.autor_id} usuarioId={usuarioId} nombre={nombres[c.autor_id]} />
      <small>{fecha(c.creado_en, language)}</small>
      <p className="comunidad-texto">{c.contenido}</p>
      <ReportarContenido comentarioId={c.id} />
      {c.autor_id === usuarioId && <button type="button" disabled={ocupado} onClick={() => void eliminar(c.id)}>{t("Eliminar comentario")}</button>}
    </article>)}
    <div className="comunidad-acciones">
      <button type="button" disabled={pagina === 0 || cargando} onClick={() => setPagina(v => v - 1)}>{t("Anteriores")}</button>
      <button type="button" disabled={!hayMas || cargando} onClick={() => setPagina(v => v + 1)}>{t("Siguientes")}</button>
    </div>
    <form onSubmit={e => { e.preventDefault(); void enviar() }}>
      <label>{t("Tu respuesta")}<textarea required maxLength={2000} rows={3} value={texto} onChange={e => setTexto(e.target.value)} /></label>
      <button disabled={ocupado || !texto.trim()}>{ocupado ? 'Procesando…' : t("Responder")}</button>
    </form>
    {mensaje && <p role="alert">{t(mensaje)}</p>}
  </section>
}

function Tarjeta({ post, usuarioId, nombre }: { post: Publicacion; usuarioId: string; nombre?: string }) {
  const t = useT()
  const language = useLanguage()
  const [abierto, setAbierto] = useState(false)
  const [total, setTotal] = useState(0)
  const [mio, setMio] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [mensaje, setMensaje] = useState('')
  const bloqueo = useRef(false)
  useEffect(() => {
    let activo = true
    async function cargar() {
      try {
        const [cuenta, propia] = await Promise.all([
          supabase.from('comunidad_hearts').select('*', { count: 'exact', head: true }).eq('publicacion_id', post.id),
          supabase.from('comunidad_hearts').select('usuario_id').eq('publicacion_id', post.id).eq('usuario_id', usuarioId).maybeSingle(),
        ])
        if (cuenta.error) throw cuenta.error
        if (propia.error) throw propia.error
        if (activo) { setTotal(cuenta.count ?? 0); setMio(!!propia.data) }
      } catch (error) { if (activo) setMensaje(errorTexto(error)) }
      finally { if (activo) setCargando(false) }
    }
    void cargar()
    return () => { activo = false }
  }, [post.id, usuarioId])
  async function reaccionar() {
    if (bloqueo.current || cargando) return
    bloqueo.current = true; setCargando(true); setMensaje('')
    try {
      const resultado = mio
        ? await supabase.from('comunidad_hearts').delete().eq('publicacion_id', post.id).eq('usuario_id', usuarioId)
        : await supabase.from('comunidad_hearts').upsert({ publicacion_id: post.id, usuario_id: usuarioId }, { onConflict: 'publicacion_id,usuario_id', ignoreDuplicates: true })
      if (resultado.error) throw resultado.error
      const { count, error } = await supabase.from('comunidad_hearts').select('*', { count: 'exact', head: true }).eq('publicacion_id', post.id)
      setMio(!mio)
      if (error) throw error
      setTotal(count ?? 0)
    } catch (error) { setMensaje(errorTexto(error)) }
    finally { bloqueo.current = false; setCargando(false) }
  }
  return <article className="comunidad-tarjeta">
    <small>{post.proyecto_id ? t("PROYECTO ARMY") : post.tipo === 'debate' ? t('Debate') : t('💜 Comunidad')} · {fecha(post.creado_en, language)}</small>
    <AutorSocial autorId={post.autor_id} usuarioId={usuarioId} nombre={nombre} />
    <h3>{post.titulo}</h3><p className="comunidad-texto">{post.contenido}</p>
    {post.proyecto_id && <div className="proyecto-datos"><p>📍 {[post.proyectos?.ciudad, post.proyectos?.pais].filter(Boolean).join(', ') || t("Ubicación sin definir")}</p><p>🎶 {post.proyectos?.concierto || t("Concierto sin definir")}</p></div>}
    <div className="comunidad-acciones">
      <button className="finger-heart" type="button" aria-pressed={mio} aria-label={t(mio ? 'Quitar finger heart. {total} reacciones' : 'Dar finger heart. {total} reacciones', { total })} disabled={cargando} onClick={() => void reaccionar()}><FingerHeart /><span>{total} · Finger heart</span></button>
      <button type="button" aria-expanded={abierto} onClick={() => setAbierto(v => !v)}>{abierto ? t("Cerrar comentarios") : t("Comentarios / debatir")}</button>
    </div>
    {mensaje && <p role="alert">{t(mensaje)}</p>}
    <ReportarContenido publicacionId={post.id} />
    {abierto && <Conversacion post={post} usuarioId={usuarioId} />}
  </article>
}

export default function Comunidad({ usuarioId, proyectoId, onVerTodo }: { usuarioId: string; proyectoId?: string | null; onVerTodo?: () => void }) {
  const t = useT()
  const [nombres, setNombres] = useState<Record<string, string>>({})
  const [componer, setComponer] = useState(false)
  const [filtrar, setFiltrar] = useState(false)
  const [busqueda, setBusqueda] = useState<Filtros>(sinFiltros)
  const [filtros, setFiltros] = useState<Filtros>(sinFiltros)
  const [posts, setPosts] = useState<Publicacion[]>([])
  const [pagina, setPagina] = useState(0)
  const [hayMas, setHayMas] = useState(false)
  const [revision, setRevision] = useState(0)
  const [cargando, setCargando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [titulo, setTitulo] = useState('')
  const [contenido, setContenido] = useState('')
  const [tipo, setTipo] = useState<'publicacion' | 'debate'>('publicacion')
  useEffect(() => {
    let activo = true
    async function cargar() {
      setCargando(true); setMensaje('')
      try {
        const conUbicacion = !proyectoId && !!(filtros.pais || filtros.ciudad || filtros.concierto)
        const campos = conUbicacion
          ? 'id, autor_id, titulo, contenido, tipo, creado_en, proyecto_id, proyectos!inner(pais,ciudad,concierto)'
          : 'id, autor_id, titulo, contenido, tipo, creado_en, proyecto_id, proyectos(pais,ciudad,concierto)'
        let consulta = supabase.from('comunidad_publicaciones').select(campos)
        if (proyectoId) consulta = consulta.eq('proyecto_id', proyectoId)
        else {
          if (filtros.soloProyectos || conUbicacion) consulta = consulta.not('proyecto_id', 'is', null)
          if (filtros.titulo) consulta = consulta.ilike('titulo', contiene(filtros.titulo))
          if (filtros.pais) consulta = consulta.ilike('proyectos.pais', contiene(filtros.pais))
          if (filtros.ciudad) consulta = consulta.ilike('proyectos.ciudad', contiene(filtros.ciudad))
          if (filtros.concierto) consulta = consulta.ilike('proyectos.concierto', contiene(filtros.concierto))
        }
        const { data, error } = await consulta.order('creado_en', { ascending: false }).order('id', { ascending: false }).range(pagina * PAGE_SIZE, pagina * PAGE_SIZE + PAGE_SIZE).returns<Publicacion[]>()
        if (error) throw error
        const autores = await nombresSociales((data ?? []).slice(0, PAGE_SIZE).map(p => p.autor_id))
        if (activo) { setNombres(autores); setPosts((data ?? []).slice(0, PAGE_SIZE)); setHayMas((data?.length ?? 0) > PAGE_SIZE) }
      } catch (error) { if (activo) { setPosts([]); setMensaje(errorTexto(error)) } }
      finally { if (activo) setCargando(false) }
    }
    void cargar()
    return () => { activo = false }
  }, [pagina, revision, proyectoId, filtros])
  async function publicar() {
    if (enviando || titulo.trim().length < 3 || contenido.trim().length < 10) return
    setEnviando(true); setMensaje('')
    try {
      const { error } = await supabase.from('comunidad_publicaciones').insert({ autor_id: usuarioId, titulo: titulo.trim(), contenido: contenido.trim(), tipo })
      if (error) throw error
      setTitulo(''); setContenido(''); setPagina(0); setRevision(v => v + 1)
    } catch (error) { setMensaje(errorTexto(error)) }
    finally { setEnviando(false) }
  }
  return <section className="comunidad">
    <div className="community-intro"><span className="community-eyebrow">{t("CONEXIONES QUE CRUZAN FRONTERAS")}</span><h2>{t("Comunidad ARMY 💜")}</h2><p>{t("Un lugar para encontrarnos, compartir ideas y preparar ese concierto que tanto esperamos.")}</p></div>
    {proyectoId && <button type="button" onClick={onVerTodo}>{t("Ver toda la comunidad")}</button>}
    {!proyectoId && <div className="mobile-community-tools"><button type="button" aria-expanded={componer} aria-controls="comunidad-compositor" onClick={() => setComponer(v => !v)}>{componer ? t("Cerrar formulario") : t("💜 Compartir una idea")}</button><button type="button" aria-expanded={filtrar} aria-controls="comunidad-filtros" onClick={() => setFiltrar(v => !v)}>{filtrar ? t("Cerrar filtros") : t("🔎 Buscar proyectos")}</button></div>}
    {!proyectoId && <form id="comunidad-compositor" className={`comunidad-tarjeta comunidad-compositor ${componer ? 'is-open' : ''}`} onSubmit={e => { e.preventDefault(); void publicar() }}>
      <label>{t("¿Qué querés compartir?")}<select value={tipo} onChange={e => setTipo(e.target.value as typeof tipo)}><option value="publicacion">{t("Publicación")}</option><option value="debate">{t("Debate")}</option></select></label>
      <label>{t("Título")}<input required minLength={3} maxLength={120} value={titulo} onChange={e => setTitulo(e.target.value)} /></label>
      <label>{t("Mensaje")}<textarea required minLength={10} maxLength={5000} rows={4} value={contenido} onChange={e => setContenido(e.target.value)} /></label>
      <p>{t("No compartas datos personales, documentos ni información privada de tus viajes.")}</p>
      <p>{t('Al publicar, el título y el mensaje serán visibles para otras personas con sesión iniciada. Podrían copiarlos.')}</p>
      <button disabled={enviando || titulo.trim().length < 3 || contenido.trim().length < 10}>{enviando ? t("Publicando…") : t("Publicar en la comunidad")}</button>
    </form>}
    {!proyectoId && <form id="comunidad-filtros" className={`comunidad-tarjeta proyecto-filtros ${filtrar ? 'is-open' : ''}`} aria-label={t("Buscar publicaciones y proyectos")} onSubmit={e => {
      e.preventDefault()
      const siguiente = { ...busqueda, titulo: busqueda.titulo.trim(), pais: busqueda.pais.trim(), ciudad: busqueda.ciudad.trim(), concierto: busqueda.concierto.trim() }
      setFiltros(siguiente); setPagina(0); setRevision(v => v + 1)
    }}>
      <h3>{t("Explorar proyectos y comunidad")}</h3>
      <label>{t("Buscar por título")}<input type="search" maxLength={120} value={busqueda.titulo} onChange={e => setBusqueda(v => ({ ...v, titulo: e.target.value }))} placeholder={t("Ej.: Banderazo")} /></label>
      <label><input type="checkbox" style={{ width: 'auto' }} checked={busqueda.soloProyectos} onChange={e => setBusqueda(v => ({ ...v, soloProyectos: e.target.checked }))} />{t("Solo proyectos publicados")}</label>
      <div className="proyecto-filtros-grid">
        <label>{t("País del proyecto")}<input maxLength={80} value={busqueda.pais} onChange={e => setBusqueda(v => ({ ...v, pais: e.target.value }))} placeholder={t("Ej.: Argentina")} /></label>
        <label>{t("Ciudad del proyecto")}<input maxLength={80} value={busqueda.ciudad} onChange={e => setBusqueda(v => ({ ...v, ciudad: e.target.value }))} placeholder={t("Ej.: Buenos Aires")} /></label>
        <label>{t("Concierto del proyecto")}<input maxLength={120} value={busqueda.concierto} onChange={e => setBusqueda(v => ({ ...v, concierto: e.target.value }))} placeholder={t("Ej.: BTS World Tour")} /></label>
      </div>
      <p>{t("País, ciudad y concierto buscan solo en proyectos publicados. Los filtros se combinan; podés escribir una parte del nombre.")}</p>
      <div className="comunidad-acciones"><button disabled={cargando}>{t("Buscar")}</button><button type="button" disabled={cargando} onClick={() => { setBusqueda(sinFiltros); setFiltros(sinFiltros); setPagina(0); setRevision(v => v + 1) }}>{t("Limpiar filtros")}</button></div>
    </form>}
    {!proyectoId && (filtros.titulo || filtros.pais || filtros.ciudad || filtros.concierto || filtros.soloProyectos) && <div className="busqueda-activa" role="status"><p>{t("Filtros activos:")}{' '}{[filtros.soloProyectos ? t("Solo proyectos") : '', filtros.titulo, filtros.pais, filtros.ciudad, filtros.concierto].filter(Boolean).join(' · ')}</p><button type="button" disabled={cargando} onClick={() => { setBusqueda(sinFiltros); setFiltros(sinFiltros); setPagina(0); setRevision(v => v + 1) }}>{t("Quitar filtros activos")}</button></div>}
    {mensaje && <p role="alert">{t(mensaje)}</p>}
    <button type="button" disabled={cargando} onClick={() => setRevision(v => v + 1)}>{t("Actualizar feed")}</button>
    {cargando ? <p role="status">{t("Cargando comunidad…")}</p> : posts.length === 0 ? <p role="status">{t("No hay publicaciones que coincidan. Probá con otros filtros o limpiá la búsqueda.")}</p> : posts.map(post => <Tarjeta key={post.id} post={post} usuarioId={usuarioId} nombre={nombres[post.autor_id]} />)}
    <div className="comunidad-acciones"><button type="button" disabled={pagina === 0 || cargando} onClick={() => setPagina(v => v - 1)}>{t("Anteriores")}</button><span>{t("Página")}{' '}{pagina + 1}</span><button type="button" disabled={!hayMas || cargando} onClick={() => setPagina(v => v + 1)}>{t("Siguientes")}</button></div>
  </section>
}


