import { createWebhookHandler } from './handler.ts'
import { createTestStore } from '../_shared/mp-test-store.ts'
const url = Deno.env.get('SUPABASE_URL')
const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
// Keep disabled if the server store is not configured.
Deno.serve(createWebhookHandler({
 accessToken: Deno.env.get('MERCADOPAGO_ACCESS_TOKEN_TEST'),
 supabaseUrl: url,
 projectRef: Deno.env.get('MERCADOPAGO_TEST_PROJECT_REF'),
 webhookSecret: url && key ? Deno.env.get('MERCADOPAGO_WEBHOOK_SECRET_TEST') : undefined,
}, createTestStore(url ?? '', key ?? '')))
