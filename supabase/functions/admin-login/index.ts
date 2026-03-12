import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { supabaseAdmin } from '../_shared/supabase-admin.ts'
import { signJwt } from '../_shared/jwt.ts'
import { comparePassword } from '../_shared/bcrypt.ts'

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const { email, password, role } = await req.json()

    if (!email || !password) return errorResponse('Email and password required')

    if (role === 'super_admin') {
      const { data: admin, error } = await supabaseAdmin
        .from('super_admins')
        .select('id, full_name, email, password_hash, is_active')
        .eq('email', email.trim())
        .single()

      if (error || !admin) return errorResponse('Invalid credentials', 401)
      if (!admin.is_active) return errorResponse('Account is inactive', 401)

      const valid = await comparePassword(password, admin.password_hash)
      if (!valid) return errorResponse('Invalid credentials', 401)

      // Update last_login
      await supabaseAdmin
        .from('super_admins')
        .update({ last_login: new Date().toISOString() })
        .eq('id', admin.id)

      const token = await signJwt({
        sub: String(admin.id),
        role: 'super_admin',
        email: admin.email,
      })

      return jsonResponse({
        success: true,
        data: {
          access_token: token,
          expires_in: 86400,
          user: {
            id: admin.id,
            email: admin.email,
            name: admin.full_name,
            role: 'super_admin',
          },
        },
      })
    }

    // Merchant admin login
    const { data: admin, error } = await supabaseAdmin
      .from('merchant_admins')
      .select('id, merchant_id, full_name, email, password_hash, role, is_active')
      .eq('email', email.trim())
      .single()

    if (error || !admin) return errorResponse('Invalid credentials', 401)
    if (!admin.is_active) return errorResponse('Account is inactive', 401)

    const valid = await comparePassword(password, admin.password_hash)
    if (!valid) return errorResponse('Invalid credentials', 401)

    // Check merchant status
    const { data: merchant } = await supabaseAdmin
      .from('merchants')
      .select('name, status')
      .eq('id', admin.merchant_id)
      .single()

    if (merchant?.status === 'suspended') {
      return errorResponse('MERCHANT_SUSPENDED', 403)
    }

    // Update last_login
    await supabaseAdmin
      .from('merchant_admins')
      .update({ last_login: new Date().toISOString() })
      .eq('id', admin.id)

    const token = await signJwt({
      sub: String(admin.id),
      role: 'merchant',
      merchant_id: admin.merchant_id,
      email: admin.email,
    })

    return jsonResponse({
      success: true,
      data: {
        access_token: token,
        expires_in: 86400,
        user: {
          id: admin.id,
          email: admin.email,
          name: admin.full_name,
          role: 'merchant',
          merchant_id: admin.merchant_id,
          merchant_name: merchant?.name || null,
        },
      },
    })
  } catch (err) {
    return errorResponse(err.message || 'Internal error', 500)
  }
})
