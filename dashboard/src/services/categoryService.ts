import { supabase } from '../lib/supabase'

/** List all categories with product counts */
export async function listCategories() {
  const { data: categories, error } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order')

  if (error) throw error

  // Get product counts
  if (categories && categories.length > 0) {
    const { data: products } = await supabase
      .from('products')
      .select('category_id')

    const counts: Record<number, number> = {}
    ;(products || []).forEach((p: any) => {
      if (p.category_id) counts[p.category_id] = (counts[p.category_id] || 0) + 1
    })

    // Get merchant names for non-global categories
    const merchantIds = Array.from(new Set(categories.map(c => c.merchant_id).filter(Boolean)))
    let merchantMap: Record<number, string> = {}
    if (merchantIds.length > 0) {
      const { data: merchants } = await supabase
        .from('merchants')
        .select('id, name')
        .in('id', merchantIds)
      ;(merchants || []).forEach((m: any) => { merchantMap[m.id] = m.name })
    }

    categories.forEach((c: any) => {
      c.product_count = counts[c.id] || 0
      c.merchant_name = c.merchant_id ? merchantMap[c.merchant_id] || 'Merchant' : null
    })
  }

  return categories || []
}

/** Strip frontend-only fields before sending to DB */
function dbPayload(data: any) {
  const { is_global, ...rest } = data
  return rest
}

/** Create category */
export async function createCategory(data: any) {
  const { data: category, error } = await supabase
    .from('categories')
    .insert(dbPayload(data))
    .select()
    .single()

  if (error) throw error
  return category
}

/** Update category */
export async function updateCategory(id: number, data: any) {
  const { error } = await supabase
    .from('categories')
    .update(dbPayload(data))
    .eq('id', id)

  if (error) throw error
}

/** Delete category */
export async function deleteCategory(id: number) {
  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', id)

  if (error) throw error
}
