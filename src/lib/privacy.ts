export const POLICY_VERSION = '2026-10-26.2'
export const CONSENT_KEY = 'army-privacy-v1'
export type Consent = { version: string; externalMedia: boolean; push: boolean; savedAt: number }
export const deniedConsent = (): Consent => ({ version: POLICY_VERSION, externalMedia: false, push: false, savedAt: Date.now() })
export function readConsent(): Consent | null {
  try {
    const value = JSON.parse(localStorage.getItem(CONSENT_KEY) || 'null')
    if (!value || value.version !== POLICY_VERSION || typeof value.externalMedia !== 'boolean' || typeof value.push !== 'boolean' || !Number.isFinite(value.savedAt) || Date.now() - value.savedAt > 180 * 86400000 || value.savedAt > Date.now()) return null
    return value
  } catch { return null }
}
export function saveConsent(value: Consent) {
  try { localStorage.setItem(CONSENT_KEY, JSON.stringify(value)) } catch { /* Remains usable in memory when storage is unavailable. */ }
  window.dispatchEvent(new CustomEvent('army-consent', { detail: value }))
}
export function permits(category: 'externalMedia' | 'push') { return readConsent()?.[category] === true }

// Never allow arbitrary schemes, credentials, data URIs or tracking pixels as avatars.
export function safeAvatar(value: unknown, allowed = permits('externalMedia')): string | undefined {
  if (!allowed || typeof value !== 'string') return undefined
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return undefined
    const supabaseHost = new URL(import.meta.env.VITE_SUPABASE_URL).hostname
    if (url.hostname !== supabaseHost && url.hostname !== 'lh3.googleusercontent.com') return undefined
    return url.href
  } catch { return undefined }
}
