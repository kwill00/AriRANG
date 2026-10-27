import { createTestStore } from '../_shared/mp-test-store.ts'
import type { TestOrder, TestStore } from '../_shared/mp-test-store.ts'
import { testProvider } from '../_shared/mp-test-provider.ts'
import { isIsolatedTestProject } from '../_shared/mp-test-config.ts'

type Config = { accessToken?: string; supabaseUrl?: string; projectRef?: string; anonKey?: string; serviceKey?: string; origin: string; notificationUrl?: string }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function orderView(order: TestOrder) {
 return { orderId: order.id, status: order.state, paymentId: order.payment_id, amount: 100, currency: 'ARS', refundedAmount: order.refunded_cents / 100,
   refundRequested: !!order.refund_key, environment: 'sandbox', splitApplied: false, livePaymentsEnabled: false }
}
export function createLifecycleHandler(config: Config, transport: typeof fetch = fetch, injectedStore?: TestStore) {
 return async (request: Request) => {
   const headers = { 'Access-Control-Allow-Origin': config.origin, 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
     'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin', 'Cache-Control': 'no-store' }
   const reply = (status: number, body: object) => Response.json(body, { status, headers })
   if (request.headers.get('origin') !== config.origin) return reply(403, { error: 'ORIGIN_NOT_ALLOWED' })
   if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
   if (request.method !== 'POST') return reply(405, { error: 'POST_REQUIRED' })
   if (!isIsolatedTestProject(config.supabaseUrl, config.projectRef) || !config.accessToken || !config.supabaseUrl || !config.anonKey || (!config.serviceKey && !injectedStore)) return reply(503, { error: 'TEST_NOT_CONFIGURED' })
   const authorization = request.headers.get('authorization') || ''
   if (!authorization.startsWith('Bearer ')) return reply(401, { error: 'SIGN_IN_REQUIRED' })
   const store = injectedStore ?? createTestStore(config.supabaseUrl, config.serviceKey!, transport)
   try {
     const authHeaders = { Authorization: authorization, apikey: config.anonKey, 'Content-Type': 'application/json' }
     const callAuth = async (path: string, method = 'GET') => transport(`${config.supabaseUrl}${path}`, {
       method, headers: authHeaders, ...(method === 'POST' ? { body: '{}' } : {}), redirect: 'error', signal: AbortSignal.timeout(10000),
     })
     const auth = await callAuth('/auth/v1/user')
     if (!auth.ok) return reply(401, { error: 'SIGN_IN_REQUIRED' })
     const user = await auth.json()
     if (!uuid.test(user.id)) return reply(401, { error: 'SIGN_IN_REQUIRED' })
     for (const rpc of ['es_admin', 'privacy_access_allowed']) {
       const check = await callAuth(`/rest/v1/rpc/${rpc}`, 'POST')
       if (!check.ok || await check.json() !== true) return reply(403, { error: 'ADULT_ADMIN_REQUIRED' })
     }
     const text = await request.text()
     if (text.length > 4096) return reply(413, { error: 'REQUEST_TOO_LARGE' })
     let body: Record<string, unknown>
     try { body = JSON.parse(text) } catch { return reply(400, { error: 'INVALID_REQUEST' }) }
     if (!body || Array.isArray(body) || typeof body !== 'object') return reply(400, { error: 'INVALID_REQUEST' })
     if (Object.keys(body).some(key => !['action', 'orderId', 'requestId', 'paymentId', 'confirmation'].includes(key))) return reply(400, { error: 'UNEXPECTED_FIELD' })
     if (!['create', 'list', 'status', 'verify', 'refund'].includes(String(body.action))) return reply(400, { error: 'INVALID_ACTION' })
     if (body.action === 'list') {
       const orders = await store('list', { owner: user.id }) as TestOrder[]
       return reply(200, { orders: orders.map(orderView) })
     }
     const provider = testProvider(config.accessToken, transport)
     const seller = await provider.seller() // Never infer sandbox from a token prefix.
     if (body.action === 'create') {
       if (typeof body.requestId !== 'string' || !uuid.test(body.requestId)) return reply(400, { error: 'REQUEST_ID_REQUIRED' })
       const order = await store('create', { owner: user.id, seller, requestKey: body.requestId }) as TestOrder
       if (!order.fresh) {
         if (order.checkout_url && order.preference_id) return reply(200, { ...orderView(order), checkoutUrl: order.checkout_url })
         return reply(409, { error: 'CHECKOUT_CREATION_UNCERTAIN', orderId: order.id })
       }
       // No automatic preference retry after an ambiguous timeout. Same request returns
       // the persisted preference, or requires reconciliation, never another checkout.
       // Mercado Pago requires a named HTTPS return URL. The staging function is
       // static and never marks an order as paid or redirects into production.
       const back = `${config.supabaseUrl}/functions/v1/mercadopago-return-test`
       let notificationUrl: string | undefined
       if (config.notificationUrl) {
         const notification = new URL(config.notificationUrl)
         if (notification.protocol !== 'https:' || notification.username || notification.password || notification.search || notification.hash
           || notification.origin !== new URL(config.supabaseUrl).origin || notification.pathname !== '/functions/v1/mercadopago-webhook-test') throw new Error('INVALID_WEBHOOK_URL')
         notificationUrl = notification.href
       }
       const preference = await provider.api('/checkout/preferences', 'POST', {
         items: [{ id: 'army-checkout-test-ars100', title: 'ARMY Travel - PRUEBA sin aporte real', currency_id: 'ARS', quantity: 1, unit_price: 100 }],
         external_reference: `armytest_${order.id}`, back_urls: { success: back, failure: back, pending: back },
         ...(notificationUrl ? { notification_url: notificationUrl } : {}),
         expires: true, expiration_date_from: new Date().toISOString(), expiration_date_to: new Date(Date.now()+3600000).toISOString(),
       })
       const url = new URL(preference.init_point)
       if (!preference.id || String(preference.collector_id) !== seller || url.protocol !== 'https:' || url.hostname !== 'www.mercadopago.com.ar'
         || url.username || url.password || url.port) return reply(502, { error: 'INVALID_CHECKOUT' })
       const saved = await store('preference', { id: order.id, preference: String(preference.id), url: url.href }) as TestOrder
       return reply(200, { ...orderView(saved), checkoutUrl: url.href })
     }
     if (typeof body.orderId !== 'string' || !uuid.test(body.orderId)) return reply(400, { error: 'ORDER_ID_REQUIRED' })
     const order = await store('get', { id: body.orderId, owner: user.id }) as TestOrder
     if (order.seller_id !== seller) return reply(409, { error: 'SELLER_MISMATCH' })
     if (body.action === 'status') return reply(200, orderView(order))
     if (body.action === 'verify') {
       const paymentId = body.paymentId ?? order.payment_id
       if (typeof paymentId !== 'string' || !/^\d{1,25}$/.test(paymentId)) return reply(400, { error: 'PAYMENT_ID_REQUIRED' })
       const updated = await provider.sync(order, paymentId, seller, store, `manual:${crypto.randomUUID()}`)
       return reply(200, { ...orderView(updated), verified: true })
     }
     if (body.confirmation !== 'REEMBOLSAR PRUEBA') return reply(400, { error: 'REFUND_CONFIRMATION_REQUIRED' })
     if (!order.payment_id) return reply(409, { error: 'APPROVED_PAYMENT_REQUIRED' })
     const current = await provider.sync(order, order.payment_id, seller, store, `refund-preflight:${crypto.randomUUID()}`)
     if (current.state === 'refunded') return reply(200, orderView(current))
     if (current.state !== 'approved' || current.refunded_cents !== 0) return reply(409, { error: 'FULL_REFUND_NOT_AVAILABLE' })
     const reserved = await store('reserve_refund', { id: order.id }) as TestOrder
     const refund = await provider.api(`/v1/payments/${current.payment_id}/refunds`, 'POST', {}, reserved.refund_key!)
     if (!refund.id || refund.amount !== 100 || refund.status !== 'approved' || String(refund.payment_id) !== current.payment_id) return reply(502, { error: 'REFUND_NOT_CONFIRMED' })
     await store('save_refund', { id: order.id, refundId: String(refund.id), refundKey: reserved.refund_key })
     const updated = await provider.sync(current, current.payment_id!, seller, store, `refund-result:${crypto.randomUUID()}`)
     return reply(200, orderView(updated)) // Only GET /payments can confirm refunded state.
   } catch { return reply(502, { error: 'TEST_OPERATION_NOT_CONFIRMED' }) }
 }
}
