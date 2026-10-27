import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { POLICY_VERSION } from '../lib/privacy'
import { useT } from '../lib/locale'
import PrivacyAccount from './PrivacyAccount'
import { signOutPrivately } from '../lib/accountSession'
import MinorSpace from './MinorSpace'
import TravelIllustration from './TravelIllustration'

export function AgeNotice({ onGuest }: { onGuest?: () => void }) {
  const t = useT()
  return <aside role="note"><h3>{t('Menores de 14 y autorización parental')}</h3><p>{t('Antes de los 14 años, la cuenta requiere autorización parental verificable. Este formulario no la verifica: no envíes documentos, fecha de nacimiento ni correo de un adulto. Podés usar el planificador sin cuenta.')}</p>{onGuest && <button type="button" onClick={onGuest}>{t('Usar el planificador sin cuenta')}</button>}</aside>
}
export function TeenNotice() {
  const t = useT()
  return <aside role="note"><h3>{t('De 14 a 17 años: cuenta propia')}</h3><p>{t('Podés solicitar tu cuenta sin verificación parental cuando esta modalidad esté habilitada. Leé las reglas y la privacidad. Tus propuestas pasan por revisión; este espacio no habilita pagos ni mensajes privados.')}</p></aside>
}
export function AgeChoice({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const t = useT()
  return <label>{t('Edad')}<select required value={value} onChange={e => onChange(e.target.value)}><option value="">{t('Seleccioná una franja de edad')}</option><option value="under14">{t('Menos de 14 años')}</option><option value="teen">{t('Entre 14 y 17 años')}</option><option value="adult">{t('18 años o más')}</option></select></label>
}
export function PolicyChoices({ terms, privacy, onTerms, onPrivacy }: { terms: boolean; privacy: boolean; onTerms: (value: boolean) => void; onPrivacy: (value: boolean) => void }) {
  const t = useT()
  return <fieldset className="policy-choices"><legend>{t('Privacidad')}</legend>
    <p>{t('Las políticas están disponibles al pie de esta página.')}</p>
    <label><input required type="checkbox" checked={terms} onChange={e => onTerms(e.target.checked)} />{t('Acepto los términos de uso (obligatorio para crear la cuenta).')}</label>
    <label><input required type="checkbox" checked={privacy} onChange={e => onPrivacy(e.target.checked)} />{t('Leí la política de privacidad y cómo solicitar la eliminación de mis datos.')}</label>
    <p>{t('No solicitamos consentimiento para publicidad. No habilitamos correos promocionales.')}</p>
  </fieldset>
}
export default function AccessGate({ children, onGuest }: { children: ReactNode; onGuest?: () => void }) {
  const t = useT()
  const [allowed, setAllowed] = useState(false)
  const [minorAllowed, setMinorAllowed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [age, setAge] = useState('')
  const [terms, setTerms] = useState(false)
  const [privacy, setPrivacy] = useState(false)
  const [message, setMessage] = useState('')
  const busy = useRef(false)
  const request = useRef(0)
  function invalidateRequests() { request.current++ }
  async function refreshAccess() {
    const current = ++request.current
    try {
      const { data, error } = await supabase.rpc('privacy_access_mode')
      if (current !== request.current) return
      if (error || !['adult', 'minor_limited', 'restricted'].includes(data)) throw new Error('Access unavailable')
      setAllowed(data === 'adult'); setMinorAllowed(data === 'minor_limited'); setMessage('')
      return data as string
    } catch {
      if (current !== request.current) return
      setAllowed(false); setMinorAllowed(false)
      setMessage('No pudimos consultar tu acceso. Reintentá en unos instantes; tus opciones siguen aquí.')
    } finally {
      if (current === request.current) setLoading(false)
    }
  }
  useEffect(() => {
    const check = () => { if (!busy.current) void refreshAccess() }
    check()
    const timer = window.setInterval(check, 60000)
    window.addEventListener('focus', check)
    return () => { invalidateRequests(); window.clearInterval(timer); window.removeEventListener('focus', check) }
  }, [])
  async function submit() {
    if (!['adult','teen'].includes(age) || !terms || !privacy || loading || busy.current) return
    busy.current = true; request.current++; setLoading(true); setMessage('')
    try {
      const { error } = await supabase.rpc(age === 'teen' ? 'privacy_accept_teen' : 'privacy_accept_adult', { p_version: POLICY_VERSION, p_terms: terms, p_privacy: privacy })
      if (error) setMessage(error.message === 'Age classification review required'
        ? 'Esta cuenta necesita revisar su franja de edad antes de cambiar el acceso.'
        : 'No se pudo guardar tu aceptación. El acceso todavía no está habilitado; podés reintentar o usar el planificador sin cuenta.')
      else if (await refreshAccess() === 'restricted') setMessage('Tu aceptación se guardó. El servidor todavía no habilitó el acceso a esta cuenta.')
    } catch { setMessage('No pudimos consultar tu acceso. Reintentá en unos instantes; tus opciones siguen aquí.') }
    finally { busy.current = false; setLoading(false) }
  }
  async function chooseAge(value: string) {
    request.current++
    setAge(value)
    setTerms(false); setPrivacy(false)
    if (value === 'under14') {
      // Only an already authenticated account is involved; collect no date or parent contact.
      busy.current = true; setLoading(true)
      try {
        const { error } = await supabase.rpc('privacy_restrict_minor')
        if (error) throw new Error('Restriction unavailable')
        setMessage('')
      } catch { setMessage('No pudimos consultar tu acceso. Reintentá en unos instantes; tus opciones siguen aquí.') }
      finally { busy.current = false; setLoading(false) }
    }
  }
  if (allowed) return children
  if (minorAllowed) return <MinorSpace />
  return <section className="access-gate" aria-labelledby="access-title" aria-busy={loading}>
    <header className="access-welcome"><div className="access-art"><TravelIllustration kind="trip" /></div><div>
      <p className="access-eyebrow">ARMY Travel</p><h1 id="access-title">{t('Un paso más para encontrarnos')}</h1>
      <p>{t('Elegí tu franja de edad y revisá estas dos opciones para continuar.')}</p>
    </div></header>
    <form onSubmit={e => { e.preventDefault(); void submit() }}>
    <fieldset className="access-fields" disabled={loading}><legend>{t('Tu acceso')}</legend>
    <AgeChoice value={age} onChange={value => void chooseAge(value)} />
    {age === 'under14' ? <AgeNotice onGuest={onGuest} /> : <>{age === 'teen' && <TeenNotice />}<PolicyChoices terms={terms} privacy={privacy} onTerms={setTerms} onPrivacy={setPrivacy} /></>}
    </fieldset>
    <p className="access-hint">{t('Guardamos tu aceptación en el servidor. Cuando se confirme el acceso, este paso desaparecerá.')}</p>
    <div className="access-actions">
    <button type="submit" disabled={loading || !['adult','teen'].includes(age) || !terms || !privacy}>{t('Continuar')}</button>
    {onGuest && age !== 'under14' && <button className="access-secondary" type="button" onClick={onGuest}>{t('Entrar como visitante')}</button>}
    <button className="access-secondary" type="button" onClick={() => void signOutPrivately()}>{t('🚪 Cerrar sesión')}</button>
    </div></form>
    {loading && <p role="status">{t('Procesando...')}</p>}
    {message && <div className="access-feedback"><p role="status">{t(message)}</p><button type="button" disabled={loading} onClick={() => { setLoading(true); void refreshAccess() }}>{t('Volver a comprobar')}</button></div>}
    <details className="access-account"><summary>{t('Privacidad y cuenta')}</summary><PrivacyAccount /></details>
  </section>
}
