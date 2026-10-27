import { useState } from 'react'
import { useLanguage, useT } from '../lib/locale'

// Deliberately has no auth, database, analytics or storage dependency.
export default function GuestPlanner({ onExit, embedded = false }: { onExit: () => void; embedded?: boolean }) {
  const t = useT()
  const language = useLanguage()
  const [goal, setGoal] = useState('')
  const [saved, setSaved] = useState('')
  const [weekly, setWeekly] = useState('')
  const amount = (value: string) => {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? Math.min(999999.99, Math.max(0, parsed)) : 0
  }
  const remaining = Math.max(0, amount(goal) - amount(saved))
  const weeks = amount(weekly) > 0 ? Math.ceil(remaining / amount(weekly)) : null
  const money = (value: number) => new Intl.NumberFormat(language, { style: 'currency', currency: 'USD' }).format(value)
  const Container = embedded ? 'section' : 'main'
  return <Container className="guest-planner" aria-labelledby="guest-title">
    {embedded ? <h2 id="guest-title">{t('Planificador privado')}</h2> : <h1 id="guest-title">{t('ARMY Travel para visitantes')}</h1>}
    {!embedded && <p>{t('Podés usar este planificador sin crear una cuenta, también si sos menor.')}</p>}
    <p className="sharing-notice">{t('Los importes quedan solo en la memoria de esta página. No se envían al servidor ni se guardan en el navegador. Se borran al salir o recargar.')}</p>
    <section aria-labelledby="guest-budget-title">
      <h2 id="guest-budget-title">{t('Mi plan de ahorro de prueba')}</h2>
      <p>{t('Usá importes orientativos. Este cálculo no cobra, reserva ni recomienda una compra.')}</p>
      <label htmlFor="guest-goal">{t('Objetivo de ahorro (USD)')}</label>
      <input id="guest-goal" type="number" min="0" max="999999.99" step="0.01" inputMode="decimal" autoComplete="off" value={goal} onChange={e => setGoal(e.target.value)} />
      <label htmlFor="guest-saved">{t('Ahorro actual (USD)')}</label>
      <input id="guest-saved" type="number" min="0" max="999999.99" step="0.01" inputMode="decimal" autoComplete="off" value={saved} onChange={e => setSaved(e.target.value)} />
      <label htmlFor="guest-weekly">{t('Aporte semanal estimado (USD)')}</label>
      <input id="guest-weekly" type="number" min="0" max="999999.99" step="0.01" inputMode="decimal" autoComplete="off" value={weekly} onChange={e => setWeekly(e.target.value)} />
      <div role="status" aria-live="polite" aria-atomic="true" className="guest-result">
        <p>{t('Importe restante: {importe}', { importe: money(remaining) })}</p>
        {amount(goal) > 0 && remaining === 0 ? <p>{t('¡Objetivo de ahorro alcanzado!')}</p> : weeks !== null ? <p>{t('Semanas estimadas: {cantidad}', { cantidad: weeks })}</p> : <p>{t('Indicá un aporte semanal para estimar el tiempo.')}</p>}
      </div>
      <button type="button" onClick={() => { setGoal(''); setSaved(''); setWeekly('') }}>{t('Borrar cálculo')}</button>
    </section>
    {!embedded && <><section><h2>{t('Qué permite este modo')}</h2><p>{t('No requiere edad, nombre, correo, documentos ni datos de un adulto. No muestra perfiles, publicaciones ni datos de otras personas.')}</p><p>{t('De 14 a 17 años se puede solicitar cuenta propia cuando el servicio esté habilitado. Antes de los 14, una cuenta necesita autorización parental. El modo visitante no requiere cuenta.')}</p></section><button type="button" onClick={onExit}>{t('Salir del modo visitante')}</button></>}
  </Container>
}
