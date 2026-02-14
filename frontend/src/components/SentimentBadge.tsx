interface Props {
  sentiment: string | null;
  score?: number | null;
}

const SENTIMENT_CONFIG: Record<string, { dot: string; badge: string }> = {
  positive: { dot: 'bg-emerald-400', badge: 'badge-green' },
  negative: { dot: 'bg-red-400', badge: 'badge-red' },
  neutral: { dot: 'bg-zinc-400', badge: 'badge-gray' },
  mixed: { dot: 'bg-amber-400', badge: 'badge-yellow' },
};

export default function SentimentBadge({ sentiment, score }: Props) {
  const s = sentiment?.toLowerCase() || 'neutral';
  const config = SENTIMENT_CONFIG[s] || SENTIMENT_CONFIG.neutral;

  return (
    <span className={`badge ${config.badge} gap-1.5`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {s.charAt(0).toUpperCase() + s.slice(1)}
      {score != null && (
        <span className="opacity-60 font-mono text-[10px] ml-0.5">
          {score > 0 ? '+' : ''}{score.toFixed(1)}
        </span>
      )}
    </span>
  );
}
