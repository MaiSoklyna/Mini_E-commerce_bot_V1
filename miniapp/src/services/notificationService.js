import { supabase } from '../lib/supabase'

/** Get user's notifications */
export async function getNotifications(limit = 100) {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .order('sent_at', { ascending: false })
      .limit(limit)

    // Table might not exist yet
    if (error) {
      console.warn('Notifications fetch error:', error.message)
      return []
    }
    return data || []
  } catch {
    return []
  }
}

/** Mark notification as read */
export async function markAsRead(id) {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', id)

  if (error) throw error
}
