import type { TestOrder, TestStore } from './mp-test-store.ts'
export function testProvider(token: string, transport: typeof fetch = fetch) {
 const api = async (path: string, method = 'GET', body?: object, idempotencyKey?: string) => {
   const response = await transport(`https://api.mercadopago.com${path}`, {
     method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : {}) },
     ...(body ? { body: JSON.stringify(body) } : {}), redirect: 'error', signal: AbortSignal.timeout(10000),
   })
   if (!response.ok) throw new Error('PROVIDER_UNAVAILABLE')
   return await response.json()
 }
 return {
   api,
   async seller() {
     const seller = await api('/users/me')
     if (seller.site_id !== 'MLA' || !Array.isArray(seller.tags) || !seller.tags.includes('test_user') || !/^\d+$/.test(String(seller.id))) throw new Error('TEST_ACCOUNT_REQUIRED')
     return String(seller.id)
   },
   async sync(order: TestOrder, paymentId: string, seller: string, store: TestStore, eventKey: string) {
     if (!/^\d{1,25}$/.test(paymentId)) throw new Error('INVALID_PAYMENT_ID')
     const payment = await api(`/v1/payments/${paymentId}`)
     if (String(payment.id) !== paymentId || payment.live_mode !== false || payment.external_reference !== `armytest_${order.id}`
       || payment.currency_id !== 'ARS' || payment.transaction_amount !== 100 || String(payment.collector_id) !== seller || order.seller_id !== seller) throw new Error('PAYMENT_MISMATCH')
     const refunded = payment.transaction_amount_refunded
     const refundedCents = Math.round(refunded * 100)
     if (typeof refunded !== 'number' || !Number.isFinite(refunded) || refunded<0 || refunded>100 || Math.abs(refunded*100-refundedCents)>0.000001
       || !Number.isFinite(Date.parse(payment.date_last_updated))) throw new Error('INVALID_PAYMENT')
     return await store('apply', { id: order.id, liveMode: false, paymentId, seller, amountCents: 10000, currency: 'ARS',
       state: payment.status, refundedCents, updatedAt: payment.date_last_updated, eventKey }) as TestOrder
   },
 }
}
