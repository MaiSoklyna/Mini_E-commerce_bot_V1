import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import api from '../api/axios'

const AuthContext = createContext(null)
const BOT_USERNAME = 'FavouriteOfShop_bot'
const POLL_INTERVAL = 2000 // 2 seconds
const POLL_TIMEOUT = 5 * 60 * 1000 // 5 minutes

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loginPending, setLoginPending] = useState(false)
  const pollRef = useRef(null)
  const timeoutRef = useRef(null)

  useEffect(() => { initAuth() }, [])

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  async function initAuth() {
    try {
      // STEP 1: Check URL ?auth= token (from bot's "Open Shop" button)
      let urlToken = new URLSearchParams(window.location.search).get('auth')
      if (!urlToken && window.location.hash) {
        urlToken = new URLSearchParams(window.location.hash.replace('#', '?')).get('auth')
      }

      if (urlToken) {
        localStorage.setItem('token', urlToken)
        window.history.replaceState({}, '', window.location.pathname)
        try {
          const res = await api.get('/auth/me')
          setUser(res.data)
          return
        } catch (e) {
          console.error('Token from URL failed:', e)
          localStorage.removeItem('token')
        }
      }

      // STEP 2: Check existing token in localStorage
      const savedToken = localStorage.getItem('token')
      if (savedToken) {
        try {
          const res = await api.get('/auth/me')
          setUser(res.data)
          return
        } catch (e) {
          console.error('Saved token failed:', e)
          localStorage.removeItem('token')
        }
      }

      // STEP 3: Telegram WebApp (when opened as a Mini App inside Telegram)
      const tg = window.Telegram?.WebApp
      if (tg?.initDataUnsafe?.user) {
        const u = tg.initDataUnsafe.user
        const res = await api.post('/auth/telegram', {
          telegram_id: u.id,
          username: u.username || `user_${u.id}`,
          first_name: u.first_name || '',
          last_name: u.last_name || '',
        })
        localStorage.setItem('token', res.data.access_token)
        setUser(res.data.user)
        tg.ready()
        tg.expand()
        return
      }

      // No auth available
    } catch (err) {
      console.error('Auth error:', err)
      localStorage.removeItem('token')
    } finally {
      setLoading(false)
    }
  }

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null }
    setLoginPending(false)
  }, [])

  const startLoginSession = useCallback(async () => {
    try {
      setLoginPending(true)

      // 1. Create a pending session on the server
      const res = await api.post('/auth/sessions')
      const sessionId = res.data.session_id

      // 2. Open Telegram bot with deep-link
      window.open(`https://t.me/${BOT_USERNAME}?start=${sessionId}`, '_blank')

      // 3. Start polling for completion
      pollRef.current = setInterval(async () => {
        try {
          const poll = await api.get(`/auth/sessions/${sessionId}`)
          if (poll.data.status === 'completed') {
            stopPolling()
            localStorage.setItem('token', poll.data.token)
            setUser(poll.data.user)
          } else if (poll.data.status === 'expired') {
            stopPolling()
          }
        } catch {
          // Session not found or network error — stop
          stopPolling()
        }
      }, POLL_INTERVAL)

      // 4. Auto-stop after timeout
      timeoutRef.current = setTimeout(() => {
        stopPolling()
      }, POLL_TIMEOUT)
    } catch (err) {
      console.error('Login session error:', err)
      setLoginPending(false)
    }
  }, [stopPolling])

  function logout() {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, setUser, loading, logout, loginPending, startLoginSession, stopPolling }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() { return useContext(AuthContext) }
