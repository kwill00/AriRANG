import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { languages, LocaleContext, translate } from '../lib/locale'
import type { Language } from '../lib/locale'
import { policies } from '../lib/policies'
import type { Policy } from '../lib/policies'
import { CONSENT_KEY, deniedConsent, readConsent, saveConsent } from '../lib/privacy'
import { revokePush } from '../lib/pushPrivacy'
import { ConsentContext } from '../lib/consentContext'
import '../privacy.css'
import ConductGuide from './ConductGuide'

function initialLanguage(): Language {
  try { const value = localStorage.getItem('army-language'); if (value && Object.hasOwn(languages, value)) return value as Language } catch { /* Use Spanish without storage. */ }
  return 'es'
}
export default function PrivacyShell({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(initialLanguage)
  const [consent, setConsent] = useState(() => readConsent())
  const [settings, setSettings] = useState(false)
  const [externalMedia, setExternalMedia] = useState(() => readConsent()?.externalMedia ?? false)
  const [push, setPush] = useState(() => readConsent()?.push ?? false)
  const [policy, setPolicy] = useState<Policy | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const returnFocus = useRef<HTMLElement | null>(null)
  const t = (text: string) => translate(text, language)
  useEffect(() => { document.documentElement.lang = language; try { localStorage.setItem('army-language', language) } catch { /* Preference remains in memory. */ } }, [language])
  useEffect(() => {
    const sync = () => { const next = readConsent(); setConsent(next); setExternalMedia(next?.externalMedia ?? false); setPush(next?.push ?? false); if (!next?.push) void revokePush().catch(() => setError('No se pudo retirar el registro push del servidor. Reintentá revocar opcionales.')) }
    const storage = (event: StorageEvent) => { if (event.key === CONSENT_KEY || event.key === null) sync() }
    const timer = window.setInterval(sync, 60000)
    window.addEventListener('storage', storage)
    if (!readConsent()?.push) void revokePush().catch(() => setError('No se pudo retirar el registro push del servidor. Reintentá revocar opcionales.'))
    return () => { window.clearInterval(timer); window.removeEventListener('storage', storage) }
  }, [])
  useEffect(() => {
    if (policy) { returnFocus.current = document.activeElement as HTMLElement; dialog.current?.showModal() }
    else { dialog.current?.close(); returnFocus.current?.focus() }
  }, [policy])
  async function choose(media: boolean, notifications: boolean) {
    setBusy(true); setError('')
    const next = { ...deniedConsent(), externalMedia: media, push: notifications }
    // Deny immediately, even when the remote cleanup fails.
    saveConsent(next); setConsent(next); setExternalMedia(media); setPush(notifications); setSettings(false)
    try { if (!notifications) await revokePush() }
    catch { setError('No se pudo retirar el registro push del servidor. Reintentá revocar opcionales.') }
    finally { setBusy(false) }
  }
  return <LocaleContext.Provider value={language}><ConsentContext.Provider value={consent}>
    <a className="skip-link" href="#army-content">{t('Saltar al contenido')}</a>
    <header className="privacy-toolbar"><label htmlFor="army-language">{t('Idioma')}</label><select id="army-language" value={language} onChange={event => setLanguage(event.target.value as Language)}>{Object.entries(languages).map(([code, name]) => <option key={code} value={code} lang={code}>{name}</option>)}</select></header>
    <div id="army-content" tabIndex={-1}>{children}</div>
    <footer className="privacy-links"><nav aria-label={t('Privacidad')}>
      {(Object.keys(policies.es) as Policy[]).map(name => <button type="button" key={name} onClick={() => setPolicy(name)}>{t(name)}</button>)}
      <button type="button" onClick={() => setSettings(true)}>{t('Configurar privacidad')}</button>
    </nav></footer>
    <ConductGuide />
    {(!consent || settings) && <section className="privacy-banner" aria-labelledby="privacy-title">
      <h2 id="privacy-title">{t('Preferencias de privacidad')}</h2>
      <p>{t('Usamos almacenamiento necesario para sesión, idioma y estas preferencias. No hay analítica ni publicidad. Los avatares externos y el push están bloqueados hasta que elijas permitirlos.')}</p>
      {settings && <fieldset><legend>{t('Configurar')}</legend>
        <label><input type="checkbox" checked={externalMedia} onChange={e => setExternalMedia(e.target.checked)} />{t('Avatares externos (opcional)')}</label>
        <label><input type="checkbox" checked={push} onChange={e => setPush(e.target.checked)} />{t('Notificaciones push (opcional)')}</label>
        <p>{t('Permitir push aquí no concede permiso al navegador ni activa envíos. Se solicita aparte desde Avisos.')}</p>
      </fieldset>}
      <div className="privacy-actions">
        <button type="button" disabled={busy} onClick={() => void choose(true, true)}>{t('Aceptar opcionales')}</button>
        <button type="button" disabled={busy} onClick={() => void choose(false, false)}>{t('Rechazar opcionales')}</button>
        <button type="button" onClick={() => setSettings(true)}>{t('Configurar')}</button>
        {settings && <button type="button" disabled={busy} onClick={() => void choose(externalMedia, push)}>{t('Guardar preferencias')}</button>}
        {consent && <button type="button" onClick={() => setSettings(false)}>{t('Cerrar')}</button>}
      </div>
    </section>}
    <div className="privacy-actions"><button type="button" disabled={busy} onClick={() => void choose(false, false)}>{t('Revocar opcionales')}</button></div>
    {error && <p className="privacy-error" role="alert">{t(error)}</p>}
    <dialog ref={dialog} className="policy-dialog" aria-labelledby="policy-heading" onCancel={() => setPolicy(null)} onClose={() => setPolicy(null)}>
      <h2 id="policy-heading">{policy && t(policy)}</h2>
      {policy && policies[language][policy].map((paragraph, i) => <p key={i}>{paragraph}</p>)}
      <button type="button" onClick={() => setPolicy(null)}>{t('Cerrar')}</button>
    </dialog>
  </ConsentContext.Provider></LocaleContext.Provider>
}
