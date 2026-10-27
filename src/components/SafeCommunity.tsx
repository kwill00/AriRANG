import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useT } from '../lib/locale'
import ConductGuide, { CONDUCT_VERSION } from './ConductGuide'
type Post = { id: string; titulo: string; contenido: string }
type OwnPost = Post & { estado: string; nota_revision: string | null }
export default function SafeCommunity() {
  const t = useT()
  const [feed, setFeed] = useState<Post[]>([])
  const [own, setOwn] = useState<OwnPost[]>([])
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [revision, setRevision] = useState(0)
  const [reasons, setReasons] = useState<Record<string, string>>({})
  useEffect(() => {
    let active = true
    async function load() {
      const [publicResult, ownResult] = await Promise.all([
        supabase.rpc('community_safe_feed'),
        supabase.from('comunidad_revision_previa').select('id,titulo,contenido,estado,nota_revision').order('creado_en', { ascending: false }).limit(20),
      ])
      if (active) {
        if (publicResult.error || ownResult.error) { setFeed([]); setOwn([]); setMessage('Este espacio necesita autorización y configuración del servidor.') }
        else { setFeed(publicResult.data ?? []); setOwn(ownResult.data ?? []) }
      }
    }
    void load()
    return () => { active = false }
  }, [revision])
  async function submit() {
    if (busy || !accepted) return
    setBusy(true); setMessage('')
    const { error } = await supabase.rpc('community_submit_safe', { p_titulo: title, p_contenido: body, p_conducta_version: CONDUCT_VERSION })
    if (error) setMessage('No se pudo enviar. Revisá las reglas, evitá datos de contacto y comprobá tu autorización.')
    else { setTitle(''); setBody(''); setAccepted(false); setMessage('Propuesta recibida para revisión. Todavía no está publicada.'); setRevision(v => v + 1) }
    setBusy(false)
  }
  async function report(id: string) {
    if (busy) return
    setBusy(true)
    const { error } = await supabase.rpc('community_report_safe', { p_id: id, p_motivo: reasons[id] ?? 'otro' })
    setMessage(error ? 'No se pudo enviar el reporte.' : 'Reporte recibido para revisión.')
    setBusy(false)
  }
  return <section className="safe-community"><h2>{t('Comunidad con revisión previa')}</h2><ConductGuide />
    <p>{t('Solo se muestran propuestas aprobadas. No hay perfiles públicos, mensajes privados, comentarios ni cobros en este espacio.')}</p>
    <form onSubmit={e => { e.preventDefault(); void submit() }}>
      <label htmlFor="safe-title">{t('Título')}</label><input id="safe-title" required minLength={3} maxLength={120} value={title} onChange={e => setTitle(e.target.value)} />
      <label htmlFor="safe-body">{t('Mensaje')}</label><textarea id="safe-body" required minLength={10} maxLength={2000} value={body} onChange={e => setBody(e.target.value)} />
      <label className="policy-choices"><input type="checkbox" required checked={accepted} onChange={e => setAccepted(e.target.checked)} />{t('Leí las reglas y quiero enviar esta propuesta para revisión. Solo se publicará si administración la aprueba.')}</label>
      <button disabled={busy || !accepted}>{t('Enviar a revisión')}</button>
    </form>
    {message && <p role="status">{t(message)}</p>}
    <h3>{t('Mis propuestas')}</h3>{own.map(post => <article key={post.id}><h4>{post.titulo}</h4><p>{t(post.estado)}</p>{post.nota_revision && <p>{post.nota_revision}</p>}</article>)}
    <h3>{t('Propuestas aprobadas')}</h3>{feed.map(post => <article key={post.id}><h4>{post.titulo}</h4><p>{post.contenido}</p><label>{t('Motivo del reporte')}<select value={reasons[post.id] ?? 'otro'} onChange={e => setReasons(v => ({ ...v, [post.id]: e.target.value }))}>{['privacidad','acoso','sexual','otro'].map(value => <option key={value} value={value}>{t(value)}</option>)}</select></label><button type="button" disabled={busy} onClick={() => void report(post.id)}>{t('Reportar')}</button></article>)}
    <button type="button" onClick={() => setRevision(v => v + 1)}>{t('Actualizar')}</button>
  </section>
}
