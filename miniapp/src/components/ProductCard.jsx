import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function ProductCard({ product, onAddToCart }) {
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  const handleAddToCart = async (e) => {
    e.stopPropagation();
    if (!onAddToCart) return;
    setAdding(true);
    await onAddToCart(product.id);
    setTimeout(() => setAdding(false), 1500);
  };

  const price = parseFloat(product.base_price || product.price || 0);
  const comparePrice = parseFloat(product.compare_price || product.original_price || 0);
  const hasDiscount = comparePrice > 0 && comparePrice > price;
  const discountPct = hasDiscount ? Math.round(((comparePrice - price) / comparePrice) * 100) : null;

  const rawImages = product.images || (product.primary_image ? [product.primary_image] : null);
  const images = rawImages?.map(img => typeof img === 'string' ? img : img?.url).filter(Boolean);
  const rating = parseFloat(product.rating_avg || 0);
  const reviewCount = parseInt(product.review_count || 0);
  const stock = parseInt(product.stock_quantity || product.stock || 0);

  return (
    <div
      onClick={() => navigate(`/product/${product.id}`)}
      className="group product-card cursor-pointer"
    >
      {/* Image */}
      <div className="relative w-full aspect-square overflow-hidden">
        {images && images.length > 0 ? (
          <>
            {!imgLoaded && (
              <div className="absolute inset-0 skeleton" />
            )}
            <img
              src={images[0]}
              alt={product.name}
              className={`w-full h-full object-cover transition-all duration-500 group-hover:scale-105 ${
                imgLoaded ? 'opacity-100' : 'opacity-0'
              }`}
              onLoad={() => setImgLoaded(true)}
              loading="lazy"
            />
          </>
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-accent/5 to-surface-2 flex items-center justify-center">
            <span className="text-4xl font-heading font-bold text-accent/25">
              {product.name?.[0]?.toUpperCase() || '?'}
            </span>
          </div>
        )}

        {/* Out of stock overlay */}
        {stock === 0 && (
          <div className="absolute inset-0 bg-black/35 flex items-center justify-center backdrop-blur-[1px]">
            <span className="bg-white/95 text-danger text-[10px] font-bold px-3 py-1 rounded-full shadow-sm">
              Out of Stock
            </span>
          </div>
        )}

        {/* Discount badge */}
        {discountPct && (
          <div className="absolute top-2 left-2 bg-danger text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
            -{discountPct}%
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3 space-y-1.5">
        {/* Merchant */}
        {product.merchant_name && (
          <p className="text-[11px] text-text-tertiary font-medium truncate">
            {product.merchant_name}
          </p>
        )}

        {/* Name */}
        <h3 className="text-[13px] font-heading font-semibold text-primary line-clamp-2 leading-snug">
          {product.name}
        </h3>

        {/* Rating */}
        {rating > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-amber-400 text-[11px]">&#9733;</span>
            <span className="text-[11px] font-semibold text-primary">{rating.toFixed(1)}</span>
            {reviewCount > 0 && (
              <span className="text-[10px] text-text-tertiary">({reviewCount})</span>
            )}
          </div>
        )}

        {/* Price */}
        <div className="flex items-baseline gap-1.5 pt-0.5">
          <span className="text-accent font-bold text-[15px]">${price.toFixed(2)}</span>
          {hasDiscount && (
            <span className="text-text-tertiary text-[11px] line-through">
              ${comparePrice.toFixed(2)}
            </span>
          )}
        </div>

        {/* Add to Cart */}
        {onAddToCart && (
          <button
            onClick={handleAddToCart}
            disabled={adding || stock === 0}
            className={`
              mt-1 w-full py-2 rounded-button text-xs font-semibold transition-all duration-200
              ${adding
                ? 'bg-success/90 text-black'
                : 'bg-accent hover:bg-accent-hover text-black'
              }
              disabled:opacity-40 disabled:cursor-not-allowed
              active:scale-[0.97]
            `}
          >
            {adding ? '&#10003; Added' : stock === 0 ? 'Out of Stock' : 'Add to Cart'}
          </button>
        )}
      </div>
    </div>
  );
}
