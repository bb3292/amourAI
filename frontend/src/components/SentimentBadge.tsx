interface Props {
  sentiment: string | null;
  score?: number | null;
}

export default function SentimentBadge({ sentiment, score }: Props) {
  const s = sentiment?.toLowerCase() || 'neutral';
  const colors: Record<string, string> = {
    positive: 'badge-green',
    negative: 'badge-red',
    neutral: 'badge-gray',
    mixed: 'badge-yellow',
  };
  const cls = colors[s] || 'badge-gray';

  return (
    <span className={`badge ${cls}`}>
      {s.charAt(0).toUpperCase() + s.slice(1)}
      {score != null && ` (${score > 0 ? '+' : ''}${score.toFixed(1)})`}
    </span>
  );
}
