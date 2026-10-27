import { createLifecycleHandler } from './lifecycle.ts'
Deno.serve(createLifecycleHandler({
  accessToken: Deno.env.get('MERCADOPAGO_ACCESS_TOKEN_TEST'),
  projectRef: Deno.env.get('MERCADOPAGO_TEST_PROJECT_REF'),
  supabaseUrl: Deno.env.get('SUPABASE_URL'),
  anonKey: Deno.env.get('SUPABASE_ANON_KEY'),
  serviceKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
  notificationUrl: Deno.env.get('MERCADOPAGO_WEBHOOK_TEST_URL'),
  origin: Deno.env.get('MERCADOPAGO_TEST_ORIGIN') ?? 'http://localhost:5173',
}))
