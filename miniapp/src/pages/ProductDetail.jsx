import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as productService from '../services/productService';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import EmptyState from '../components/EmptyState';

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToCart } = useCart();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [qty, setQty] = useState(1);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [imgIdx, setImgIdx] = useState(0);
  const touchStart = useRef(null);

  useEffect(() => {
    setIsWishlisted(localStorage.getItem(`wishlist_${id}`) === 'true');
  }, [id]);

  useEffect(() => {
    productService.getProduct(id)
      .then(data => { setProduct(data); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, [id]);

  const toggleWishlist = (e) => {
    e.stopPropagation();
    const next = !isWishlisted;
    setIsWishlisted(next);
    next ? localStorage.setItem(`wishlist_${id}`, 'true') : localStorage.removeItem(`wishlist_${id}`);
  };

  const handleAddToCart = async () => {
    if (!user) { alert('Please open the app via Telegram bot to login'); return; }
    setAdding(true);
    const success = await addToCart(product.id, qty);
    setAdding(false);
    if (success) { setAdded(true); setTimeout(() => setAdded(false), 2000); }
  };

  const onTouchStart = useCallback((e) => { touchStart.current = e.touches[0].clientX; }, []);
  const onTouchEnd = useCallback((e, total) => {
    if (touchStart.current === null) return;
    const diff = touchStart.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      setImgIdx(prev => diff > 0 ? Math.min(prev + 1, total - 1) : Math.max(prev - 1, 0));
    }
    touchStart.current = null;
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface">
        <div className="skeleton w-full" style={{ height: 380 }} />
        <div className="px-5 pt-5 space-y-3">
          <div className="skeleton h-3 w-20 rounded-md" />
          <div className="skeleton h-6 w-3/4 rounded-lg" />
          <div className="skeleton h-8 w-36 rounded-lg" />
          <div className="skeleton h-3 w-28 rounded-md" />
          <div className="skeleton h-px w-full" />
          <div className="skeleton h-24 w-full rounded-card" />
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-4">
        <EmptyState
          icon="😕"
          title="Product not found"
          description="This product may have been removed"
          actionLabel="Go Back"
          onAction={() => navigate(-1)}
        />
      </div>
    );
  }

  const rawImages = product.images || (product.primary_image ? [product.primary_image] : null);
  const images = rawImages?.map(img => typeof img === 'string' ? img : img?.url).filter(Boolean) || [];
  const price = parseFloat(product.base_price || product.price || 0);
  const comparePrice = parseFloat(product.compare_price || product.original_price || 0);
  const hasDiscount = comparePrice > 0 && comparePrice > price;
  const discountPct = hasDiscount ? Math.round(((comparePrice - price) / comparePrice) * 100) : 0;
  const savings = hasDiscount ? (comparePrice - price) : 0;
  const rating = parseFloat(product.rating_avg || 0);
  const reviewCount = parseInt(product.review_count || 0);
  const stock = parseInt(product.stock_quantity || product.stock || 0);
  const inStock = stock > 0;

  return (
    <div className="min-h-screen bg-surface animate-fadeIn" style={{ paddingBottom: inStock ? 100 : 80 }}>

      {/* Image Gallery */}
      <div className="relative w-full bg-surface-2" style={{ height: 380 }}>
        <div
          className="w-full h-full overflow-hidden"
          onTouchStart={onTouchStart}
          onTouchEnd={(e) => onTouchEnd(e, images.length)}
        >
          {images.length > 0 ? (
            <div
              className="flex h-full transition-transform duration-300 ease-out-expo"
              style={{ width: `${images.length * 100}%`, transform: `translateX(-${imgIdx * (100 / images.length)}%)` }}
            >
              {images.map((src, i) => (
                <img key={i} src={src} alt={`${product.name} ${i + 1}`}
                  className="h-full object-cover" style={{ width: `${100 / images.length}%` }} loading={i === 0 ? 'eager' : 'lazy'} />
              ))}
            </div>
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-accent/5 to-surface-2 flex items-center justify-center">
              <span className="text-7xl font-heading font-bold text-accent/20">{product.name?.[0]?.toUpperCase() || '?'}</span>
            </div>
          )}

          {!inStock && (
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center">
              <span className="bg-white/95 text-danger font-heading font-bold text-sm px-5 py-2 rounded-full shadow-lg">Out of Stock</span>
            </div>
          )}
        </div>

        {/* Back button */}
        <button onClick={() => navigate(-1)}
          className="absolute top-4 left-4 w-10 h-10 bg-card/90 backdrop-blur-md rounded-full shadow-card flex items-center justify-center active:scale-95 transition-transform">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        {/* Wishlist button */}
        <button onClick={toggleWishlist}
          className="absolute top-4 right-4 w-10 h-10 bg-card/90 backdrop-blur-md rounded-full shadow-card flex items-center justify-center active:scale-95 transition-transform">
          <svg width="18" height="18" viewBox="0 0 24 24" fill={isWishlisted ? '#f43f5e' : 'none'} stroke={isWishlisted ? '#f43f5e' : 'var(--text-secondary)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>

        {/* Image counter */}
        {images.length > 1 && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/40 backdrop-blur-md text-white text-[10px] font-semibold px-3 py-1 rounded-full">
            {imgIdx + 1}/{images.length}
          </div>
        )}

        {/* Discount badge */}
        {hasDiscount && (
          <div className="absolute bottom-4 left-4 bg-danger text-white text-xs font-bold px-3 py-1 rounded-full shadow-md">
            -{discountPct}%
          </div>
        )}

        {/* Dot indicators */}
        {images.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
            {images.map((_, i) => (
              <button key={i} onClick={() => setImgIdx(i)}
                className={`rounded-full transition-all duration-200 ${
                  i === imgIdx ? 'w-5 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/50'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Info Section */}
      <div className="bg-card rounded-t-[24px] -mt-6 relative z-10 px-5 pt-5">
        {product.merchant_name && (
          <button
            onClick={() => navigate(`/shop/${product.merchant_id}`)}
            className="flex items-center gap-1.5 mb-1.5 group bg-transparent border-none p-0 cursor-pointer"
          >
            <span className="text-xs text-accent font-semibold group-hover:underline">{product.merchant_name}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        )}

        <h1 className="text-xl font-heading font-bold text-primary leading-tight">{product.name}</h1>

        {rating > 0 && (
          <div className="flex items-center gap-2 mt-2">
            <div className="flex items-center gap-0.5">
              <span className="text-amber-400 text-sm">&#9733;</span>
              <span className="text-sm font-semibold text-primary">{rating.toFixed(1)}</span>
            </div>
            <span className="text-text-tertiary text-xs">({reviewCount} reviews)</span>
          </div>
        )}

        <div className="mt-3 flex items-end gap-3">
          <span className="text-3xl font-heading font-bold text-accent">${price.toFixed(2)}</span>
          {hasDiscount && (
            <span className="line-through text-text-tertiary text-base mb-0.5">${comparePrice.toFixed(2)}</span>
          )}
        </div>
        {hasDiscount && (
          <p className="text-xs font-semibold text-green-600 mt-1">
            You save ${savings.toFixed(2)} ({discountPct}% off)
          </p>
        )}

        {/* Stock */}
        <div className="mt-3 mb-3">
          {inStock ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              In Stock {stock <= 5 && `· Only ${stock} left`}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-danger bg-red-50 px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-danger" />
              Out of Stock
            </span>
          )}
        </div>

        <div className="h-px bg-border-light" />

        {/* Quantity */}
        {inStock && (
          <div className="my-4">
            <label className="font-semibold text-sm text-primary block mb-2.5">Quantity</label>
            <div className="inline-flex items-center rounded-full overflow-hidden border-[1.5px] border-border-light">
              <button onClick={() => setQty(Math.max(1, qty - 1))} disabled={qty <= 1}
                className="w-10 h-10 flex items-center justify-center text-lg font-semibold text-text-secondary hover:bg-surface disabled:opacity-30 transition-colors bg-transparent border-none cursor-pointer">
                &minus;
              </button>
              <span className="w-12 h-10 flex items-center justify-center text-base font-bold text-primary border-x border-border-light">
                {qty}
              </span>
              <button onClick={() => setQty(Math.min(stock, qty + 1))} disabled={qty >= stock}
                className="w-10 h-10 flex items-center justify-center text-lg font-semibold text-accent hover:bg-accent/5 disabled:opacity-30 transition-colors bg-transparent border-none cursor-pointer">
                +
              </button>
            </div>
          </div>
        )}

        {/* Meta info */}
        <div className="flex gap-2 flex-wrap my-4">
          {product.delivery_days && (
            <span className="bg-surface rounded-full px-3 py-1.5 text-xs text-text-secondary flex items-center gap-1.5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="3" width="15" height="13" /><polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                <circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" />
              </svg>
              {product.delivery_days}-{product.delivery_days + 2} days
            </span>
          )}
          {product.weight && (
            <span className="bg-surface rounded-full px-3 py-1.5 text-xs text-text-secondary">
              {product.weight}
            </span>
          )}
          {product.sku && (
            <span className="bg-surface rounded-full px-3 py-1.5 text-xs text-text-secondary">
              {product.sku}
            </span>
          )}
          <span className="bg-surface rounded-full px-3 py-1.5 text-xs text-text-secondary">KHQR</span>
          <span className="bg-surface rounded-full px-3 py-1.5 text-xs text-text-secondary">COD</span>
        </div>

        {/* Description */}
        {product.description && (
          <div className="mb-5">
            <h3 className="font-heading font-semibold text-sm text-primary mb-2">Description</h3>
            <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
              {expanded || product.description.length <= 150
                ? product.description
                : product.description.substring(0, 150) + '...'}
            </p>
            {product.description.length > 150 && (
              <button onClick={() => setExpanded(!expanded)}
                className="text-accent text-sm font-semibold mt-1.5 bg-transparent border-none cursor-pointer p-0">
                {expanded ? 'Show less' : 'Show more'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Bottom Action Bar */}
      {inStock && (
        <div className="fixed bottom-0 left-0 right-0 z-40">
          <div className="h-5 bg-gradient-to-t from-card to-transparent pointer-events-none" />
          <div className="bg-card/95 backdrop-blur-md border-t border-border-light/50 px-5 py-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] text-text-tertiary uppercase tracking-wider font-medium">Total</p>
                <p className="text-xl font-heading font-bold text-primary">${(price * qty).toFixed(2)}</p>
              </div>
              <button onClick={handleAddToCart} disabled={adding || added}
                className={`flex-1 max-w-[220px] py-3.5 rounded-button font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.97] transition-all duration-200 border-none cursor-pointer ${
                  added ? 'bg-success text-black' : 'bg-accent text-black'
                } ${adding ? 'opacity-70' : ''}`}>
                {added ? '&#10003; Added to Cart' : adding ? 'Adding...' : 'Add to Cart'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {added && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-slideUp bg-success text-white px-5 py-2.5 rounded-button text-sm font-semibold shadow-lg">
          Added to cart!
        </div>
      )}
    </div>
  );
}
