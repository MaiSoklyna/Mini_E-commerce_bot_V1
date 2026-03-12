import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import * as orderService from '../services/orderService';
import * as reviewService from '../services/reviewService';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import BottomSheet from '../components/BottomSheet';

const TIMELINE_STEPS = [
  { key: 'pending', label: 'Ordered', message: 'Your order has been placed' },
  { key: 'confirmed', label: 'Confirmed', message: 'Merchant confirmed your order' },
  { key: 'processing', label: 'Packaged', message: 'Order is being prepared' },
  { key: 'shipped', label: 'Shipped', message: 'Order is on the way' },
  { key: 'delivered', label: 'Delivered', message: 'Order delivered successfully' },
];

export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const placed = searchParams.get('placed') === 'true';

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [showSuccessBanner, setShowSuccessBanner] = useState(placed);
  const [showItemsCollapse, setShowItemsCollapse] = useState(false);
  const [showReviewSheet, setShowReviewSheet] = useState(false);
  const [reviewData, setReviewData] = useState({ rating: 5, comment: '' });
  const [submittingReview, setSubmittingReview] = useState(false);
  const [timelineVisible, setTimelineVisible] = useState([]);

  useEffect(() => {
    orderService.getOrder(id)
      .then(data => { setOrder(data); setLoading(false); })
      .catch(() => navigate(-1));
  }, [id, navigate]);

  useEffect(() => {
    if (showSuccessBanner) {
      const timer = setTimeout(() => setShowSuccessBanner(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [showSuccessBanner]);

  useEffect(() => {
    if (order && !loading) {
      TIMELINE_STEPS.forEach((_, index) => {
        setTimeout(() => setTimelineVisible(prev => [...prev, index]), index * 100);
      });
    }
  }, [order, loading]);

  const handleCancelOrder = async () => {
    if (!confirm('Are you sure you want to cancel this order?')) return;
    setCancelling(true);
    try {
      const token = localStorage.getItem('token');
      await orderService.cancelOrder(token, id);
      setOrder(prev => ({ ...prev, status: 'cancelled' }));
    } catch (err) {
      alert(err.response?.data?.detail || 'Cannot cancel order');
    } finally {
      setCancelling(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!reviewData.rating) { alert('Please select a rating'); return; }
    setSubmittingReview(true);
    try {
      if (order.items?.length > 0) {
        const token = localStorage.getItem('token');
        await reviewService.createReview(token, {
          product_id: order.items[0].product_id,
          order_id: order.id,
          rating: reviewData.rating,
          comment: reviewData.comment,
        });
        setShowReviewSheet(false);
        alert('Review submitted! Thank you for your feedback.');
      }
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to submit review');
    } finally {
      setSubmittingReview(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  const getCurrentStepIndex = () => {
    if (!order) return -1;
    return TIMELINE_STEPS.findIndex(step => step.key === order.status);
  };

  if (loading) {
    return (
      <div className="page-container">
        <PageHeader title="Order Details" />
        <div className="px-4 pt-4 space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="skeleton h-24 rounded-card" />)}
        </div>
      </div>
    );
  }

  if (!order) return null;

  const currentStepIndex = getCurrentStepIndex();
  const isCancelled = order.status === 'cancelled';

  return (
    <div className="page-container animate-fadeIn pb-20">
      <PageHeader title={`Order #${order.order_code || order.id}`} />

      {/* Success Banner */}
      {showSuccessBanner && (
        <div className="mx-4 mt-4 bg-green-50 border border-green-200 rounded-card p-4 animate-slideUp">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div>
              <p className="text-green-700 font-semibold text-sm">Order placed successfully!</p>
              <p className="text-green-600 text-xs mt-0.5">We'll notify you when confirmed</p>
            </div>
          </div>
        </div>
      )}

      <div className="px-4 pt-4">
        {/* Status */}
        <div className="bg-card rounded-card border border-border-light p-4 mb-4 shadow-card">
          <div className="flex items-center justify-between">
            <StatusBadge status={order.status} />
            <span className="text-text-tertiary text-[11px]">{formatDate(order.created_at)}</span>
          </div>
        </div>

        {/* Timeline */}
        {!isCancelled && (
          <div className="bg-card rounded-card border border-border-light p-4 mb-4 shadow-card">
            <h3 className="text-sm font-heading font-semibold text-primary mb-4">Order Progress</h3>
            <div className="space-y-0">
              {TIMELINE_STEPS.map((step, index) => {
                const isCompleted = index <= currentStepIndex;
                const isCurrent = index === currentStepIndex;
                const isVisible = timelineVisible.includes(index);

                return (
                  <div key={step.key} className={`flex gap-3 transition-all duration-300 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
                    <div className="flex flex-col items-center">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                        isCompleted ? 'bg-green-500 text-white'
                          : isCurrent ? 'bg-card ring-2 ring-accent ring-offset-2' : 'bg-surface-2 text-text-tertiary'
                      }`}>
                        {isCompleted ? (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        ) : index + 1}
                      </div>
                      {index < TIMELINE_STEPS.length - 1 && (
                        <div className={`w-0.5 h-10 ${isCompleted ? 'bg-green-500' : 'bg-surface-2'}`} />
                      )}
                    </div>
                    <div className="flex-1 pb-3">
                      <h4 className="font-semibold text-[13px] text-primary">{step.label}</h4>
                      {isCompleted && order[`${step.key}_at`] && (
                        <p className="text-text-tertiary text-[11px] mt-0.5">{formatDate(order[`${step.key}_at`])}</p>
                      )}
                      <p className="text-text-secondary text-[11px] mt-0.5">{step.message}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Cancelled */}
        {isCancelled && (
          <div className="bg-red-50 border border-red-200 rounded-card p-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </div>
              <div>
                <p className="text-red-700 font-semibold text-sm">Order Cancelled</p>
                <p className="text-red-600 text-xs mt-0.5">Cancelled on {formatDate(order.updated_at)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Items */}
        <div className="bg-card rounded-card border border-border-light p-4 mb-4 shadow-card">
          <button onClick={() => setShowItemsCollapse(!showItemsCollapse)} className="flex items-center justify-between w-full mb-3">
            <h3 className="text-sm font-heading font-semibold text-primary">Items ({order.items?.length || 0})</h3>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className={`transition-transform ${showItemsCollapse ? 'rotate-180' : ''}`}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {(showItemsCollapse || (order.items?.length || 0) <= 3) && (
            <div className="space-y-2">
              {order.items?.map((item, i) => (
                <div key={i} className="flex gap-3 pb-2 border-b border-border-light/50 last:border-0">
                  <div className="w-12 h-12 rounded-xl bg-surface flex-shrink-0 overflow-hidden">
                    {item.primary_image ? (
                      <img src={item.primary_image} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-lg text-accent/40 font-heading font-bold">{item.product_name?.[0]}</div>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-[13px] font-semibold text-primary line-clamp-1">{item.product_name}</p>
                    <p className="text-[11px] text-text-tertiary mt-0.5">${parseFloat(item.unit_price).toFixed(2)} x {item.quantity}</p>
                  </div>
                  <p className="text-sm font-bold text-accent">${parseFloat(item.subtotal || item.unit_price * item.quantity).toFixed(2)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Price */}
        <div className="bg-card border border-border-light rounded-card p-4 mb-4">
          <div className="flex justify-between text-sm mb-2.5">
            <span className="text-text-secondary">Subtotal</span>
            <span className="text-primary font-semibold">${parseFloat(order.subtotal || order.total).toFixed(2)}</span>
          </div>
          {order.discount_amount > 0 && (
            <div className="flex justify-between text-sm mb-2.5">
              <span className="text-text-secondary">Discount</span>
              <span className="text-green-600 font-semibold">-${parseFloat(order.discount_amount).toFixed(2)}</span>
            </div>
          )}
          <div className="border-t border-border-light my-2.5" />
          <div className="flex justify-between items-baseline">
            <span className="font-bold text-base text-primary">Total</span>
            <span className="font-bold text-lg text-accent">${parseFloat(order.total).toFixed(2)}</span>
          </div>
        </div>

        {/* Address */}
        <div className="bg-card rounded-card border border-border-light p-4 mb-4 shadow-card">
          <h3 className="text-sm font-heading font-semibold text-primary mb-2 flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
            </svg>
            Delivery Address
          </h3>
          <p className="text-sm text-primary font-medium">{order.delivery_name || 'Customer'} | {order.delivery_phone || 'N/A'}</p>
          <p className="text-sm text-text-secondary mt-1">{order.delivery_address}</p>
          {order.delivery_province && <p className="text-sm text-text-secondary">{order.delivery_province}</p>}
        </div>

        {/* Actions */}
        <div className="space-y-3">
          {order.status === 'pending' && (
            <button onClick={handleCancelOrder} disabled={cancelling}
              className="w-full border-2 border-danger text-danger rounded-button py-3 font-semibold hover:bg-red-50 disabled:opacity-40 transition-colors">
              {cancelling ? 'Cancelling...' : 'Cancel Order'}
            </button>
          )}
          {order.status === 'delivered' && (
            <button onClick={() => setShowReviewSheet(true)}
              className="w-full bg-accent text-black rounded-button py-3 font-semibold active:scale-[0.97] transition-all">
              Write Review
            </button>
          )}
          <button onClick={() => navigate('/support')}
            className="w-full border border-accent text-accent rounded-button py-3 font-semibold hover:bg-accent/5 transition-colors">
            Need Help?
          </button>
        </div>
      </div>

      {/* Review Sheet */}
      <BottomSheet isOpen={showReviewSheet} onClose={() => setShowReviewSheet(false)} title="Write a Review">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-primary mb-2">Rating</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map(star => (
                <button key={star} onClick={() => setReviewData({ ...reviewData, rating: star })}
                  className={`text-2xl transition-transform hover:scale-110 ${star <= reviewData.rating ? 'grayscale-0' : 'grayscale opacity-30'}`}>
                  &#9733;
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-primary mb-2">Comment (optional)</label>
            <textarea value={reviewData.comment} onChange={(e) => setReviewData({ ...reviewData, comment: e.target.value })}
              className="input-field" rows={4} placeholder="Share your experience..." />
          </div>
          <button onClick={handleSubmitReview} disabled={submittingReview}
            className="w-full bg-accent text-black rounded-button py-3 font-semibold disabled:opacity-40 active:scale-[0.97] transition-all">
            {submittingReview ? 'Submitting...' : 'Submit Review'}
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
