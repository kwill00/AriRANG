import { supabase } from './supabase'
const PENDING_KEY = 'army-push-removal-pending'
export async function revokePush() {
  let endpoint: string | null = null
  try { endpoint = localStorage.getItem(PENDING_KEY) } catch { /* Storage may be disabled. */ }
  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.getRegistration('/social-push-sw.js')
    const subscription = await registration?.pushManager?.getSubscription()
    if (subscription) {
      endpoint = subscription.endpoint
      try { localStorage.setItem(PENDING_KEY, endpoint) } catch { /* Still unsubscribe locally. */ }
      if (!await subscription.unsubscribe()) throw new Error('push-unsubscribe-failed')
    }
  }
  if (endpoint) {
    const { error } = await supabase.rpc('social_eliminar_push', { p_endpoint: endpoint })
    if (error) throw new Error('push-server-removal-pending')
    try { localStorage.removeItem(PENDING_KEY) } catch { /* No tracking storage is introduced. */ }
  }
}
