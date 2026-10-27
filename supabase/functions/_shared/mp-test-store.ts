export type TestOrder = {
 id: string; owner_id: string; seller_id: string; amount_cents: number; currency: string;
 state: string; preference_id: string | null; checkout_url: string | null;
 payment_id: string | null; refunded_cents: number; refund_key: string | null;
 provider_refund_id: string | null; fresh?: boolean;
}
export type TestStore = (action: string, payload: Record<string, unknown>) => Promise<TestOrder | TestOrder[] | null>
export function createTestStore(url: string, serviceKey: string, transport: typeof fetch = fetch): TestStore {
 return async (action, payload) => {
   const response = await transport(`${url}/rest/v1/rpc/mp_test_store`, {
     method: 'POST', headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
     body: JSON.stringify({ p_action: action, p_payload: payload }), redirect: 'error', signal: AbortSignal.timeout(10000),
   })
   if (!response.ok) throw new Error('STORE_UNAVAILABLE')
   return await response.json()
 }
}
