type Config = { diagnosticKey?: string; accessToken?: string }
export function createConnectionHandler(config: Config, requestProvider: typeof fetch = fetch) {
  const reply = (status: number, value: object) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } })
  return async (req: Request) => {
    // Private diagnostic only. Use a dedicated key, never the database service role.
    if (req.method !== 'POST') return reply(405, { ok: false, error: 'POST_REQUIRED' })
    if (req.headers.has('origin')) return reply(403, { ok: false, error: 'SERVER_ONLY' })
    if (!config.diagnosticKey || req.headers.get('x-diagnostic-key') !== config.diagnosticKey) return reply(401, { ok: false, error: 'ADMIN_REQUIRED' })
    // Some test-user credentials use APP_USR. The read-only account lookup below
    // must confirm test_user; the prefix alone never establishes sandbox status.
    if (!config.accessToken || !/^(TEST-|APP_USR-)[A-Za-z0-9-]+$/.test(config.accessToken)) return reply(503, { ok: false, error: 'TEST_CREDENTIAL_REQUIRED' })
    try {
      const result = await requestProvider('https://api.mercadopago.com/users/me', {
        method: 'GET', redirect: 'error', signal: AbortSignal.timeout(8000),
        headers: { Authorization: `Bearer ${config.accessToken}`, Accept: 'application/json' },
      })
      if (!result.ok) return reply(502, { ok: false, error: 'PROVIDER_AUTH_FAILED', providerStatus: result.status })
      const account = await result.json()
      if (account.site_id !== 'MLA' || !Array.isArray(account.tags) || !account.tags.includes('test_user')) {
        return reply(409, { ok: false, error: 'ARGENTINA_TEST_ACCOUNT_REQUIRED' })
      }
      return reply(200, {
        ok: true, provider: 'mercadopago', environment: 'sandbox', country: 'AR', currency: 'ARS',
        organizerPercent: 75, platformGrossPercent: 25, providerFeesPaidBy: 'platform',
        checkoutEnabled: false, livePaymentsEnabled: false,
        pending: ['seller_oauth', 'provider_fee_allocation', 'checkout_and_verified_webhooks'],
      })
    } catch {
      return reply(502, { ok: false, error: 'PROVIDER_UNAVAILABLE' })
    }
  }
}
