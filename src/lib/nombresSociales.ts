import { supabase } from './supabase'

export async function nombresSociales(ids: string[]): Promise<Record<string, string>> {
  const unicos = [...new Set(ids)]
  if (unicos.length === 0) return {}
  const { data, error } = await supabase.from('social_perfiles').select('usuario_id,nombre').in('usuario_id', unicos)
  if (error) return {}
  return Object.fromEntries((data ?? []).map(p => [p.usuario_id, p.nombre]))
}
