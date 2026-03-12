import { callEdgeFunction, callEdgeFunctionGet } from '../lib/supabase'

/** Authenticate via Telegram data */
export async function telegramAuth(telegramData) {
  return callEdgeFunction('telegram-auth', telegramData)
}

/** Get current user from JWT */
export async function getMe(token) {
  return callEdgeFunctionGet('get-me', {}, token)
}

/** Update user profile */
export async function updateProfile(token, data) {
  return callEdgeFunction('update-profile', data, token)
}

/** Create a login session (returns session_id) */
export async function createLoginSession() {
  return callEdgeFunction('create-login-session')
}

/** Poll login session status */
export async function pollLoginSession(sessionId) {
  return callEdgeFunctionGet('poll-login-session', { session_id: sessionId })
}
