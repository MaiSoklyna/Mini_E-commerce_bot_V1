import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { supabaseAdmin } from '../_shared/supabase-admin.ts'

function generateSessionId(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  const base64 = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  return 'dash_' + base64
}

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const sessionId = generateSessionId()

    const { error } = await supabaseAdmin
      .from('login_sessions')
      .insert({ session_id: sessionId })

    if (error) return errorResponse('Failed to create session: ' + error.message, 500)

    return jsonResponse({ session_id: sessionId })
  } catch (err) {
    return errorResponse(err.message || 'Internal error', 500)
  }
})
