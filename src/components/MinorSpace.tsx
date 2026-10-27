import { useT } from '../lib/locale'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import GuestPlanner from './GuestPlanner'
import SafeCommunity from './SafeCommunity'
import PrivacyAccount from './PrivacyAccount'
import { signOutPrivately } from '../lib/accountSession'
export default function MinorSpace() {
  const t = useT()
  const [canParticipate, setCanParticipate] = useState(false)
  useEffect(() => {
    let active = true
    void supabase.rpc('community_safe_participant').then(({ data, error }) => { if (active) setCanParticipate(!error && data === true) })
    return () => { active = false }
  }, [])
  return <main className="minor-space"><section className="access-gate"><h1>{t('Mi espacio protegido')}</h1><p>{t('Tu cuenta usa un espacio para menores con publicaciones revisadas. No habilita pagos ni el directorio de perfiles.')}</p><button type="button" onClick={() => void signOutPrivately()}>{t('🚪 Cerrar sesión')}</button></section><GuestPlanner embedded onExit={() => void signOutPrivately()} />{canParticipate && <SafeCommunity />}<PrivacyAccount /></main>
}
