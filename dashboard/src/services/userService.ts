import { supabase } from '../lib/supabase'

interface ListParams {
  page?: number
  limit?: number
  search?: string
}

/** List users with pagination */
export async function listUsers(params: ListParams = {}) {
  const { page = 1, limit = 20, search } = params

  let query = supabase.from('users').select('*', { count: 'exact' })

  if (search) {
    query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,username.ilike.%${search}%`)
  }

  query = query
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1)

  const { data, error, count } = await query
  if (error) throw error

  return {
    data: data || [],
    meta: {
      page,
      limit,
      total: count || 0,
      total_pages: Math.ceil((count || 0) / limit),
    },
  }
}

/** Get single user with order history */
export async function getUser(id: number) {
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error

  // Get recent orders
  const { data: orders } = await supabase
    .from('orders')
    .select('id, order_code, total, status, created_at')
    .eq('user_id', id)
    .order('created_at', { ascending: false })
    .limit(10)

  return { ...user, orders: orders || [] }
}

/** Toggle user active status */
export async function toggleUserStatus(id: number, is_active: boolean) {
  const { error } = await supabase
    .from('users')
    .update({ is_active })
    .eq('id', id)

  if (error) throw error
}
