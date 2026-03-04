export default function StatusBadge({ status }) {
  const statusConfig = {
    pending: { bg: 'rgba(245,158,11,0.1)', color: 'var(--gold)', label: 'Pending' },
    confirmed: { bg: 'rgba(59,130,246,0.1)', color: 'var(--blue)', label: 'Confirmed' },
    processing: { bg: 'rgba(168,85,247,0.1)', color: 'var(--purple)', label: 'Processing' },
    shipped: { bg: 'rgba(168,85,247,0.1)', color: 'var(--purple)', label: 'Shipped' },
    delivered: { bg: 'rgba(0,212,170,0.1)', color: 'var(--accent)', label: 'Delivered' },
    cancelled: { bg: 'rgba(244,63,94,0.1)', color: 'var(--danger)', label: 'Cancelled' },
  };

  const config = statusConfig[status?.toLowerCase()] || statusConfig.pending;

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold"
      style={{ background: config.bg, color: config.color }}
    >
      <span
        className="w-[5px] h-[5px] rounded-full flex-shrink-0"
        style={{ background: config.color }}
      />
      {config.label}
    </span>
  );
}
