interface ScoreBarProps {
  value: number;  // 0-1
  label: string;
  showValue?: boolean;
}

function getColor(value: number): string {
  if (value >= 0.8) return 'bg-emerald-500';
  if (value >= 0.6) return 'bg-blue-500';
  if (value >= 0.4) return 'bg-amber-500';
  return 'bg-red-500';
}

function getTextColor(value: number): string {
  if (value >= 0.8) return 'text-emerald-700';
  if (value >= 0.6) return 'text-blue-700';
  if (value >= 0.4) return 'text-amber-700';
  return 'text-red-700';
}

export default function ScoreBar({ value, label, showValue = true }: ScoreBarProps) {
  const pct = Math.round(value * 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center text-xs">
        <span className="text-gray-600">{label}</span>
        {showValue && (
          <span className={`font-semibold ${getTextColor(value)}`}>{pct}%</span>
        )}
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all duration-500 ${getColor(value)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function ScoreBadge({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = value >= 0.8 ? 'badge-green' : value >= 0.6 ? 'badge-blue' : value >= 0.4 ? 'badge-yellow' : 'badge-red';
  return <span className={`badge ${color}`}>{pct}%</span>;
}
