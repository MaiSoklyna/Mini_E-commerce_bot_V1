import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import * as merchantService from '../services/merchantService'
import ProductCard from '../components/ProductCard'
import PageHeader from '../components/PageHeader'
import EmptyState from '../components/EmptyState'
import SectionHeader from '../components/SectionHeader'

export default function Shop() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [merchant, setMerchant] = useState(null)
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([merchantService.getMerchant(id), merchantService.getMerchantProducts(id)])
      .then(([m, p]) => { setMerchant(m); setProducts(p) })
      .catch(() => navigate(-1)).finally(() => setLoading(false))
  }, [id])

  if (loading) return (
    <div className="page-container"><PageHeader title="" />
      <div className="px-4 pt-4">
        <div className="skeleton h-24 rounded-card mb-5" />
        <div className="grid grid-cols-2 gap-3">
          {[1,2,3,4].map(i => <div key={i} className="skeleton h-56 rounded-card" />)}
        </div>
      </div>
    </div>
  )
  if (!merchant) return null

  return (
    <div className="page-container animate-fadeIn">
      <PageHeader title={merchant.name} rightAction={
        <button
          onClick={() => navigate('/support', { state: { merchantId: merchant.id, merchantName: merchant.name } })}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-surface transition-colors"
          aria-label="Contact support"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      } />

      <div className="px-4 pt-4">
        {/* Merchant Info Card */}
        <div className="bg-card border border-border-light rounded-card p-4 mb-6 shadow-card">
          <div className="flex gap-3.5">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-accent/10 to-cyan/5 flex-shrink-0 flex items-center justify-center text-2xl">
              {merchant.icon_emoji || '🏪'}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-heading font-bold text-primary">{merchant.name}</h2>
              {merchant.description && (
                <p className="text-xs text-text-secondary mt-1 leading-relaxed line-clamp-2">
                  {merchant.description}
                </p>
              )}
              <div className="flex items-center gap-4 mt-2.5">
                <span className="flex items-center gap-1.5 text-xs text-text-secondary">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  </svg>
                  {merchant.product_count || 0} products
                </span>
                <span className="flex items-center gap-1.5 text-xs text-text-secondary">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                  </svg>
                  {merchant.order_count || 0} orders
                </span>
              </div>
              {merchant.phone && (
                <p className="flex items-center gap-1.5 text-xs text-accent font-medium mt-2">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                  {merchant.phone}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Products */}
        <SectionHeader title={`Products (${products.length})`} />
        {products.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 pb-6">
            {products.map(p => <ProductCard key={p.id} product={p} />)}
          </div>
        ) : (
          <EmptyState
            icon="📭"
            title="No products yet"
            description="This shop hasn't added any products"
          />
        )}
      </div>
    </div>
  )
}
