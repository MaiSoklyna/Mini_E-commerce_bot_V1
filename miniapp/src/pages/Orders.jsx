import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

export default function Orders() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loginPending, startLoginSession } = useAuth();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [success, setSuccess] = useState(location.state?.success || '');

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    api.get('/orders/')
      .then(res => setOrders(res.data.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(''), 4000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const getFilteredOrders = () => {
    if (activeTab === 'all') return orders;
    if (activeTab === 'active') return orders.filter(o => ['pending', 'confirmed', 'shipped'].includes(o.status));
    if (activeTab === 'completed') return orders.filter(o => o.status === 'delivered');
    if (activeTab === 'cancelled') return orders.filter(o => o.status === 'cancelled');
    return orders;
  };

  const getTabCount = (tabKey) => {
    if (tabKey === 'all') return orders.length;
    if (tabKey === 'active') return orders.filter(o => ['pending', 'confirmed', 'shipped'].includes(o.status)).length;
    if (tabKey === 'completed') return orders.filter(o => o.status === 'delivered').length;
    if (tabKey === 'cancelled') return orders.filter(o => o.status === 'cancelled').length;
    return 0;
  };

  const filteredOrders = getFilteredOrders();

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (!user) {
    return (
      <div className="page-container">
        <PageHeader title="My Orders" showBack={false} />
        <EmptyState
          icon="🔒"
          title="Login Required"
          description="Please login via Telegram to view your orders"
          actionLabel={loginPending ? 'Waiting for Telegram...' : 'Login via Telegram'}
          onAction={startLoginSession}
          className="pt-20"
        />
      </div>
    );
  }

  return (
    <div className="page-container animate-fadeIn">
      <PageHeader title="My Orders" showBack={false} />

      {/* Success */}
      {success && (
        <div className="mx-4 mt-4 bg-green-50 border border-green-200 rounded-card p-3 animate-slideUp">
          <p className="text-green-700 text-sm font-medium flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {success}
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="px-4 pt-4">
        <div className="flex gap-1 bg-surface rounded-button p-1">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2 px-2 rounded-[10px] text-xs font-semibold transition-all ${
                activeTab === tab.key
                  ? 'bg-card text-primary shadow-card'
                  : 'text-text-secondary'
              }`}
            >
              {tab.label}
              <span className="ml-1 text-text-tertiary">({getTabCount(tab.key)})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Orders List */}
      <div className="px-4 pt-4 pb-20">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="skeleton h-[140px] rounded-card" />)}
          </div>
        ) : filteredOrders.length > 0 ? (
          <div className="space-y-3">
            {filteredOrders.map(order => (
              <button
                key={order.id}
                onClick={() => navigate(`/order/${order.id}`)}
                className="w-full text-left bg-card rounded-card border border-border-light p-4 active:scale-[0.98] hover:border-accent/20 transition-all shadow-card"
              >
                <div className="flex items-start justify-between mb-2">
                  <span className="font-mono text-xs text-text-tertiary">
                    #{order.order_code || order.id}
                  </span>
                  <StatusBadge status={order.status} />
                </div>

                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-[13px] text-primary">{order.merchant_name || 'Shop'}</h3>
                  <span className="text-text-tertiary text-[11px]">{formatDate(order.created_at)}</span>
                </div>

                <p className="text-[12px] text-text-secondary line-clamp-1 mb-3">
                  {order.items?.length > 0
                    ? order.items.map(item => item.product_name).join(', ')
                    : `${order.item_count || 0} items`}
                </p>

                <div className="flex items-center justify-between pt-3 border-t border-border-light/60">
                  <span className="font-bold text-accent text-[15px]">
                    ${parseFloat(order.total || 0).toFixed(2)}
                  </span>
                  <span className="text-accent text-xs font-semibold flex items-center gap-1">
                    View Details
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <EmptyState
            icon="🛍️"
            title="No orders yet"
            description="Start shopping and your orders will appear here"
            actionLabel="Start Shopping"
            onAction={() => navigate('/')}
            className="pt-12"
          />
        )}
      </div>
    </div>
  );
}
