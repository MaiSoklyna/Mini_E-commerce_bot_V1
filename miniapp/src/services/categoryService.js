import { supabase } from '../lib/supabase'

/** List all active categories with product count */
export async function listCategories() {
  const { data: categories, error } = await supabase
    .from('categories')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')

  if (error) throw error

  // Count products per category in a separate query
  const ids = (categories || []).map(c => c.id)
  let countMap = {}
  if (ids.length > 0) {
    const { data: products } = await supabase
      .from('products')
      .select('category_id')
      .eq('is_active', true)
      .in('category_id', ids)

    ;(products || []).forEach(p => {
      if (p.category_id) {
        countMap[p.category_id] = (countMap[p.category_id] || 0) + 1
      }
    })
  }

  return (categories || []).map(c => ({
    ...c,
    product_count: countMap[c.id] || 0,
  }))
}
