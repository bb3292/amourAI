interface Props {
  status: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'badge-yellow',
  processing: 'badge-blue',
  in_progress: 'badge-blue',
  done: 'badge-green',
  failed: 'badge-red',
  flagged: 'badge-red',
  accepted: 'badge-green',
};

export default function StatusBadge({ status }: Props) {
  const cls = STATUS_COLORS[status] || 'badge-gray';
  return (
    <span className={`badge ${cls}`}>
      {status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
    </span>
  );
}
