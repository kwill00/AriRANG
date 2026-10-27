// Read-only public readiness checks. Never prints configuration values or API keys.
const expected = process.argv[process.argv.indexOf('--project-ref') + 1]
if (!process.argv.includes('--project-ref') || !/^[a-z]{20}$/.test(expected ?? '')) {
  console.error('Indicá --project-ref con el proyecto que autorizaste revisar.')
  process.exit(1)
}
let url
try { url = new URL(process.env.VITE_SUPABASE_URL) } catch {
  console.error('Falta una URL Supabase válida en el entorno local.'); process.exit(1)
}
if (url.protocol !== 'https:' || url.hostname !== `${expected}.supabase.co` || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
  console.error('El entorno local no coincide con el proyecto autorizado. No se envió ninguna solicitud.')
  process.exit(1)
}
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
if (!key) { console.error('Falta la clave pública de la aplicación en el entorno local.'); process.exit(1) }
for (const rpc of ['privacy_registration_ready', 'privacy_teen_registration_ready']) {
  try {
    const headers = { apikey: key, 'Content-Type': 'application/json' }
    // Legacy anon JWTs need Authorization; modern publishable keys use apikey.
    if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`
    const result = await fetch(new URL(`/rest/v1/rpc/${rpc}`, url), {
      method: 'POST', headers, body: '{}', signal: AbortSignal.timeout(15000), redirect: 'error',
    })
    const body = await result.json().catch(() => null)
    const state = result.ok && typeof body === 'boolean' ? (body ? 'habilitado' : 'deshabilitado')
      : result.status === 404 && body?.code === 'PGRST202' ? 'función no disponible en la API'
      : `no se pudo comprobar (HTTP ${result.status})`
    console.log(`${rpc}: ${state}`)
    if (!result.ok || typeof body !== 'boolean') process.exitCode = 1
  } catch {
    console.error(`${rpc}: no se pudo conectar; no se modificó el servidor.`)
    process.exitCode = 1
  }
}
