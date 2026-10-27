/* global Deno */
// Adapter for a trusted verification provider. Not a browser/parent checkbox API.
// Configure only after contracting and reviewing the provider and evidence flow.
import { createClient } from 'npm:@supabase/supabase-js@2'
Deno.serve(async req => {
  if (req.method !== 'POST') return new Response('POST required', { status: 405 })
  const secret = Deno.env.get('PARENTAL_WEBHOOK_SECRET')
  const url = Deno.env.get('SUPABASE_URL'), key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!secret || !url || !key) return new Response('Not configured', { status: 503 })
  const timestamp = req.headers.get('x-parental-timestamp') || ''
  if (!/^\d{13}$/.test(timestamp) || Math.abs(Date.now() - Number(timestamp)) > 300000) return new Response('Expired', { status: 401 })
  const body = await req.text()
  if (body.length > 2048) return new Response('Too large', { status: 413 })
  const signature = req.headers.get('x-parental-signature') || ''
  if (!/^[0-9a-f]{64}$/.test(signature)) return new Response('Unauthorized', { status: 401 })
  const hmac = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'])
  const valid = await crypto.subtle.verify('HMAC', hmac, Uint8Array.from(signature.match(/../g)!, x => parseInt(x, 16)), new TextEncoder().encode(timestamp + '.' + body))
  if (!valid) return new Response('Unauthorized', { status: 401 })
  let event: { id?: string; user_id?: string; decision?: string; evidence_reference?: string; policy_version?: string; scopes?: string[]; expires_at?: string }
  try { event = JSON.parse(body) } catch { return new Response('Invalid event', { status: 400 }) }
  if (!event || typeof event.id !== 'string' || !event.id || typeof event.user_id !== 'string' || !/^[a-f0-9-]{36}$/i.test(event.user_id) || !['verified', 'revoked'].includes(event.decision || '') || typeof event.evidence_reference !== 'string' || !event.evidence_reference) return new Response('Invalid event', { status: 400 })
  const scoped = event.decision === 'verified' && (event.policy_version !== undefined || event.scopes !== undefined || event.expires_at !== undefined)
  if (scoped && (typeof event.policy_version !== 'string' || !Array.isArray(event.scopes) || event.scopes.some(scope => typeof scope !== 'string') || typeof event.expires_at !== 'string' || !Number.isFinite(Date.parse(event.expires_at)))) return new Response('Invalid consent scope', { status: 400 })
  const db = createClient(url, key, { auth: { persistSession: false } })
  const { error } = scoped
    ? await db.rpc('privacy_parental_authorize', { p_event_id: event.id, p_user_id: event.user_id, p_evidence_reference: event.evidence_reference, p_version: event.policy_version, p_scopes: event.scopes, p_expires_at: event.expires_at })
    : await db.rpc('privacy_parental_event', { p_event_id: event.id, p_user_id: event.user_id, p_decision: event.decision, p_evidence_reference: event.evidence_reference })
  // Unique event IDs reject replay. Do not log evidence, child identifiers or secrets.
  return new Response(error ? 'Event not applied' : 'Recorded; access depends on server policy', { status: error ? 409 : 200 })
})
