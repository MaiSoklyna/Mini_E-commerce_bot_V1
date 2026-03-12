import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import * as cartService from '../services/cartService';

export default function Cart() {
  const navigate = useNavigate();
  const { user, loginPending, startLoginSession } = useAuth();
  const { items, total, loading, updateQuantity, removeItem, clearCart, fetchCart } = useCart();

  const [promoCode, setPromoCode] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState('');
  const [promoSuccess, setPromoSuccess] = useState(false);
  const [discount, setDiscount] = useState(0);
  const [shakePromo, setShakePromo] = useState(false);
  const [swipedItemId, setSwipedItemId] = useState(null);
  const [touchStart, setTouchStart] = useState(0);

  useEffect(() => {
    if (user) fetchCart();
  }, [user, fetchCart]);

  const handleApplyPromo = async () => {
    if (!promoCode.trim()) return;
    setPromoLoading(true);
    setPromoError('');

    const merchantIds = [...new Set(items.map(i => i.merchant_id).filter(Boolean))];
    if (merchantIds.length === 0) {
      setPromoError('Cannot validate promo code');
      setPromoLoading(false);
      return;
    }

    const errorMessages = {
      'PROMO_NOT_FOUND': 'Invalid promo code',
      'PROMO_EXPIRED': 'This promo code has expired',
      'PROMO_EXHAUSTED': 'This promo code has been fully used',
      'PROMO_MIN_ORDER': 'Minimum order amount not met',
    };

    const token = localStorage.getItem('token');
    let lastError = 'Invalid promo code';
    for (const merchantId of merchantIds) {
      const merchantTotal = items
        .filter(i => i.merchant_id === merchantId)
        .reduce((sum, i) => sum + parseFloat(i.line_total || i.unit_price * i.quantity), 0);
      try {
        const res = await cartService.validatePromo(token, {
          code: promoCode, merchant_id: merchantId, cart_total: merchantTotal,
        });
        const discountAmount = parseFloat(res.data?.discount_amount || 0);
        setDiscount(discountAmount);
        setPromoSuccess(true);
        setPromoError('');
        setPromoLoading(false);
        return;
      } catch (err) {
        const detail = err.response?.data?.detail || '';
        if (detail !== 'PROMO_NOT_FOUND') {
          lastError = errorMessages[detail] || detail || 'Invalid or expired code';
          break;
        }
        lastError = errorMessages[detail] || 'Invalid promo code';
      }
    }

    setPromoError(lastError);
    setPromoSuccess(false);
    setDiscount(0);
    setShakePromo(true);
    setTimeout(() => setShakePromo(false), 500);
    setPromoLoading(false);
  };

  const handleTouchStart = (e) => setTouchStart(e.targetTouches[0].clientX);
  const handleTouchMove = (e, itemId) => {
    const diff = touchStart - e.targetTouches[0].clientX;
    if (diff > 80) setSwipedItemId(itemId);
    else if (diff < 0) setSwipedItemId(null);
  };
  const handleTouchEnd = () => setTouchStart(0);
  const handleDeleteSwiped = async (itemId) => {
    await removeItem(itemId);
    setSwipedItemId(null);
  };

  if (!user) {
    return (
      <div className="page-container">
        <PageHeader title="My Cart" showBack={false} />
        <EmptyState
          icon="🔒"
          title="Login Required"
          description="Please login via Telegram to view your cart"
          actionLabel={loginPending ? 'Waiting for Telegram...' : 'Login via Telegram'}
          onAction={startLoginSession}
          className="pt-20"
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page-container">
        <PageHeader title="My Cart" showBack={false} />
        <div className="px-4 pt-4">
          {[1, 2, 3].map(i => <div key={i} className="skeleton h-24 rounded-card mb-3" />)}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="page-container">
        <PageHeader title="My Cart" showBack={false} />
        <EmptyState
          icon="🛒"
          title="Your cart is empty"
          description="Discover amazing products from local shops"
          actionLabel="Start Shopping"
          onAction={() => navigate('/')}
          className="pt-20"
        />
      </div>
    );
  }

  const subtotal = total;
  const deliveryFee = subtotal > 50 ? 0 : 5;
  const finalTotal = subtotal + deliveryFee - discount;

  return (
    <div className="page-container animate-fadeIn">
      <PageHeader title="My Cart" showBack={false} />

      <div className="px-4 pb-48">
        {/* Items */}
        <div className="pt-4 space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="relative overflow-hidden rounded-card"
              onTouchStart={handleTouchStart}
              onTouchMove={(e) => handleTouchMove(e, item.id)}
              onTouchEnd={handleTouchEnd}
            >
              {swipedItemId === item.id && (
                <button
                  onClick={() => handleDeleteSwiped(item.id)}
                  className="absolute right-0 top-0 bottom-0 w-20 bg-danger text-white flex items-center justify-center font-semibold text-sm z-10 rounded-r-card"
                >
                  Delete
                </button>
              )}

              <div className={`bg-card border border-border-light rounded-card p-3 transition-transform duration-200 ${
                swipedItemId === item.id ? '-translate-x-20' : ''
              }`}>
                <div className="flex gap-3">
                  <div className="w-16 h-16 rounded-xl bg-surface flex-shrink-0 overflow-hidden border border-border-light">
                    {item.primary_image ? (
                      <img src={item.primary_image} alt={item.product_name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xl text-accent/40 font-heading font-bold">
                        {item.product_name?.[0]?.toUpperCase() || '?'}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-[13px] text-primary line-clamp-1">{item.product_name}</h3>
                    {item.variant_name && (
                      <p className="text-[11px] text-text-tertiary mt-0.5">{item.variant_name}</p>
                    )}

                    <div className="flex items-center justify-between mt-2.5">
                      <div className="flex items-center rounded-full border border-border-light overflow-hidden">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="w-8 h-8 flex items-center justify-center text-sm font-semibold text-text-secondary active:bg-surface transition-colors"
                        >
                          &minus;
                        </button>
                        <span className="text-sm font-bold min-w-[28px] text-center text-primary">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="w-8 h-8 flex items-center justify-center text-sm font-semibold text-accent active:bg-accent/10 transition-colors"
                        >
                          +
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-accent font-bold text-sm">
                          ${parseFloat(item.line_total || item.unit_price * item.quantity).toFixed(2)}
                        </span>
                        <button
                          onClick={() => removeItem(item.id)}
                          className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-danger/10 transition-colors"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Promo Code */}
        <div className="mt-6">
          <p className="text-sm font-semibold text-primary mb-2">Promo Code</p>
          <div className={`flex gap-2 ${shakePromo ? 'animate-shake' : ''}`}>
            <input
              type="text"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value)}
              placeholder="Enter code"
              className="flex-1 input-field"
              disabled={promoSuccess}
            />
            <button
              onClick={handleApplyPromo}
              disabled={promoLoading || promoSuccess || !promoCode.trim()}
              className="bg-accent text-black rounded-button px-5 py-2.5 text-sm font-semibold disabled:opacity-40 active:scale-[0.97] transition-all"
            >
              {promoLoading ? '...' : promoSuccess ? '&#10003;' : 'Apply'}
            </button>
          </div>
          {promoError && <p className="text-danger text-xs mt-1.5">{promoError}</p>}
          {promoSuccess && (
            <p className="text-green-600 text-xs mt-1.5 flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Promo code applied!
            </p>
          )}
        </div>

        {/* Price Summary */}
        <div className="bg-card border border-border-light rounded-card p-4 mt-4">
          <div className="flex justify-between text-sm mb-2.5">
            <span className="text-text-secondary">Subtotal</span>
            <span className="text-primary font-semibold">${subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm mb-2.5">
            <span className="text-text-secondary">Delivery</span>
            <span className={deliveryFee === 0 ? 'text-green-600 font-semibold' : 'text-primary font-semibold'}>
              {deliveryFee === 0 ? 'FREE' : `$${deliveryFee.toFixed(2)}`}
            </span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-sm mb-2.5">
              <span className="text-text-secondary">Discount</span>
              <span className="text-green-600 font-semibold">-${discount.toFixed(2)}</span>
            </div>
          )}
          <div className="border-t border-border-light my-2.5" />
          <div className="flex justify-between items-baseline">
            <span className="font-bold text-base text-primary">Total</span>
            <span className="font-bold text-lg text-accent">${finalTotal.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Fixed Checkout Bar */}
      <div className="fixed bottom-[60px] left-0 right-0 z-40">
        <div className="h-5 bg-gradient-to-t from-surface to-transparent pointer-events-none" />
        <div className="bg-card/95 backdrop-blur-md border-t border-border-light/50 px-4 py-3">
          <button
            onClick={() => navigate('/checkout')}
            disabled={items.length === 0}
            className="w-full bg-accent text-black rounded-button py-3.5 font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-40 active:scale-[0.97] transition-all shadow-card"
          >
            Checkout &middot; ${finalTotal.toFixed(2)}
          </button>
        </div>
      </div>
    </div>
  );
}
