import { useNavigate } from 'react-router-dom';

export default function SectionHeader({ title, actionText = 'See All', actionPath, onAction, className = '' }) {
  const navigate = useNavigate();

  const handleAction = () => {
    if (onAction) {
      onAction();
    } else if (actionPath) {
      navigate(actionPath);
    }
  };

  return (
    <div className={`flex items-center justify-between mb-3 ${className}`}>
      <h2 className="text-[15px] font-heading font-bold text-primary">{title}</h2>
      {(actionPath || onAction) && (
        <button
          onClick={handleAction}
          className="text-xs text-accent font-semibold active:opacity-70 transition-opacity focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none rounded px-1 py-0.5"
        >
          {actionText} &rarr;
        </button>
      )}
    </div>
  );
}
