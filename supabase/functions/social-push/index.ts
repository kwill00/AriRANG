/* global Deno */
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

// Invocar solo desde un planificador confiable con SOCIAL_PUSH_JOB_SECRET.
Deno.serve(async req => {
  const secret = Deno.env.get('SOCIAL_PUSH_JOB_SECRET')
  if (!secret || req.headers.get('x-social-job-secret') !== secret) return new Response('Unauthorized', { status: 401 })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'VAPID_SUBJECT', 'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY']
  if (required.some(key => !Deno.env.get(key))) return new Response('Push not configured', { status: 503 })
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT')!, Deno.env.get('VAPID_PUBLIC_KEY')!, Deno.env.get('VAPID_PRIVATE_KEY')!)
  const body = await req.json().catch(() => ({}))
  if (body.test_usuario_id) {
    if (!/^[0-9a-f-]{36}$/i.test(body.test_usuario_id)) return new Response('Invalid test user', { status: 400 })
    const { data: allowed, error: accessError } = await db.rpc('privacy_push_recipient_allowed', { p_user_id: body.test_usuario_id })
    if (accessError || allowed !== true) return new Response('Recipient restricted', { status: 403 })
    const { data: devices, error } = await db.from('social_push_dispositivos').select('endpoint,p256dh,auth').eq('usuario_id', body.test_usuario_id).limit(10)
    if (error) return new Response('Devices unavailable', { status: 500 })
    const statuses = await Promise.all((devices ?? []).map(async d => {
      const url = new URL(d.endpoint)
      if (url.protocol !== 'https:' || url.username || url.password || url.port || !/^(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)$/.test(url.hostname)) return 400
      try {
        const result = await webpush.sendNotification({endpoint:d.endpoint, keys:{p256dh:d.p256dh,auth:d.auth}}, JSON.stringify({id: 'army-prueba-' + crypto.randomUUID()}), {TTL:120,timeout:8000})
        return result.statusCode
      } catch (e) { return (e as { statusCode?: number }).statusCode ?? 500 }
    }))
    return Response.json({ prueba:true, dispositivos:statuses.length, aceptados:statuses.filter(s => s >= 200 && s < 300).length, estados:statuses })
  }
  const { data: avisos, error } = await db.rpc('social_reservar_push')
  if (error) return new Response('Queue unavailable', { status: 500 })
  let enviados = 0
  for (const aviso of avisos ?? []) {
    const { data: allowed, error: accessError } = await db.rpc('privacy_push_recipient_allowed', { p_user_id: aviso.usuario_id })
    if (accessError || allowed !== true) continue
    const { data: post, error: pe } = await db.from('comunidad_publicaciones').select('autor_id,oculto,proyecto_id').eq('id', aviso.publicacion_id).maybeSingle()
    if (pe) continue
    const { data: follow, error: fe } = await db.from('social_seguimientos').select('seguidor_id').eq('seguidor_id', aviso.usuario_id).eq('seguido_id', post?.autor_id ?? '').maybeSingle()
    const { data: perfil, error: pre } = await db.from('social_perfiles').select('visible').eq('usuario_id', post?.autor_id ?? '').maybeSingle()
    if (fe || pre) continue
    let disponible = !!post && !post.oculto && !!follow && !!perfil?.visible
    if (disponible && post?.proyecto_id) {
      const { data: proyecto, error: e } = await db.from('proyectos').select('estado').eq('id', post.proyecto_id).maybeSingle()
      if (e) continue
      disponible = proyecto?.estado === 'publicado'
    }
    if (!disponible) { await db.from('social_notificaciones').update({ push_enviada: true }).eq('id', aviso.id); continue }
    const { data: dispositivos, error: de } = await db.from('social_push_dispositivos').select('endpoint,p256dh,auth').eq('usuario_id', aviso.usuario_id)
    if (de) continue
    let reintentar = false
    await Promise.all((dispositivos ?? []).map(async d => {
      try {
        const endpoint = new URL(d.endpoint)
        if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.port || !/^(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)$/.test(endpoint.hostname)) return
        await webpush.sendNotification({ endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.auth } }, JSON.stringify({ id: aviso.id }), { TTL: 3600, timeout: 8000 })
        enviados++
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) await db.from('social_push_dispositivos').delete().eq('endpoint', d.endpoint)
        else reintentar = true
      }
    }))
    await db.from('social_notificaciones').update({ push_enviada: !reintentar }).eq('id', aviso.id)
  }
  return Response.json({ enviados })
})

