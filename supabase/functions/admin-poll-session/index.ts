import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { supabaseAdmin } from '../_shared/supabase-admin.ts'

const SESSION_TTL_MINUTES = 5

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const url = new URL(req.url)
    const sessionId = url.searchParams.get('session_id')

    if (!sessionId) return errorResponse('session_id required')

    const { data: row, error } = await supabaseAdmin
      .from('login_sessions')
      .select('session_id, jwt_token, user_id, status, created_at')
      .eq('session_id', sessionId)
      .single()

    if (error || !row) return errorResponse('Session not found', 404)

    // Check expiry
    const created = new Date(row.created_at)
    const now = new Date()
    if (now.getTime() - created.getTime() > SESSION_TTL_MINUTES * 60 * 1000) {
      await supabaseAdmin
        .from('login_sessions')
        .update({ status: 'expired' })
        .eq('session_id', sessionId)
      return jsonResponse({ status: 'expired' })
    }

    if (row.status === 'completed' && row.jwt_token) {
      // Fetch merchant admin + merchant name
      const { data: admin } = await supabaseAdmin
        .from('merchant_admins')
        .select('id, merchant_id, full_name, email, role')
        .eq('id', row.user_id)
        .single()

      let merchantName = null
      if (admin?.merchant_id) {
        const { data: merchant } = await supabaseAdmin
          .from('merchants')
          .select('name')
          .eq('id', admin.merchant_id)
          .single()
        merchantName = merchant?.name || null
      }

      // Clean up used session
      await supabaseAdmin
        .from('login_sessions')
        .delete()
        .eq('session_id', sessionId)

      const userData = admin
        ? {
            id: admin.id,
            email: admin.email,
            name: admin.full_name,
            role: 'merchant' as const,
            merchant_id: admin.merchant_id,
            merchant_name: merchantName,
          }
        : null

      return jsonResponse({
        status: 'completed',
        token: row.jwt_token,
        user: userData,
      })
    }

    return jsonResponse({ status: 'pending' })
  } catch (err) {
    return errorResponse(err.message || 'Internal error', 500)
  }
})
