import test from 'node:test'
import assert from 'node:assert/strict'
import { createCheckoutHandler } from '../supabase/functions/mercadopago-checkout-test/handler.ts'
const config = { accessToken: 'APP_USR-fixture', supabaseUrl: 'https://fixture.supabase.co', anonKey: 'public-fixture', origin: 'https://armytravellatam.com' }
const request = (body, headers = {}) => new Request('https://fixture/check', { method: 'POST', headers: { authorization: 'Bearer user-fixture', origin: config.origin, ...headers }, body: JSON.stringify(body) })
const user = 'user-1', account = { id: 42, site_id: 'MLA', tags: ['test_user'] }
const calls = []
function mock(options = {}) {
  return async (url, init) => {
    calls.push({ url, init })
    if (url.endsWith('/auth/v1/user')) return Response.json({ id: user }, { status: options.authFail ? 401 : 200 })
    if (url.endsWith('/rpc/es_admin')) return Response.json(!options.notAdmin)
    if (url.endsWith('/rpc/privacy_access_allowed')) return Response.json(!options.minor)
    if (url.endsWith('/users/me')) return Response.json(options.account || account)
    if (url.endsWith('/checkout/preferences')) {
      const preference = JSON.parse(init.body)
      assert.equal(preference.items[0].unit_price, 100)
      assert.equal(preference.items[0].currency_id, 'ARS')
      assert.equal(preference.marketplace_fee, undefined)
      options.reference = preference.external_reference
      return Response.json({ id: 'pref-1', collector_id: options.badCollector ? 7 : 42, init_point: options.badUrl || 'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=test' })
    }
    if (url.includes('/v1/payments/')) return Response.json({ live_mode: false, collector_id: 42, external_reference: options.reference, currency_id: 'ARS', transaction_amount: 100, status: 'approved', ...options.payment })
    throw new Error('Unexpected request')
  }
}
test('server rejects strangers, minors and non-admins before any provider request', async () => {
  for (const option of [{ authFail: true }, { notAdmin: true }, { minor: true }]) {
    calls.length = 0
    const response = await createCheckoutHandler(config, mock(option))(request({ action: 'create' }))
    assert.ok([401,403].includes(response.status))
    assert.equal(calls.some(c => c.url.startsWith('https://api.mercadopago.com')), false)
  }
})
test('preflight is permitted; foreign origins, malformed bodies and amount manipulation are rejected', async () => {
  const handler = createCheckoutHandler(config, mock())
  assert.equal((await handler(new Request('https://fixture/check',{method:'OPTIONS',headers:{origin:config.origin}}))).status,204)
  assert.equal((await handler(request({action:'create'},{origin:'https://evil.test'}))).status,403)
  assert.equal((await handler(request({action:'create',amount:1}))).status,400)
  assert.equal((await handler(request({action:'live'}))).status,400)
})
test('real or non-Argentina sellers can never produce a checkout', async () => {
  for (const account of [{id:42,site_id:'MLA',tags:[]},{id:42,site_id:'MLB',tags:['test_user']}]) {
    calls.length=0
    assert.equal((await createCheckoutHandler(config,mock({account}))(request({action:'create'}))).status,409)
    assert.equal(calls.some(c=>c.url.endsWith('/checkout/preferences')),false)
  }
})
test('creates only fixed ARS100 test checkout and cryptographically binds verification to user and order', async () => {
  const options = {}
  const handler=createCheckoutHandler(config,mock(options))
  const response=await handler(request({action:'create'}))
  assert.equal(response.status,200)
  const created=await response.json()
  assert.equal(created.splitApplied,false)
  assert.equal(created.environment,'sandbox')
  assert.equal(created.checkoutUrl.startsWith('https://www.mercadopago.com.ar/'),true)
  assert.equal((await handler(request({action:'verify',token:created.token+'a',paymentId:'123'}))).status,403)
  const verified=await handler(request({action:'verify',token:created.token,paymentId:'123'}))
  assert.equal(verified.status,200)
  assert.equal((await verified.json()).status,'approved')
  for(const payment of [{live_mode:true},{transaction_amount:101},{external_reference:'other'},{collector_id:7},{currency_id:'USD'}]) {
    options.payment=payment
    assert.equal((await handler(request({action:'verify',token:created.token,paymentId:'123'}))).status,409)
  }
})
test('rejects foreign redirect hosts and collector mismatches',async()=>{
  for(const options of [{badUrl:'https://evil.test/pay'},{badCollector:true}]) assert.equal((await createCheckoutHandler(config,mock(options))(request({action:'create'}))).status,502)
})
test('a return URL or arbitrary payment ID is not proof of a payment; provider errors are sanitized',async()=>{
  const handler=createCheckoutHandler(config,mock())
  assert.equal((await handler(request({action:'verify',paymentId:'123'}))).status,400)
  assert.equal((await handler(request({action:'verify',token:'invalid',paymentId:'../123'}))).status,400)
  const failed=await createCheckoutHandler(config,async()=>{throw new Error('PRIVATE DETAIL')})(request({action:'create'}))
  assert.equal(failed.status,502)
  assert.equal((await failed.text()).includes('PRIVATE DETAIL'),false)
})
