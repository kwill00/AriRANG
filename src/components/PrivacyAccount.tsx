import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useT } from '../lib/locale'
import { revokePush } from '../lib/pushPrivacy'

export default function PrivacyAccount() {
  const t = useT()
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  async function act(action: 'unsubscribe' | 'delete') {
    if (busy || (action === 'delete' && confirmation !== 'ELIMINAR')) return
    setBusy(true); setMessage('')
    try {
      // The server takes the identity exclusively from the verified bearer token.
      const { data, error } = await supabase.functions.invoke('privacy-account', { body: { action, confirmation } })
      if (error || data?.ok !== true) throw new Error('Not confirmed')
      if (action === 'delete') {
        await revokePush().catch(() => { /* Account deletion already removes server subscriptions. */ })
        await supabase.auth.signOut({ scope: 'local' })
        window.location.reload()
      } else setMessage('Preferencia de baja guardada en el servidor.')
    } catch { setMessage('No se pudo completar. No se confirmó ningún cambio; revisá la configuración del servidor e intentá nuevamente.') }
    finally { setBusy(false) }
  }
  return <section className="privacy-account" aria-labelledby="privacy-account-title">
    <h2 id="privacy-account-title">{t('Privacidad y cuenta')}</h2>
    <p>{t('Los correos de acceso y seguridad se envían cuando los solicitás. No hay campañas promocionales habilitadas.')}</p>
    <button type="button" disabled={busy} onClick={() => void act('unsubscribe')}>{t('Dar de baja correos promocionales')}</button>
    <h3>{t('Eliminar mi cuenta y datos')}</h3>
    <p>{t('La eliminación es irreversible. Incluye cuenta, viajes y contenido asociado en la base. No borra copias de otras personas ni registros externos; las copias de seguridad dependen de la retención del proveedor.')}</p>
    <p>{t('Para eliminar la cuenta, iniciá sesión nuevamente y confirmá dentro de los siguientes 10 minutos.')}</p>
    <label htmlFor="delete-confirm">{t('Para confirmar, escribí ELIMINAR')}</label>
    <input id="delete-confirm" value={confirmation} autoComplete="off" onChange={e => setConfirmation(e.target.value)} />
    <button type="button" disabled={busy || confirmation !== 'ELIMINAR'} onClick={() => void act('delete')}>{t('Eliminar definitivamente')}</button>
    {message && <p role="status">{t(message)}</p>}
  </section>
}
