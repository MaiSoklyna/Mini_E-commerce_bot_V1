import { supabase } from '../lib/supabase'

interface ListParams {
  limit?: number
  status?: string
  search?: string
}

/** List support tickets */
export async function listTickets(params: ListParams = {}) {
  const { limit = 50, status, search } = params

  let query = supabase.from('support_tickets').select('*')

  if (status) query = query.eq('status', status)
  if (search) query = query.or(`subject.ilike.%${search}%`)

  query = query.order('updated_at', { ascending: false }).limit(limit)

  const { data: tickets, error, count } = await query
  if (error) throw error

  // Enrich with customer info and message counts
  if (tickets && tickets.length > 0) {
    const userIds = Array.from(new Set(tickets.map(t => t.user_id).filter(Boolean)))
    const ticketIds = tickets.map(t => t.id)

    const [usersRes, messagesRes] = await Promise.all([
      userIds.length > 0
        ? supabase.from('users').select('id, first_name, last_name, username').in('id', userIds)
        : { data: [] },
      supabase.from('ticket_messages').select('ticket_id, body, created_at').in('ticket_id', ticketIds),
    ])

    const userMap: Record<number, any> = {}
    ;(usersRes.data || []).forEach((u: any) => {
      userMap[u.id] = {
        name: u.first_name ? `${u.first_name}${u.last_name ? ' ' + u.last_name : ''}` : null,
        username: u.username,
      }
    })

    // Group messages by ticket
    const msgByTicket: Record<number, any[]> = {}
    ;(messagesRes.data || []).forEach((m: any) => {
      if (!msgByTicket[m.ticket_id]) msgByTicket[m.ticket_id] = []
      msgByTicket[m.ticket_id].push(m)
    })

    tickets.forEach((t: any) => {
      const u = userMap[t.user_id] || {}
      t.customer_name = u.name || null
      t.customer_username = u.username || null
      const msgs = msgByTicket[t.id] || []
      t.message_count = msgs.length
      if (msgs.length > 0) {
        const sorted = msgs.sort((a: any, b: any) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
        t.last_message = sorted[0].body
      }
    })
  }

  return {
    data: tickets || [],
    meta: { total: count || tickets?.length || 0 },
  }
}

/** Get single ticket with messages */
export async function getTicket(ticketId: number) {
  const [ticketRes, messagesRes] = await Promise.all([
    supabase.from('support_tickets').select('*').eq('id', ticketId).single(),
    supabase.from('ticket_messages').select('*').eq('ticket_id', ticketId).order('created_at'),
  ])

  if (ticketRes.error) throw ticketRes.error

  // Get customer info
  let customer_name = null
  let customer_username = null
  if (ticketRes.data.user_id) {
    const { data: user } = await supabase
      .from('users')
      .select('first_name, last_name, username')
      .eq('id', ticketRes.data.user_id)
      .single()

    if (user) {
      customer_name = user.first_name
        ? `${user.first_name}${user.last_name ? ' ' + user.last_name : ''}`
        : null
      customer_username = user.username
    }
  }

  return {
    ...ticketRes.data,
    customer_name,
    customer_username,
    messages: messagesRes.data || [],
  }
}

/** Reply to a ticket */
export async function replyToTicket(ticketId: number, message: string, adminId?: number) {
  // Insert message
  const { error: msgError } = await supabase
    .from('ticket_messages')
    .insert({
      ticket_id: ticketId,
      sender_type: 'merchant',
      sender_id: adminId || 0,
      body: message,
    })

  if (msgError) throw msgError

  // Update ticket status to replied
  await supabase
    .from('support_tickets')
    .update({ status: 'replied', updated_at: new Date().toISOString() })
    .eq('id', ticketId)
}

/** Close a ticket */
export async function closeTicket(ticketId: number) {
  const { error } = await supabase
    .from('support_tickets')
    .update({ status: 'closed', updated_at: new Date().toISOString() })
    .eq('id', ticketId)

  if (error) throw error
}
