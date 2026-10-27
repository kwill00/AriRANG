import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { POLICY_VERSION } from '../lib/privacy'
import { useT } from '../lib/locale'
import PrivacyAccount from './PrivacyAccount'
import { signOutPrivately } from '../lib/accountSession'
import MinorSpace from './MinorSpace'

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
  useEffect(() => {
    let active = true
    const check = () => void Promise.all([supabase.rpc('privacy_access_allowed'), supabase.rpc('privacy_access_mode')]).then(([{ data, error }, mode]) => {
      if (active) { setAllowed(!error && data === true); setMinorAllowed(!mode.error && mode.data === 'minor_limited'); setLoading(false); setMessage(error ? 'No se pudo verificar el acceso. La configuración del servidor puede estar pendiente.' : '') }
    })
    check()
    const timer = window.setInterval(check, 60000)
    return () => { active = false; window.clearInterval(timer) }
  }, [])
  async function submit() {
    if (!['adult','teen'].includes(age) || !terms || !privacy || loading) return
    setLoading(true)
    const { error } = await supabase.rpc(age === 'teen' ? 'privacy_accept_teen' : 'privacy_accept_adult', { p_version: POLICY_VERSION, p_terms: terms, p_privacy: privacy })
    const [{ data, error: accessError }, mode] = await Promise.all([supabase.rpc('privacy_access_allowed'), supabase.rpc('privacy_access_mode')])
    setAllowed(!error && !accessError && data === true)
    setMinorAllowed(!error && !mode.error && mode.data === 'minor_limited')
    setMessage(error?.message === 'Age classification review required' ? 'Esta cuenta necesita revisar su franja de edad antes de cambiar el acceso.' : error || accessError || (data !== true && mode.data !== 'minor_limited') ? 'No se pudo verificar el acceso. La configuración del servidor puede estar pendiente.' : '')
    setLoading(false)
  }
  async function chooseAge(value: string) {
    setAge(value)
    setTerms(false); setPrivacy(false)
    if (value === 'under14') {
      // Only an already authenticated account is involved; collect no date or parent contact.
      const { error } = await supabase.rpc('privacy_restrict_minor')
      if (error) setMessage('No se pudo verificar el acceso. La configuración del servidor puede estar pendiente.')
    }
  }
  if (allowed) return children
  if (minorAllowed) return <MinorSpace />
  return <section className="access-gate"><h1>{t('Revisar acceso')}</h1>
    <AgeChoice value={age} onChange={value => void chooseAge(value)} />
    {age === 'under14' ? <AgeNotice onGuest={onGuest} /> : <>{age === 'teen' && <TeenNotice />}<PolicyChoices terms={terms} privacy={privacy} onTerms={setTerms} onPrivacy={setPrivacy} /></>}
    {onGuest && age !== 'under14' && <button type="button" onClick={onGuest}>{t('Entrar como visitante')}</button>}
    <button type="button" disabled={loading || !['adult','teen'].includes(age) || !terms || !privacy} onClick={() => void submit()}>{t('Continuar')}</button>
    <button type="button" onClick={() => void signOutPrivately()}>{t('🚪 Cerrar sesión')}</button>
    {loading && <p role="status">{t('Procesando...')}</p>}
    {message && <p role="status">{t(message)}</p>}
    <PrivacyAccount />
  </section>
}
