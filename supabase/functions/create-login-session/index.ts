import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { supabaseAdmin } from '../_shared/supabase-admin.ts'

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const sessionId = crypto.randomUUID()

  const { error } = await supabaseAdmin
    .from('login_sessions')
    .insert({ session_id: sessionId, status: 'pending' })

  if (error) return errorResponse('Failed to create session: ' + error.message, 500)

  return jsonResponse({ session_id: sessionId })
})
