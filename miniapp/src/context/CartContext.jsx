import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import * as cartService from '../services/cartService'
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
      const cart = await cartService.getCart()
      setItems(cart.items || [])
      setCount(cart.item_count || 0)
      setTotal(parseFloat(cart.subtotal) || 0)
    } catch (err) { console.error('Cart fetch error:', err) }
    finally { setLoading(false) }
  }, [user])

  useEffect(() => { if (user) fetchCart() }, [user, fetchCart])

  async function addToCart(productId, quantity = 1) {
    try {
      const token = localStorage.getItem('token')
      await cartService.addToCart(token, { product_id: productId, quantity })
      await fetchCart()
      return true
    }
    catch { return false }
  }
  async function updateQuantity(cartItemId, quantity) {
    try {
      if (quantity <= 0) { await cartService.removeCartItem(cartItemId) }
      else { await cartService.updateCartItem(cartItemId, quantity) }
      await fetchCart()
    } catch {}
  }
  async function removeItem(cartItemId) {
    try { await cartService.removeCartItem(cartItemId); await fetchCart() } catch {}
  }
  async function clearCart() {
    try { await cartService.clearCart(); setItems([]); setCount(0); setTotal(0) } catch {}
  }

  return (
    <CartContext.Provider value={{ items, count, total, loading, fetchCart, addToCart, updateQuantity, removeItem, clearCart }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() { return useContext(CartContext) }
