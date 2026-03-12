import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { supabaseAdmin } from '../_shared/supabase-admin.ts'
import { signJwt } from '../_shared/jwt.ts'

const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || ''

async function hmacVerify(data: Record<string, string>, hash: string): Promise<boolean> {
  const enc = new TextEncoder()
  const secretKey = await crypto.subtle.importKey(
    'raw', enc.encode('WebAppData'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const secret = await crypto.subtle.sign('HMAC', secretKey, enc.encode(BOT_TOKEN))

  const checkString = Object.keys(data)
    .filter(k => k !== 'hash')
    .sort()
    .map(k => `${k}=${data[k]}`)
    .join('\n')

  const key = await crypto.subtle.importKey(
    'raw', secret, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(checkString))
  const computed = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
  return computed === hash
}

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    const body = await req.json()
    const { telegram_id, username, first_name, last_name } = body

    if (!telegram_id) return errorResponse('telegram_id required')

    // Upsert user
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .upsert(
        {
          telegram_id,
          username: username || `user_${telegram_id}`,
          first_name: first_name || '',
          last_name: last_name || '',
        },
        { onConflict: 'telegram_id' },
      )
      .select()
      .single()

    if (error) return errorResponse('Failed to upsert user: ' + error.message, 500)

    // Mint JWT
    const token = await signJwt({
      sub: String(user.id),
      telegram_id: user.telegram_id,
      role: 'authenticated',
    })

    return jsonResponse({
      access_token: token,
      token_type: 'bearer',
      expires_in: 86400,
      user,
    })
  } catch (err) {
    return errorResponse(err.message || 'Internal error', 500)
  }
})
