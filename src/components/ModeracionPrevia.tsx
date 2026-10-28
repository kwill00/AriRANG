import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useT } from '../lib/locale'
type Proposal = { id: string; titulo: string; contenido: string; estado: string; senales: string[] }
export default function ModeracionPrevia() {
  const t = useT()
  const [posts, setPosts] = useState<Proposal[]>([])
  const [state, setState] = useState('pendiente')
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')
  const [revision, setRevision] = useState(0)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [reports, setReports] = useState<Record<string, Record<string, number>>>({})
  useEffect(() => {
    let active = true
    void supabase.rpc('community_review_queue', { p_estado: state }).then(({ data, error }) => {
      if (active) { setPosts(error ? [] : data ?? []); setMessage(error ? 'Este espacio necesita autorización y configuración del servidor.' : ''); setLoading(false) }
    })
    return () => { active = false }
  }, [state, revision])
  async function review(id: string, approve: boolean) {
    if (busy || (notes[id] ?? '').trim().length < 5) return
    setBusy(true)
    const { error } = await supabase.rpc('community_review_safe', { p_id: id, p_aprobar: approve, p_nota: notes[id] })
    setMessage(error ? 'No se pudo completar la revisión.' : 'Revisión guardada.')
    if (!error) { setLoading(true); setRevision(v => v + 1) }
    setBusy(false)
  }
  async function loadReports(id: string) {
    const { data, error } = await supabase.rpc('community_report_summary', { p_id: id })
    if (error) setMessage('No se pudo completar la revisión.')
    else setReports(v => ({ ...v, [id]: data ?? {} }))
  }
  return <section className="safe-community"><h3>{t('Cola de revisión previa')}</h3><p>{t('Revisá respeto, privacidad, enlaces y contexto. Las señales automáticas no reemplazan la lectura humana.')}</p>
    <label>{t('Estado')}<select value={state} onChange={e => { setLoading(true); setState(e.target.value) }}>{['pendiente','aprobada','rechazada','reportada'].map(value => <option key={value} value={value}>{t(value)}</option>)}</select></label>
    {loading && <p role="status">{t('Procesando...')}</p>}
    {!loading && !posts.length && !message && <p className="admin-empty">{t('No hay publicaciones en este estado.')}</p>}
    {posts.map(post => <article key={post.id}><h4>{post.titulo}</h4><p>{post.contenido}</p><p>{post.senales.length ? t('Hay señales para revisar.') : t('Sin señales automáticas. Revisión humana igualmente obligatoria.')}</p><button type="button" onClick={() => void loadReports(post.id)}>{t('Ver motivos de reportes')}</button>{Object.entries(reports[post.id] ?? {}).map(([reason, count]) => <p key={reason}>{t(reason)}: {count}</p>)}<label>{t('Motivo de revisión')}<textarea minLength={5} maxLength={500} value={notes[post.id] ?? ''} onChange={e => setNotes(v => ({ ...v, [post.id]: e.target.value }))} /></label><button disabled={busy || (notes[post.id] ?? '').trim().length < 5} onClick={() => void review(post.id, true)}>{t('Aprobar publicación')}</button><button disabled={busy || (notes[post.id] ?? '').trim().length < 5} onClick={() => void review(post.id, false)}>{t('Rechazar o retirar')}</button></article>)}
    {message && <p role="status">{t(message)}</p>}
  </section>
}
