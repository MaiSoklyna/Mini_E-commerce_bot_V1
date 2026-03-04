import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '../api/axios'
import { useAuth } from './AuthContext'

const CartContext = createContext(null)

export function CartProvider({ children }) {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [count, setCount] = useState(0)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  const fetchCart = useCallback(async () => {
    if (!user) return
    try {
      setLoading(true)
      const res = await api.get('/cart')
      const cart = res.data.data || {}
      setItems(cart.items || [])
      setCount(cart.item_count || 0)
      setTotal(parseFloat(cart.subtotal) || 0)
    } catch (err) { console.error('Cart fetch error:', err) }
    finally { setLoading(false) }
  }, [user])

  useEffect(() => { if (user) fetchCart() }, [user, fetchCart])

  async function addToCart(productId, quantity = 1) {
    try { await api.post('/cart/items', { product_id: productId, quantity }); await fetchCart(); return true }
    catch { return false }
  }
  async function updateQuantity(cartId, quantity) {
    try {
      if (quantity <= 0) { await api.delete(`/cart/items/${cartId}`) }
      else { await api.patch(`/cart/items/${cartId}`, { quantity }) }
      await fetchCart()
    } catch {}
  }
  async function removeItem(cartId) {
    try { await api.delete(`/cart/items/${cartId}`); await fetchCart() } catch {}
  }
  async function clearCart() {
    try { await api.delete('/cart'); setItems([]); setCount(0); setTotal(0) } catch {}
  }

  return (
    <CartContext.Provider value={{ items, count, total, loading, fetchCart, addToCart, updateQuantity, removeItem, clearCart }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() { return useContext(CartContext) }
