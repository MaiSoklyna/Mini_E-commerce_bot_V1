import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { supabaseAdmin } from '../_shared/supabase-admin.ts'
import { getUserFromRequest } from '../_shared/jwt.ts'
import { comparePassword, hashPassword } from '../_shared/bcrypt.ts'

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const payload = await getUserFromRequest(req)
    if (!payload) return errorResponse('Unauthorized', 401)

    const { current_password, new_password } = await req.json()
    if (!current_password || !new_password) {
      return errorResponse('Both current and new passwords required')
    }

    const role = payload.role as string
    const adminId = parseInt(payload.sub as string)
    const table = role === 'super_admin' ? 'super_admins' : 'merchant_admins'

    // Fetch current hash
    const { data: row, error } = await supabaseAdmin
      .from(table)
      .select('password_hash')
      .eq('id', adminId)
      .single()

    if (error || !row) return errorResponse('Admin not found', 404)

    const valid = await comparePassword(current_password, row.password_hash)
    if (!valid) return errorResponse('Current password is incorrect', 400)

    const newHash = hashPassword(new_password)

    const { error: updateError } = await supabaseAdmin
      .from(table)
      .update({ password_hash: newHash })
      .eq('id', adminId)

    if (updateError) return errorResponse('Update failed: ' + updateError.message, 500)

    return jsonResponse({ success: true, message: 'Password changed' })
  } catch (err) {
    return errorResponse(err.message || 'Internal error', 500)
  }
})
