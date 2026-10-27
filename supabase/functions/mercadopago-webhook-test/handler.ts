import type { TestOrder, TestStore } from '../_shared/mp-test-store.ts'
import { testProvider } from '../_shared/mp-test-provider.ts'
import { isIsolatedTestProject } from '../_shared/mp-test-config.ts'
type Config = { accessToken?: string; webhookSecret?: string; supabaseUrl?: string; projectRef?: string }
export function createWebhookHandler(config: Config, store: TestStore, transport: typeof fetch = fetch, now = () => Date.now()) {
 return async (request: Request) => {
   const reply = (status: number) => Response.json({ received: status === 200 }, { status, headers: { 'Cache-Control': 'no-store' } })
   if (request.method !== 'POST') return reply(405)
   if (!isIsolatedTestProject(config.supabaseUrl, config.projectRef) || !config.accessToken || !config.webhookSecret) return reply(503)
   try {
     const url = new URL(request.url)
     const ids = url.searchParams.getAll('data.id')
     const requestId = request.headers.get('x-request-id') || ''
     const signature = request.headers.get('x-signature') || ''
     const match = /^ts=(\d{10}|\d{13}),\s*v1=([a-fA-F0-9]{64})$/.exec(signature)
     if (ids.length !== 1 || !/^\d{1,25}$/.test(ids[0]) || !/^[A-Za-z0-9_-]{1,100}$/.test(requestId) || !match) return reply(401)
     const time = Number(match[1]) * (match[1].length === 10 ? 1000 : 1)
     if (now()-time>300000 || time-now()>60000) return reply(401)
     const encoder = new TextEncoder()
     const key = await crypto.subtle.importKey('raw', encoder.encode(config.webhookSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'])
     const digest = Uint8Array.from(match[2].match(/../g)!, pair => parseInt(pair,16))
     const valid = await crypto.subtle.verify('HMAC', key, digest, encoder.encode(`id:${ids[0]};request-id:${requestId};ts:${match[1]};`))
     if (!valid) return reply(401)
     const text = await request.text()
     if (text.length>4096) return reply(413)
     const body = JSON.parse(text)
     if (body.type !== 'payment' || String(body.data?.id) !== ids[0]) return reply(400)
     const provider = testProvider(config.accessToken, transport)
     const seller = await provider.seller()
     // First lookup supplies only the reference. sync independently re-fetches and
     // verifies all payment invariants before any ledger mutation.
     const payment = await provider.api(`/v1/payments/${ids[0]}`)
     const reference = /^armytest_([0-9a-f-]{36})$/i.exec(payment.external_reference ?? '')
     if (!reference) return reply(400)
     const order = await store('find', { id: reference[1] }) as TestOrder | null
     if (!order) return reply(404)
     const eventKey = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(`${signature}|${requestId}|${ids[0]}`)))).map(x=>x.toString(16).padStart(2,'0')).join('')
     await provider.sync(order, ids[0], seller, store, `webhook:${eventKey}`)
     return reply(200)
   } catch { return reply(503) } // Retry instead of acknowledging unpersisted work.
 }
}
