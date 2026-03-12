import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { supabaseAdmin } from '../_shared/supabase-admin.ts'

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const url = new URL(req.url)
  const sessionId = url.searchParams.get('session_id')
  if (!sessionId) return errorResponse('session_id required')

  const { data: session, error } = await supabaseAdmin
    .from('login_sessions')
    .select('*')
    .eq('session_id', sessionId)
    .single()

  if (error || !session) return errorResponse('Session not found', 404)

  // Expire sessions older than 5 minutes
  const age = Date.now() - new Date(session.created_at).getTime()
  if (age > 5 * 60 * 1000 && session.status === 'pending') {
    await supabaseAdmin
      .from('login_sessions')
      .update({ status: 'expired' })
      .eq('id', session.id)

    return jsonResponse({ status: 'expired' })
  }

  if (session.status === 'completed') {
    // Fetch user data
    let user = null
    if (session.user_id) {
      const { data } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('id', session.user_id)
        .single()
      user = data
    }

    return jsonResponse({
      status: 'completed',
      token: session.jwt_token,
      user,
    })
  }

  return jsonResponse({ status: session.status })
})
