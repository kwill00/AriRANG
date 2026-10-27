// Historical v1 retained for regression tests and comparison with the deployed
// version. index.ts exclusively uses lifecycle.ts; there is no fallback to v1.
type Config = { accessToken?: string; supabaseUrl?: string; anonKey?: string; origin: string }
const AMOUNT = 100
const encoder = new TextEncoder()
async function sign(value: string, secret: string) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value)))).map(b => b.toString(16).padStart(2, '0')).join('')
}
export function createCheckoutHandler(config: Config, providerFetch: typeof fetch = fetch) {
  return async (req: Request) => {
    const headers = { 'Access-Control-Allow-Origin': config.origin, 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin', 'Cache-Control': 'no-store' }
    const reply = (status: number, body: object) => Response.json(body, { status, headers })
    if (req.headers.get('origin') && req.headers.get('origin') !== config.origin) return reply(403, { error: 'ORIGIN_NOT_ALLOWED' })
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers })
    if (req.method !== 'POST') return reply(405, { error: 'POST_REQUIRED' })
    const authorization = req.headers.get('authorization') || ''
    if (!authorization.startsWith('Bearer ')) return reply(401, { error: 'SIGN_IN_REQUIRED' })
    if (!config.accessToken || !/^(TEST-|APP_USR-)[A-Za-z0-9-]+$/.test(config.accessToken) || !config.supabaseUrl || !config.anonKey) return reply(503, { error: 'TEST_NOT_CONFIGURED' })
    const api = async (url: string, options: RequestInit = {}) => providerFetch(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(10000) })
    try {
      const authHeaders = { Authorization: authorization, apikey: config.anonKey, 'Content-Type': 'application/json' }
      const userResponse = await api(`${config.supabaseUrl}/auth/v1/user`, { headers: authHeaders })
      if (!userResponse.ok) return reply(401, { error: 'SIGN_IN_REQUIRED' })
      const user = await userResponse.json()
      if (!user.id) return reply(401, { error: 'SIGN_IN_REQUIRED' })
      for (const rpc of ['es_admin', 'privacy_access_allowed']) {
        const check = await api(`${config.supabaseUrl}/rest/v1/rpc/${rpc}`, { method: 'POST', headers: authHeaders, body: '{}' })
        if (!check.ok || await check.json() !== true) return reply(403, { error: 'ADULT_ADMIN_REQUIRED' })
      }
      const text = await req.text()
      if (text.length > 4096) return reply(413, { error: 'REQUEST_TOO_LARGE' })
      let body: { action?: string; token?: string; paymentId?: string; [key: string]: unknown }
      try { body = JSON.parse(text) } catch { return reply(400, { error: 'INVALID_REQUEST' }) }
      if (!['create', 'verify'].includes(body.action || '')) return reply(400, { error: 'INVALID_ACTION' })
      if (Object.keys(body).some(k => !['action', 'token', 'paymentId'].includes(k))) return reply(400, { error: 'UNEXPECTED_FIELD' })
      const mpHeaders = { Authorization: `Bearer ${config.accessToken}`, 'Content-Type': 'application/json' }
      const accountResponse = await api('https://api.mercadopago.com/users/me', { headers: mpHeaders })
      if (!accountResponse.ok) return reply(502, { error: 'PROVIDER_AUTH_FAILED' })
      const account = await accountResponse.json()
      if (account.site_id !== 'MLA' || !account.tags?.includes('test_user') || !account.id) return reply(409, { error: 'TEST_ACCOUNT_REQUIRED' })
      if (body.action === 'create') {
        const reference = `armytest_${crypto.randomUUID()}`
        const expires = Date.now() + 60 * 60 * 1000
        const payload = `${reference}|${user.id}|${expires}`
        const token = `${btoa(payload)}.${await sign(payload, config.accessToken)}`
        const back = `${config.origin}/?checkout_test=return`
        const preferenceResponse = await api('https://api.mercadopago.com/checkout/preferences', {
          method: 'POST', headers: mpHeaders, body: JSON.stringify({
            items: [{ id: 'army-checkout-test-ars100', title: 'ARMY Travel - PRUEBA sin aporte real', currency_id: 'ARS', quantity: 1, unit_price: AMOUNT }],
            external_reference: reference, back_urls: { success: back, failure: back, pending: back },
            expires: true, expiration_date_from: new Date().toISOString(), expiration_date_to: new Date(expires).toISOString(),
          }),
        })
        if (!preferenceResponse.ok) return reply(502, { error: 'CHECKOUT_CREATION_FAILED' })
        const preference = await preferenceResponse.json()
        if (String(preference.collector_id) !== String(account.id)) return reply(502, { error: 'SELLER_MISMATCH' })
        const url = new URL(preference.init_point)
        if (url.protocol !== 'https:' || url.hostname !== 'www.mercadopago.com.ar' || url.username || url.password || url.port) return reply(502, { error: 'INVALID_CHECKOUT_URL' })
        return reply(200, { checkoutUrl: url.href, token, environment: 'sandbox', amount: AMOUNT, currency: 'ARS', splitApplied: false })
      }
      if (typeof body.token !== 'string' || typeof body.paymentId !== 'string' || !/^\d{1,25}$/.test(body.paymentId)) return reply(400, { error: 'INVALID_VERIFICATION' })
      const parts = body.token.split('.')
      if (parts.length !== 2) return reply(400, { error: 'INVALID_ORDER' })
      let payload: string
      try { payload = atob(parts[0]) } catch { return reply(400, { error: 'INVALID_ORDER' }) }
      const [reference, owner, expiry] = payload.split('|')
      if (owner !== user.id || !reference?.startsWith('armytest_') || !Number.isFinite(Number(expiry)) || Number(expiry) < Date.now() || parts[1] !== await sign(payload, config.accessToken)) return reply(403, { error: 'INVALID_ORDER' })
      const paymentResponse = await api(`https://api.mercadopago.com/v1/payments/${body.paymentId}`, { headers: mpHeaders })
      if (!paymentResponse.ok) return reply(502, { error: 'PAYMENT_NOT_VERIFIED' })
      const payment = await paymentResponse.json()
      if (payment.live_mode !== false || payment.external_reference !== reference || payment.currency_id !== 'ARS' || payment.transaction_amount !== AMOUNT || String(payment.collector_id) !== String(account.id)) return reply(409, { error: 'PAYMENT_MISMATCH' })
      const states = ['approved', 'pending', 'in_process', 'rejected', 'cancelled', 'refunded', 'charged_back']
      return reply(200, { verified: true, status: states.includes(payment.status) ? payment.status : 'unknown', amount: AMOUNT, currency: 'ARS', environment: 'sandbox', splitApplied: false, livePaymentsEnabled: false })
    } catch { return reply(502, { error: 'SERVICE_UNAVAILABLE' }) }
  }
}
