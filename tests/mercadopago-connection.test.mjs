import test from 'node:test'
import assert from 'node:assert/strict'
import { createConnectionHandler } from '../supabase/functions/mercadopago-connection-test/handler.ts'
const config = { diagnosticKey: 'admin-fixture', accessToken: 'TEST-fixture' }
const request = (headers = {}) => new Request('https://example.test/check', { method: 'POST', headers: { 'x-diagnostic-key': 'admin-fixture', ...headers } })
const testAccount = { site_id: 'MLA', tags: ['test_user'], email: 'private@example.test' }
test('rejects unauthenticated, browser, and non-POST requests before contacting provider', async () => {
  const handler = createConnectionHandler(config, () => { throw new Error('must not call provider') })
  assert.equal((await handler(request({ 'x-diagnostic-key': 'other' }))).status, 401)
  assert.equal((await handler(request({ origin: 'https://armytravellatam.com' }))).status, 403)
  assert.equal((await handler(new Request('https://example.test/check'))).status, 405)
})
test('missing diagnostic key and missing or malformed provider credentials fail closed', async () => {
  for (const token of [undefined, '', 'Bearer TEST-fixture', 'invalid']) {
    const handler = createConnectionHandler({ ...config, accessToken: token }, () => { throw new Error('must not call provider') })
    assert.equal((await handler(request())).status, 503)
  }
  assert.equal((await createConnectionHandler({ accessToken: config.accessToken })(request())).status, 401)
})
test('checks only the Argentina test account, returns agreed policy without private data or checkout', async () => {
  let calls = 0
  const handler = createConnectionHandler(config, async (url, options) => {
    calls++
    assert.equal(url, 'https://api.mercadopago.com/users/me')
    assert.equal(options.method, 'GET')
    assert.equal(options.redirect, 'error')
    assert.equal(options.headers.Authorization, 'Bearer TEST-fixture')
    return Response.json(testAccount)
  })
  const response = await handler(request())
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('Cache-Control'), 'no-store')
  const body = await response.json()
  assert.equal(body.organizerPercent, 75)
  assert.equal(body.platformGrossPercent, 25)
  assert.equal(body.providerFeesPaidBy, 'platform')
  assert.equal(body.currency, 'ARS')
  assert.equal(body.checkoutEnabled, false)
  assert.equal(body.livePaymentsEnabled, false)
  assert.equal(JSON.stringify(body).includes(testAccount.email), false)
  assert.equal(JSON.stringify(body).includes(config.accessToken), false)
  assert.equal(calls, 1)
})
test('rejects real accounts, other countries and malformed provider data', async () => {
  for (const account of [{ site_id: 'MLA', tags: [] }, { ...testAccount, site_id: 'MLB' }, {}, null]) {
    const response = await createConnectionHandler(config, async () => Response.json(account))(request())
    assert.ok([409, 502].includes(response.status))
  }
})
test('APP_USR credentials require a verified Argentina test account', async () => {
  const appConfig = { ...config, accessToken: 'APP_USR-fixture' }
  assert.equal((await createConnectionHandler(appConfig, async () => Response.json(testAccount))(request())).status, 200)
  assert.equal((await createConnectionHandler(appConfig, async () => Response.json({ site_id: 'MLA', tags: [] }))(request())).status, 409)
})
test('provider errors never expose response bodies, credentials or exceptions', async () => {
  for (const provider of [async () => new Response('sensitive detail', { status: 401 }), async () => { throw new Error('private failure') }]) {
    const response = await createConnectionHandler(config, provider)(request())
    assert.equal(response.status, 502)
    const text = await response.text()
    assert.equal(/sensitive detail|private failure|TEST-fixture/.test(text), false)
  }
})
