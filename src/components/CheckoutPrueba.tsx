import { useState } from 'react'
import { supabase } from '../lib/supabase'

const storageKey = 'army-checkout-test-order-v2'
type Order = { orderId: string; status: string; amount: number; currency: string; refundedAmount: number; refundRequested: boolean; environment: string; splitApplied: boolean; livePaymentsEnabled: boolean }
const states: Record<string, string> = { creating: 'creación pendiente de conciliación', approved: 'aprobado', pending: 'pendiente', in_process: 'en proceso', rejected: 'rechazado', cancelled: 'cancelado', partially_refunded: 'reembolso parcial', refunded: 'reembolsado', charged_back: 'con contracargo' }
function readOrder() { try { return sessionStorage.getItem(storageKey) || '' } catch { return '' } }
export default function CheckoutPrueba() {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [checkoutUrl, setCheckoutUrl] = useState('')
  const [orderId, setOrderId] = useState(readOrder)
  const [order, setOrder] = useState<Order | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [confirmation, setConfirmation] = useState('')
  const [manualPaymentId, setManualPaymentId] = useState(new URLSearchParams(window.location.search).get('payment_id') || '')
  const returning = new URLSearchParams(window.location.search).get('checkout_test') === 'return'
  async function run(action: 'create' | 'verify' | 'status' | 'list' | 'refund') {
    if (busy) return
    setBusy(true); setMessage(''); setCheckoutUrl('')
    try {
      let requestId = sessionStorage.getItem('army-checkout-test-request-v2')
      if (action === 'create' && !requestId) { requestId = crypto.randomUUID(); sessionStorage.setItem('army-checkout-test-request-v2', requestId) }
      if (!['create','list'].includes(action) && !orderId) throw new Error('Elegí una orden del historial o creá una nueva prueba.')
      const paymentId = manualPaymentId.trim()
      const body = action === 'create' ? { action, requestId } : action === 'list' ? { action }
        : { action, orderId, ...(action === 'verify' && paymentId ? { paymentId } : {}), ...(action === 'refund' ? { confirmation } : {}) }
      const { data, error } = await supabase.functions.invoke('mercadopago-checkout-test', { body })
      if (error) throw new Error('No se pudo completar la prueba. Verificá que tu cuenta sea administradora adulta y tenga los consentimientos vigentes. No se confirmó ningún pago.')
      if (action === 'list') { if (!Array.isArray(data?.orders)) throw new Error('Historial inválido.'); setOrders(data.orders); return }
      if (!data || typeof data.orderId !== 'string' || !states[data.status] || data.environment !== 'sandbox' || data.amount !== 100 || data.currency !== 'ARS' || data.splitApplied !== false || data.livePaymentsEnabled !== false) throw new Error('Respuesta de prueba inválida.')
      setOrder(data); setOrderId(data.orderId); sessionStorage.setItem(storageKey, data.orderId)
      if (action === 'create') {
        const url = new URL(data.checkoutUrl)
        if (url.protocol !== 'https:' || url.hostname !== 'www.mercadopago.com.ar' || url.username || url.password || url.port || data.environment !== 'sandbox' || data.amount !== 100 || data.currency !== 'ARS' || data.splitApplied !== false) throw new Error('Respuesta de checkout inválida.')
        setCheckoutUrl(url.href)
        setMessage('Checkout preparado. Continuá con una cuenta compradora de prueba de Argentina.')
      } else {
        setMessage(`Estado de la orden de prueba: ${states[data.status]}. No acredita aportes ni reparto a organizadoras.`)
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo completar la prueba.') }
    finally { setBusy(false) }
  }
  return <section className="perfil-card" aria-labelledby="checkout-test-title">
    <h3 id="checkout-test-title">Checkout de prueba · Mercado Pago</h3>
    <p>Solo administración. Importe ficticio: <strong>ARS 100</strong>. Usá únicamente una cuenta compradora y tarjetas de prueba de Mercado Pago.</p>
    <p>Política acordada: organizadora 75%, ARMY World 25%; las comisiones se absorben dentro de la parte de ARMY World. Esta prueba verifica el checkout de una cuenta vendedora ficticia: <strong>todavía no aplica el split</strong> ni crea aportes o suscripciones reales.</p>
    <button type="button" disabled={busy} onClick={() => void run('create')}>{busy ? 'Procesando…' : 'Preparar checkout de prueba · ARS 100'}</button>
    {checkoutUrl && <p><a href={checkoutUrl}>Continuar en Mercado Pago · Solo prueba</a></p>}
    {returning && <p>Volviste de Mercado Pago. La dirección de retorno no demuestra que el pago esté aprobado.</p>}
    {orderId && <div><label htmlFor="test-payment-id">Identificador de pago de prueba (opcional si llegó la notificación)</label>
      <input id="test-payment-id" value={manualPaymentId} onChange={event=>setManualPaymentId(event.target.value)} inputMode="numeric" autoComplete="off" />
      <button type="button" disabled={busy} onClick={() => void run('verify')}>Verificar resultado con Mercado Pago</button></div>}
    <div className="privacy-actions">
      <button type="button" disabled={busy || !orderId} onClick={() => void run('status')}>Actualizar estado guardado</button>
      <button type="button" disabled={busy} onClick={() => void run('list')}>Recuperar mis pruebas</button>
      <button type="button" disabled={busy} onClick={() => { sessionStorage.removeItem('army-checkout-test-request-v2'); sessionStorage.removeItem(storageKey); setOrderId(''); setOrder(null); setConfirmation(''); setCheckoutUrl(''); setMessage('Podés preparar una nueva prueba.'); }}>Nueva prueba</button>
    </div>
    {orders.length>0 && <ul>{orders.map(item=><li key={item.orderId}><button type="button" disabled={busy} onClick={()=>{setOrderId(item.orderId);setOrder(item);setConfirmation('');sessionStorage.setItem(storageKey,item.orderId)}}>Orden {item.orderId.slice(0,8)} · {states[item.status] || 'estado desconocido'}</button></li>)}</ul>}
    {order && <p>Estado guardado: {states[order.status]}. Reembolsado: ARS {order.refundedAmount}. {order.refundRequested && order.status !== 'refunded' ? 'Reembolso solicitado; falta confirmar el resultado del proveedor.' : ''}</p>}
    {order?.status === 'approved' && order.refundedAmount === 0 && <fieldset><legend>Reembolso total de prueba · ARS 100</legend>
      <label htmlFor="test-refund-confirmation">Escribí REEMBOLSAR PRUEBA para confirmar</label>
      <input id="test-refund-confirmation" value={confirmation} onChange={event=>setConfirmation(event.target.value)} autoComplete="off" />
      <button type="button" disabled={busy || confirmation !== 'REEMBOLSAR PRUEBA'} onClick={()=>void run('refund')}>{order.refundRequested ? 'Reintentar reembolso de prueba' : 'Reembolsar prueba · ARS 100'}</button>
    </fieldset>}
    {message && <p role="status">{message}</p>}
  </section>
}
