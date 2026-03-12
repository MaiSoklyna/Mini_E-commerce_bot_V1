const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

async function post(path: string, body: any) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw { response: { status: res.status, data: err }, message: err.detail || res.statusText }
  }
  return res.json()
}

async function get(path: string, params: Record<string, any> = {}) {
  const qs = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) qs.set(k, String(v))
  })
  const url = `${API_BASE}${path}${qs.toString() ? '?' + qs.toString() : ''}`
  const res = await fetch(url)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw { response: { status: res.status, data: err }, message: err.detail || res.statusText }
  }
  return res.json()
}

/** Admin email/password login */
export async function adminLogin(email: string, password: string, role: string) {
  return post('/api/admin/login', { email, password, role })
}

/** Create Telegram login session for admin */
export async function createTgSession() {
  return post('/api/admin/tg-session', {})
}

/** Poll Telegram login session */
export async function pollTgSession(sessionId: string) {
  return get('/api/admin/poll-session', { session_id: sessionId })
}

/** Update admin profile */
export async function updateProfile(token: string, data: { name: string; email: string }) {
  const res = await fetch(`${API_BASE}/api/admin/update-profile`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw { response: { status: res.status, data: err }, message: err.detail || res.statusText }
  }
  return res.json()
}

/** Change admin password */
export async function changePassword(token: string, data: { current_password: string; new_password: string }) {
  const res = await fetch(`${API_BASE}/api/admin/change-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw { response: { status: res.status, data: err }, message: err.detail || res.statusText }
  }
  return res.json()
}
