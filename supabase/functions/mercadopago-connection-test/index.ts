import { createConnectionHandler } from './handler.ts'

Deno.serve(createConnectionHandler({
  diagnosticKey: Deno.env.get('MERCADOPAGO_DIAGNOSTIC_KEY'),
  accessToken: Deno.env.get('MERCADOPAGO_ACCESS_TOKEN_TEST'),
}))
