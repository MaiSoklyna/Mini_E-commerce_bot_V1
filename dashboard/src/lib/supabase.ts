import { createClient } from '@supabase/supabase-js'

const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const proxyUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

if (!supabaseAnonKey && typeof window !== 'undefined') {
  console.error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not set!')
}

// Point Supabase JS client at the FastAPI proxy instead of Supabase directly.
export const supabase = createClient(proxyUrl, supabaseAnonKey || 'placeholder', {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
})

/** Inject admin JWT so all subsequent Supabase queries are authenticated */
export function setAdminToken(token: string) {
  supabase.realtime.setAuth(token)
  // @ts-ignore — internal but stable
  supabase.rest.headers['Authorization'] = `Bearer ${token}`
  // @ts-ignore — set for storage client so file uploads are authenticated
  supabase.storage.headers = { ...supabase.storage.headers, Authorization: `Bearer ${token}` }
}

/** Revert to anon key */
export function clearAdminToken() {
  // @ts-ignore
  supabase.rest.headers['Authorization'] = `Bearer ${supabaseAnonKey}`
  // @ts-ignore
  supabase.storage.headers = { ...supabase.storage.headers, Authorization: `Bearer ${supabaseAnonKey}` }
}

// Restore admin token from localStorage at module load time to avoid
// race conditions where data fetches fire before DashboardShell's useEffect.
if (typeof window !== 'undefined') {
  const savedToken = localStorage.getItem('admin_token')
  if (savedToken) {
    setAdminToken(savedToken)
  }
}
