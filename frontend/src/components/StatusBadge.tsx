interface Props {
  status: string;
}

const STATUS_CONFIG: Record<string, { badge: string; dot: string }> = {
  pending: { badge: 'badge-yellow', dot: 'bg-amber-400' },
  processing: { badge: 'badge-blue', dot: 'bg-sky-400 animate-pulse' },
  in_progress: { badge: 'badge-blue', dot: 'bg-sky-400 animate-pulse' },
  done: { badge: 'badge-green', dot: 'bg-emerald-400' },
  failed: { badge: 'badge-red', dot: 'bg-red-400' },
  flagged: { badge: 'badge-red', dot: 'bg-red-400' },
  accepted: { badge: 'badge-green', dot: 'bg-emerald-400' },
  draft: { badge: 'badge-gray', dot: 'bg-zinc-500' },
  ready: { badge: 'badge-green', dot: 'bg-emerald-400' },
  archived: { badge: 'badge-gray', dot: 'bg-zinc-600' },
};

export default function StatusBadge({ status }: Props) {
  const config = STATUS_CONFIG[status] || { badge: 'badge-gray', dot: 'bg-zinc-500' };
  return (
    <span className={`badge ${config.badge} gap-1.5`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
    </span>
  );
}
