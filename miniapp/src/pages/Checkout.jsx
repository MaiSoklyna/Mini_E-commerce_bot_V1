import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as orderService from '../services/orderService';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';

const PROVINCES = ['Phnom Penh', 'Siem Reap', 'Battambang', 'Kampot', 'Kampong Cham', 'Other'];

export default function Checkout() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { items, total, fetchCart } = useCart();

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({ name: '', phone: '', province: '', address: '', note: '' });
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [errors, setErrors] = useState({});
  const [placing, setPlacing] = useState(false);
  const [orderError, setOrderError] = useState('');
  const [khqrTimer, setKhqrTimer] = useState(900);
  const [showAllItems, setShowAllItems] = useState(false);
  const [khqrData, setKhqrData] = useState(null);
  const [loadingKhqr, setLoadingKhqr] = useState(false);
  const [orderId, setOrderId] = useState(null);

  useEffect(() => {
    if (user) {
      const fullName = user.first_name
        ? `${user.first_name}${user.last_name ? ' ' + user.last_name : ''}`
        : user.username || '';
      setFormData(prev => ({
        ...prev,
        name: fullName,
        phone: user.phone || '',
        address: user.address || '',
      }));
    }
  }, [user]);

  useEffect(() => {
    if (step === 2 && paymentMethod === 'khqr' && khqrTimer > 0) {
      const interval = setInterval(() => setKhqrTimer(prev => prev - 1), 1000);
      return () => clearInterval(interval);
    }
  }, [step, paymentMethod, khqrTimer]);

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const validateStep1 = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.phone.trim() || formData.phone.length < 9) newErrors.phone = 'Valid phone number required (min 9 digits)';
    if (!formData.address.trim()) newErrors.address = 'Address is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handlePlaceOrder = async () => {
    setPlacing(true);
    setOrderError('');
    try {
      const byMerchant = {};
      items.forEach(item => {
        const mid = item.merchant_id;
        if (!byMerchant[mid]) byMerchant[mid] = [];
        byMerchant[mid].push(item);
      });

      const token = localStorage.getItem('token');
      const orderPromises = Object.keys(byMerchant).map(merchantId =>
        orderService.placeOrder(token, {
          merchant_id: parseInt(merchantId),
          delivery_address: formData.address,
          delivery_province: formData.province,
          delivery_phone: '+855' + formData.phone,
          delivery_name: formData.name,
          note: formData.note,
          payment_method: paymentMethod,
        })
      );

      const results = await Promise.all(orderPromises);
      await fetchCart();
      const firstOrderId = results[0]?.data?.order_id;

      if (paymentMethod === 'khqr' && firstOrderId) {
        setOrderId(firstOrderId);
        await fetchKhqrCode(firstOrderId);
        setStep(4);
      } else {
        navigate(firstOrderId ? `/order/${firstOrderId}?placed=true` : '/orders', { replace: true });
      }
    } catch (err) {
      setOrderError(err.response?.data?.detail || 'Order failed. Please try again.');
    } finally {
      setPlacing(false);
    }
  };

  const fetchKhqrCode = async (oid) => {
    setLoadingKhqr(true);
    try {
      const token = localStorage.getItem('token');
      const res = await orderService.getKhqr(token, oid);
      setKhqrData(res.data);
      setKhqrTimer(res.data.expires_in || 900);
    } catch {
      setOrderError('Failed to generate KHQR code. Please contact support.');
    } finally {
      setLoadingKhqr(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (!orderId) return;
    try {
      const token = localStorage.getItem('token');
      await orderService.confirmPayment(token, orderId);
      navigate(`/order/${orderId}?placed=true`, { replace: true });
    } catch {
      alert('Payment confirmation failed. Please contact support if you have already paid.');
    }
  };

  if (!user || (items.length === 0 && step < 4)) {
    return (
      <div className="page-container">
        <PageHeader title="Checkout" />
        <EmptyState
          icon="🛒"
          title="Your cart is empty"
          actionLabel="Start Shopping"
          onAction={() => navigate('/')}
          className="pt-20"
        />
      </div>
    );
  }

  const deliveryFee = total > 50 ? 0 : 5;
  const finalTotal = total + deliveryFee;
  const displayItems = showAllItems || items.length <= 3 ? items : items.slice(0, 3);

  const stepsList = step === 4
    ? [{ num: 1, label: 'Address' }, { num: 2, label: 'Payment' }, { num: 4, label: 'Pay' }]
    : [{ num: 1, label: 'Address' }, { num: 2, label: 'Payment' }, { num: 3, label: 'Confirm' }];

  return (
    <div className="page-container animate-fadeIn pb-32">
      <PageHeader title="Checkout" />

      {/* Progress */}
      <div className="sticky top-14 z-20 bg-card/95 backdrop-blur-md border-b border-border-light/50 px-4 py-4">
        <div className="flex items-center justify-between max-w-md mx-auto">
          {stepsList.map((s, idx) => (
            <div key={s.num} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  step > s.num ? 'bg-green-500 text-white' : step === s.num ? 'bg-accent text-black' : 'bg-surface-2 text-text-tertiary'
                }`}>
                  {step > s.num ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : s.num}
                </div>
                <span className="text-[10px] mt-1 font-medium text-text-secondary">{s.label}</span>
              </div>
              {idx < 2 && (
                <div className={`flex-1 h-0.5 mx-2 mb-5 rounded-full ${step > s.num ? 'bg-green-500' : 'bg-surface-2'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 pt-5">
        {/* STEP 1 */}
        {step === 1 && (
          <div className="animate-fadeIn">
            <h2 className="text-lg font-heading font-bold text-primary mb-4">Delivery Address</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-primary mb-1">Full Name <span className="text-danger">*</span></label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={`input-field ${errors.name ? 'border-danger' : ''}`} placeholder="Enter your full name" />
                {errors.name && <p className="text-danger text-xs mt-1">{errors.name}</p>}
              </div>
              <div>
                <label className="block text-sm font-semibold text-primary mb-1">Phone <span className="text-danger">*</span></label>
                <div className="flex gap-2">
                  <div className="bg-surface border border-border-light rounded-button px-3 py-2.5 text-sm text-text-secondary font-semibold">+855</div>
                  <input type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '') })}
                    className={`flex-1 input-field ${errors.phone ? 'border-danger' : ''}`} placeholder="12 345 6789" />
                </div>
                {errors.phone && <p className="text-danger text-xs mt-1">{errors.phone}</p>}
              </div>
              <div>
                <label className="block text-sm font-semibold text-primary mb-1">Province</label>
                <select value={formData.province} onChange={(e) => setFormData({ ...formData, province: e.target.value })} className="input-field">
                  <option value="">Select province</option>
                  {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-primary mb-1">Full Address <span className="text-danger">*</span></label>
                <textarea value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className={`input-field ${errors.address ? 'border-danger' : ''}`} rows={3} placeholder="Street, building, apartment..." />
                {errors.address && <p className="text-danger text-xs mt-1">{errors.address}</p>}
              </div>
              <div>
                <label className="block text-sm font-semibold text-primary mb-1">Note (optional)</label>
                <textarea value={formData.note} onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  className="input-field" rows={2} placeholder="e.g. Call before arrival" />
              </div>
            </div>
            <button onClick={() => { if (validateStep1()) setStep(2); }}
              className="w-full bg-accent text-black rounded-button py-3.5 font-semibold mt-6 active:scale-[0.97] transition-all">
              Continue
            </button>
          </div>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <div className="animate-fadeIn">
            <h2 className="text-lg font-heading font-bold text-primary mb-4">Payment Method</h2>
            <div className="space-y-3">
              {[
                { key: 'cod', label: 'Cash on Delivery', desc: 'Pay when you receive your order', iconPath: 'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6' },
                { key: 'khqr', label: 'KHQR Payment', desc: 'ABA, ACLEDA, Wing, Pi Pay', iconPath: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' },
              ].map(method => (
                <button key={method.key} onClick={() => setPaymentMethod(method.key)}
                  className={`w-full border-2 rounded-card p-4 text-left transition-all ${
                    paymentMethod === method.key ? 'border-accent bg-accent/5' : 'border-border-light bg-card'
                  }`}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-surface flex items-center justify-center flex-shrink-0">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d={method.iconPath} />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-sm text-primary">{method.label}</h3>
                      <p className="text-xs text-text-secondary mt-0.5">{method.desc}</p>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      paymentMethod === method.key ? 'border-accent' : 'border-border-light'
                    }`}>
                      {paymentMethod === method.key && <div className="w-2.5 h-2.5 rounded-full bg-accent" />}
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setStep(1)} className="flex-1 border border-border-light text-primary rounded-button py-3 font-semibold hover:bg-surface transition-colors">
                Back
              </button>
              <button onClick={() => setStep(3)} disabled={!paymentMethod}
                className="flex-1 bg-accent text-black rounded-button py-3 font-semibold disabled:opacity-40 active:scale-[0.97] transition-all">
                Continue
              </button>
            </div>
          </div>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <div className="animate-fadeIn">
            <h2 className="text-lg font-heading font-bold text-primary mb-4">Review & Confirm</h2>

            <div className="bg-card border border-border-light rounded-card p-4 mb-3 shadow-card">
              <h3 className="text-sm font-heading font-semibold text-primary mb-3">Order Items</h3>
              {displayItems.map(item => (
                <div key={item.id} className="flex gap-3 mb-2 pb-2 border-b border-border-light/50 last:border-0">
                  <div className="w-12 h-12 rounded-xl bg-surface flex-shrink-0 overflow-hidden">
                    {item.primary_image ? (
                      <img src={item.primary_image} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-lg text-accent/40 font-heading font-bold">{item.product_name?.[0]}</div>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-[13px] font-semibold text-primary line-clamp-1">{item.product_name}</p>
                    <p className="text-[11px] text-text-tertiary">x{item.quantity}</p>
                  </div>
                  <p className="text-sm font-bold text-accent">${parseFloat(item.line_total || item.unit_price * item.quantity).toFixed(2)}</p>
                </div>
              ))}
              {items.length > 3 && !showAllItems && (
                <button onClick={() => setShowAllItems(true)} className="text-accent text-xs font-semibold mt-2">
                  See all {items.length} items
                </button>
              )}
            </div>

            <div className="bg-card border border-border-light rounded-card p-4 mb-3 shadow-card">
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-sm font-heading font-semibold text-primary">Delivery Address</h3>
                <button onClick={() => setStep(1)} className="text-accent text-xs font-semibold">Change</button>
              </div>
              <p className="text-sm text-primary font-medium">{formData.name} | +855{formData.phone}</p>
              <p className="text-sm text-text-secondary mt-1">{formData.address}</p>
              {formData.province && <p className="text-sm text-text-secondary">{formData.province}</p>}
            </div>

            <div className="bg-card border border-border-light rounded-card p-4 mb-3 shadow-card">
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-sm font-heading font-semibold text-primary">Payment</h3>
                <button onClick={() => setStep(2)} className="text-accent text-xs font-semibold">Change</button>
              </div>
              <p className="text-sm text-primary font-medium">
                {paymentMethod === 'cod' ? 'Cash on Delivery' : 'KHQR Payment'}
              </p>
            </div>

            <div className="bg-card border border-border-light rounded-card p-4 mb-4">
              <div className="flex justify-between text-sm mb-2.5">
                <span className="text-text-secondary">Subtotal</span>
                <span className="text-primary font-semibold">${total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm mb-2.5">
                <span className="text-text-secondary">Delivery</span>
                <span className={deliveryFee === 0 ? 'text-green-600 font-semibold' : 'text-primary font-semibold'}>
                  {deliveryFee === 0 ? 'FREE' : `$${deliveryFee.toFixed(2)}`}
                </span>
              </div>
              <div className="border-t border-border-light my-2.5" />
              <div className="flex justify-between items-baseline">
                <span className="font-bold text-base text-primary">Total</span>
                <span className="font-bold text-lg text-accent">${finalTotal.toFixed(2)}</span>
              </div>
            </div>

            {orderError && (
              <div className="bg-red-50 border border-red-200 rounded-card p-3 mb-4">
                <p className="text-danger text-sm font-medium">{orderError}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="flex-1 border border-border-light text-primary rounded-button py-3 font-semibold hover:bg-surface transition-colors">
                Back
              </button>
              <button onClick={handlePlaceOrder} disabled={placing}
                className="flex-1 bg-accent text-black rounded-button py-3 font-semibold disabled:opacity-40 active:scale-[0.97] transition-all flex items-center justify-center gap-2">
                {placing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    Placing...
                  </>
                ) : 'Place Order'}
              </button>
            </div>
          </div>
        )}

        {/* STEP 4 - KHQR */}
        {step === 4 && (
          <div className="animate-fadeIn">
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-3">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M7 7h.01M7 12h.01M12 7h.01M17 7h.01M12 12h.01M17 12h.01M7 17h.01M12 17h.01M17 17h.01" />
                </svg>
              </div>
              <h2 className="text-lg font-heading font-bold text-primary mb-1">Complete Payment</h2>
              <p className="text-sm text-text-secondary">Scan QR code with any KHQR-supported app</p>
            </div>

            {loadingKhqr ? (
              <div className="bg-card border border-border-light rounded-card p-8 text-center">
                <div className="w-10 h-10 border-3 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-sm text-text-secondary">Generating payment QR code...</p>
              </div>
            ) : khqrData ? (
              <>
                <div className="bg-card border border-accent/30 rounded-card p-6 mb-4 shadow-card">
                  <div className="flex items-center justify-center mb-4">
                    <img src={khqrData.qr_code} alt="KHQR Payment QR Code" className="w-56 h-56 rounded-lg" />
                  </div>
                  <div className="text-center mb-4">
                    <p className="text-[11px] text-text-tertiary mb-1">Amount to Pay</p>
                    <p className="text-3xl font-bold text-accent">${khqrData.amount.toFixed(2)}</p>
                  </div>
                  <div className="flex items-center justify-center gap-2 text-amber-600 text-sm mb-4">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                    </svg>
                    <span className="font-semibold">Expires in {formatTimer(khqrTimer)}</span>
                  </div>
                  <div className="border-t border-border-light pt-3">
                    <p className="text-[11px] text-text-tertiary text-center mb-2">Supported by</p>
                    <div className="flex gap-2 justify-center flex-wrap">
                      {['ABA', 'ACLEDA', 'Wing', 'Pi Pay', 'Canadia', 'True Money'].map(bank => (
                        <span key={bank} className="bg-surface text-text-secondary text-[10px] px-2.5 py-1 rounded-full font-medium">{bank}</span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-card p-4 mb-4">
                  <h3 className="text-sm font-semibold text-primary mb-2">How to Pay</h3>
                  <ol className="space-y-1.5 text-[13px] text-text-secondary">
                    {['Open your banking app', 'Scan this QR code', 'Verify amount & merchant', 'Complete payment', 'Tap "I\'ve Paid" below'].map((s, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="font-semibold text-accent">{i + 1}.</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ol>
                </div>

                {khqrData.deeplink && (
                  <a href={khqrData.deeplink}
                    className="block w-full bg-accent text-black rounded-button py-3 font-semibold text-center mb-3 active:scale-[0.97] transition-all">
                    Open in Bakong App
                  </a>
                )}

                <div className="space-y-3">
                  <button onClick={handleConfirmPayment}
                    className="w-full bg-accent text-black rounded-button py-3 font-semibold active:scale-[0.97] transition-all">
                    I've Paid
                  </button>
                  <button onClick={() => navigate('/orders')}
                    className="w-full border border-border-light text-text-secondary rounded-button py-2.5 text-sm font-medium hover:bg-surface transition-colors">
                    I'll Pay Later
                  </button>
                </div>

                <div className="bg-accent/5 border border-accent/15 rounded-card p-3 mt-4">
                  <p className="text-xs text-text-secondary">
                    <span className="font-semibold">Note:</span> Your order is reserved for 15 minutes.
                  </p>
                </div>
              </>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-card p-4 text-center">
                <p className="text-danger text-sm font-medium">Failed to generate payment QR code</p>
                <button onClick={() => navigate('/orders')} className="mt-3 text-accent text-sm font-semibold">Go to Orders</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
