import { create, verify, getNumericDate } from 'https://deno.land/x/djwt@v3.0.2/mod.ts'

const JWT_SECRET = Deno.env.get('JWT_SECRET') || Deno.env.get('SUPABASE_JWT_SECRET') || ''

async function getKey() {
  const enc = new TextEncoder()
  return await crypto.subtle.importKey(
    'raw',
    enc.encode(JWT_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

export async function signJwt(payload: Record<string, unknown>, expiresInSeconds = 86400) {
  const key = await getKey()

  // Supabase PostgREST requires role="authenticated" + aud="authenticated"
  // to treat the request as an authenticated user (not anon).
  // We store the app-level role in "app_role" so RLS policies can use it.
  const { role: appRole, ...rest } = payload

  return await create(
    { alg: 'HS256', typ: 'JWT' },
    {
      ...rest,
      role: 'authenticated',
      aud: 'authenticated',
      app_role: appRole || 'customer',
      iss: 'supabase',
      iat: getNumericDate(0),
      exp: getNumericDate(expiresInSeconds),
    },
    key,
  )
}

export async function verifyJwt(token: string) {
  const key = await getKey()
  return await verify(token, key)
}

/** Extract and verify JWT from Authorization header */
export async function getUserFromRequest(req: Request) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return null

  try {
    const token = authHeader.replace('Bearer ', '')
    const payload = await verifyJwt(token)
    return payload as Record<string, unknown>
  } catch {
    return null
  }
}
