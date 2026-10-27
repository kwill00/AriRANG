import { supabase } from './supabase'
import { revokePush } from './pushPrivacy'
export async function signOutPrivately() {
  // Stop this browser's subscription before losing the identity needed to remove it.
  // A failed remote cleanup is retained for retry, but must not trap a user signed in.
  await revokePush().catch(() => { /* Browser subscription is removed first. */ })
  return supabase.auth.signOut()
}
