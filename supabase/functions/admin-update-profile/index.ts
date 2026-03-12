import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { supabaseAdmin } from '../_shared/supabase-admin.ts'
import { getUserFromRequest } from '../_shared/jwt.ts'

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const payload = await getUserFromRequest(req)
    if (!payload) return errorResponse('Unauthorized', 401)

    const { name, email } = await req.json()
    if (!name && !email) return errorResponse('Provide at least name or email')

    const role = payload.role as string
    const adminId = parseInt(payload.sub as string)

    if (role === 'super_admin') {
      const updates: Record<string, string> = {}
      if (name) updates.full_name = name
      if (email) updates.email = email

      const { error } = await supabaseAdmin
        .from('super_admins')
        .update(updates)
        .eq('id', adminId)

      if (error) return errorResponse('Update failed: ' + error.message, 500)
    } else {
      const updates: Record<string, string> = {}
      if (name) updates.full_name = name
      if (email) updates.email = email

      const { error } = await supabaseAdmin
        .from('merchant_admins')
        .update(updates)
        .eq('id', adminId)

      if (error) return errorResponse('Update failed: ' + error.message, 500)
    }

    return jsonResponse({ success: true, message: 'Profile updated' })
  } catch (err) {
    return errorResponse(err.message || 'Internal error', 500)
  }
})
