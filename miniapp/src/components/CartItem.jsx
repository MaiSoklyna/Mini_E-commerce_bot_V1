export default function CartItem({ item, onUpdate, onRemove }) {
  return (
    <div className="animate-fadeIn flex gap-3 p-3 bg-card rounded-card border border-border-light mb-2">
      <div className="w-16 h-16 rounded-xl bg-surface flex-shrink-0 overflow-hidden border border-border-light">
        {item.primary_image ? (
          <img src={item.primary_image} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-2xl text-accent font-heading font-bold">
            {item.product_name?.[0]?.toUpperCase() || '📦'}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-primary line-clamp-1">{item.product_name}</p>
        <p className="text-sm font-bold text-accent mt-1">
          ${parseFloat(item.unit_price).toFixed(2)}
        </p>
        <div className="flex items-center justify-between mt-1.5">
          <div className="flex items-center gap-0 rounded-full border border-border-light overflow-hidden">
            <button
              onClick={() => onUpdate(item.id, item.quantity - 1)}
              className="w-8 h-8 flex items-center justify-center text-sm font-semibold text-text-secondary active:bg-gray-100 transition-colors"
            >
              −
            </button>
            <span className="text-sm font-bold min-w-[28px] text-center text-primary">{item.quantity}</span>
            <button
              onClick={() => onUpdate(item.id, item.quantity + 1)}
              className="w-8 h-8 flex items-center justify-center text-sm font-semibold text-accent active:bg-accent/10 transition-colors"
            >
              +
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-primary">${parseFloat(item.line_total).toFixed(2)}</span>
            <button
              onClick={() => onRemove(item.id)}
              className="w-8 h-8 flex items-center justify-center text-red-500 active:scale-90 transition-transform"
            >
              🗑
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
