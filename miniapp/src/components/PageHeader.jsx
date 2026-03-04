import { useNavigate } from 'react-router-dom';

export default function PageHeader({ title, showBack = true, onBack, rightAction }) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };

  return (
    <div className="sticky top-0 z-30 bg-card/95 backdrop-blur-md border-b border-border-light/60">
      <div className="h-14 flex items-center px-4 gap-2">
        {showBack && (
          <button
            onClick={handleBack}
            className="-ml-1 w-9 h-9 flex items-center justify-center rounded-full hover:bg-surface active:scale-95 transition-all text-primary"
            aria-label="Go back"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        )}
        <h1 className="font-heading font-semibold text-[15px] flex-1 text-center text-primary truncate">
          {title}
        </h1>
        {rightAction ? (
          <div className="flex-shrink-0">{rightAction}</div>
        ) : showBack ? (
          <div className="w-9" />
        ) : null}
      </div>
    </div>
  );
}
