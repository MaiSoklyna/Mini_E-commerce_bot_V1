export default function EmptyState({
  icon = '📦',
  title,
  description,
  actionLabel,
  onAction,
  className = '',
}) {
  return (
    <div className={`flex flex-col items-center justify-center px-6 py-16 text-center animate-fadeIn ${className}`}>
      <div className="w-20 h-20 rounded-full bg-surface-2 flex items-center justify-center mb-4">
        {typeof icon === 'string' ? (
          <span className="text-4xl">{icon}</span>
        ) : (
          icon
        )}
      </div>
      {title && (
        <h3 className="text-base font-heading font-semibold text-primary mb-1.5">{title}</h3>
      )}
      {description && (
        <p className="text-sm text-text-secondary max-w-[260px] leading-relaxed">{description}</p>
      )}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-5 bg-accent text-black rounded-button px-7 py-2.5 text-sm font-semibold active:scale-[0.97] transition-transform"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
