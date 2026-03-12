import { supabase } from '../lib/supabase'

/** List user's support tickets with merchant names */
export async function listTickets() {
  const { data: tickets, error } = await supabase
    .from('support_tickets')
    .select('*')
    .order('updated_at', { ascending: false })

  if (error) throw error

  // Get merchant names separately
  const merchantIds = [...new Set((tickets || []).map(t => t.merchant_id).filter(Boolean))]
  let merchantMap = {}
  if (merchantIds.length > 0) {
    const { data: merchants } = await supabase
      .from('merchants')
      .select('id, name')
      .in('id', merchantIds)

    ;(merchants || []).forEach(m => { merchantMap[m.id] = m.name })
  }

  return (tickets || []).map(t => ({
    ...t,
    merchant_name: merchantMap[t.merchant_id] || 'Shop',
  }))
}

/** Get a single ticket with messages */
export async function getTicket(ticketId) {
  const [ticketRes, messagesRes] = await Promise.all([
    supabase.from('support_tickets').select('*').eq('id', ticketId).single(),
    supabase.from('ticket_messages').select('*').eq('ticket_id', ticketId).order('created_at'),
  ])

  if (ticketRes.error) throw ticketRes.error

  // Get merchant name
  let merchant_name = 'Shop'
  if (ticketRes.data.merchant_id) {
    const { data: merchant } = await supabase
      .from('merchants')
      .select('name')
      .eq('id', ticketRes.data.merchant_id)
      .single()
    merchant_name = merchant?.name || 'Shop'
  }

  return {
    ...ticketRes.data,
    merchant_name,
    messages: messagesRes.data || [],
  }
}

/** Create a new support ticket */
export async function createTicket(data) {
  const { data: ticket, error } = await supabase
    .from('support_tickets')
    .insert({
      user_id: data.user_id,
      merchant_id: data.merchant_id,
      subject: data.subject,
    })
    .select()
    .single()

  if (error) throw error

  // Insert first message
  if (data.message) {
    await supabase.from('ticket_messages').insert({
      ticket_id: ticket.id,
      sender_type: 'customer',
      sender_id: data.user_id,
      body: data.message,
    })
  }

  return ticket
}

/** Send a message on a ticket */
export async function sendMessage(ticketId, userId, body) {
  const { error } = await supabase
    .from('ticket_messages')
    .insert({
      ticket_id: ticketId,
      sender_type: 'customer',
      sender_id: userId,
      body,
    })

  if (error) throw error
}
