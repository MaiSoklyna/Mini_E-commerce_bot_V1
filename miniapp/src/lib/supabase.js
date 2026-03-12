import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const edgeFunctionUrl = import.meta.env.VITE_EDGE_FUNCTION_URL

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
})

/** Inject a custom JWT so all subsequent Supabase requests are authenticated */
export function setSupabaseToken(token) {
  supabase.realtime.setAuth(token)
  // Override the global headers used by the REST client
  supabase.rest.headers = {
    ...supabase.rest.headers,
    Authorization: `Bearer ${token}`,
  }
}

/** Revert to the anon key (logout) */
export function clearSupabaseToken() {
  supabase.rest.headers = {
    ...supabase.rest.headers,
    Authorization: `Bearer ${supabaseAnonKey}`,
  }
}

/**
 * Call a Supabase Edge Function.
 * @param {string} fnName  — function name (e.g. "telegram-auth")
 * @param {object} [body]  — JSON body
 * @param {string} [token] — JWT to send as Authorization header
 */
export async function callEdgeFunction(fnName, body = null, token = null) {
  const headers = {
    'Content-Type': 'application/json',
    'apikey': supabaseAnonKey,
    'Authorization': `Bearer ${token || supabaseAnonKey}`,
  }

  const res = await fetch(`${edgeFunctionUrl}/${fnName}`, {
    method: 'POST',
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw { response: { status: res.status, data: err }, message: err.detail || res.statusText }
  }

  return res.json()
}

/**
 * Call an Edge Function with GET method.
 */
export async function callEdgeFunctionGet(fnName, params = {}, token = null) {
  const headers = {
    'apikey': supabaseAnonKey,
    'Authorization': `Bearer ${token || supabaseAnonKey}`,
  }

  const qs = new URLSearchParams(params).toString()
  const url = `${edgeFunctionUrl}/${fnName}${qs ? '?' + qs : ''}`

  const res = await fetch(url, { method: 'GET', headers })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw { response: { status: res.status, data: err }, message: err.detail || res.statusText }
  }

  return res.json()
}
