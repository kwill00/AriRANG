/* global Deno */
import { createClient } from 'npm:@supabase/supabase-js@2'

Deno.serve(async req => {
  const origin = Deno.env.get('PRIVACY_APP_ORIGIN')
  const headers = { 'Access-Control-Allow-Origin': origin || 'null', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin', 'Cache-Control': 'no-store' }
  const reply = (status: number, error?: string) => Response.json(error ? { ok: false, error } : { ok: true }, { status, headers })
  if (!origin || req.headers.get('origin') !== origin) return reply(403, 'Origin not allowed')
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers })
  if (req.method !== 'POST') return reply(405, 'POST required')
  const url = Deno.env.get('SUPABASE_URL'), key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) return reply(503, 'Not configured')
  const authorization = req.headers.get('authorization') || ''
  if (!authorization.startsWith('Bearer ')) return reply(401, 'Authentication required')
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: { user }, error } = await admin.auth.getUser(authorization.slice(7))
  if (error || !user) return reply(401, 'Invalid session')
  if (Number(req.headers.get('content-length') || 0) > 1024) return reply(413, 'Request too large')
  const text = await req.text()
  if (text.length > 1024) return reply(413, 'Request too large')
  let body: { action?: string; confirmation?: string }
  try { body = JSON.parse(text) } catch { return reply(400, 'Invalid request') }
  // Never accept a target user ID, email or privilege claim from the client.
  if (body?.action === 'unsubscribe') {
    const { error } = await admin.rpc('privacy_unsubscribe', { p_user_id: user.id })
    return error ? reply(503, 'Preference not saved') : reply(200)
  }
  if (body?.action !== 'delete' || body.confirmation !== 'ELIMINAR') return reply(400, 'Confirmation required')
  const signedAt = Date.parse(user.last_sign_in_at || '')
  if (!Number.isFinite(signedAt) || Date.now() - signedAt > 10 * 60 * 1000 || signedAt > Date.now()) return reply(403, 'Sign in again before deleting')
  const { error: preflight } = await admin.rpc('privacy_deletion_preflight', { p_user_id: user.id })
  if (preflight) return reply(409, 'Data inventory or storage cleanup required')
  const { error: deletion } = await admin.auth.admin.deleteUser(user.id)
  return deletion ? reply(409, 'Deletion not completed') : reply(200)
})
