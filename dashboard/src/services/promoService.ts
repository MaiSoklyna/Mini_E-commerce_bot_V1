import { supabase } from '../lib/supabase'

/** List all promo codes */
export async function listPromos() {
  const { data: promos, error } = await supabase
    .from('promo_codes')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error

  // Enrich with merchant names
  if (promos && promos.length > 0) {
    const merchantIds = Array.from(new Set(promos.map(p => p.merchant_id).filter(Boolean)))
    if (merchantIds.length > 0) {
      const { data: merchants } = await supabase
        .from('merchants')
        .select('id, name')
        .in('id', merchantIds)

      const merchantMap: Record<number, string> = {}
      ;(merchants || []).forEach((m: any) => { merchantMap[m.id] = m.name })

      promos.forEach((p: any) => {
        p.merchant_name = p.merchant_id ? merchantMap[p.merchant_id] || null : null
      })
    }
  }

  return promos || []
}

/** Strip frontend-only fields before sending to DB */
function dbPayload(data: any) {
  const { start_date, end_date, ...rest } = data
  return rest
}

/** Create promo code */
export async function createPromo(data: any) {
  const { data: promo, error } = await supabase
    .from('promo_codes')
    .insert(dbPayload(data))
    .select()
    .single()

  if (error) throw error
  return promo
}

/** Update promo code */
export async function updatePromo(id: number, data: any) {
  const { error } = await supabase
    .from('promo_codes')
    .update(dbPayload(data))
    .eq('id', id)

  if (error) throw error
}

/** Patch promo code (partial update) */
export async function patchPromo(id: number, data: any) {
  const { error } = await supabase
    .from('promo_codes')
    .update(data)
    .eq('id', id)

  if (error) throw error
}

/** Delete promo code */
export async function deletePromo(id: number) {
  const { error } = await supabase
    .from('promo_codes')
    .delete()
    .eq('id', id)

  if (error) throw error
}
