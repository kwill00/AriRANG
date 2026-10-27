// A production project must never run the new staging payment lifecycle.
export function isIsolatedTestProject(url: string | undefined, reference: string | undefined) {
 if (!url || !reference || !/^[a-z]{20}$/.test(reference) || reference === 'buhgdsnxmmoqshvoyyth') return false
 try {
   const parsed = new URL(url)
   return parsed.origin === `https://${reference}.supabase.co` && parsed.pathname === '/' && !parsed.search && !parsed.hash && !parsed.username && !parsed.password
 } catch { return false }
}
