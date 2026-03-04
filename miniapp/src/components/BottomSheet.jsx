import { useEffect } from 'react';

export default function BottomSheet({ isOpen, onClose, title, children }) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/50 backdrop-blur-[2px] z-40 animate-fadeIn"
      />

      {/* Sheet */}
      <div
        className={`
          fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-[20px]
          max-h-[85vh] overflow-y-auto shadow-bottom-sheet
          transition-transform duration-[350ms]
          ${isOpen ? 'translate-y-0' : 'translate-y-full'}
        `}
        style={{ transitionTimingFunction: 'cubic-bezier(0.32, 0.72, 0, 1)' }}
      >
        {/* Handle Bar */}
        <div className="sticky top-0 bg-card pt-3 pb-1 z-10">
          <div className="w-9 h-1 bg-border-light rounded-full mx-auto" />
        </div>

        {/* Title */}
        {title && (
          <div className="px-5 pb-3 pt-2">
            <h3 className="text-base font-heading font-semibold text-primary">{title}</h3>
          </div>
        )}

        {/* Content */}
        <div className="px-5 pb-6">
          {children}
        </div>
      </div>
    </>
  );
}
