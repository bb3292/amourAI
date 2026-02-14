interface ScoreBarProps {
  value: number;  // 0-1
  label: string;
  showValue?: boolean;
}

function getColor(value: number): string {
  if (value >= 0.8) return 'bg-emerald-500';
  if (value >= 0.6) return 'bg-brand-500';
  if (value >= 0.4) return 'bg-amber-500';
  return 'bg-red-500';
}

function getTextColor(value: number): string {
  if (value >= 0.8) return 'text-emerald-400';
  if (value >= 0.6) return 'text-brand-400';
  if (value >= 0.4) return 'text-amber-400';
  return 'text-red-400';
}

export default function ScoreBar({ value, label, showValue = true }: ScoreBarProps) {
  const pct = Math.round(value * 100);
  return (
    <div className="space-y-1.5">
      {(label || showValue) && (
        <div className="flex justify-between items-center text-xs">
          {label && <span className="text-zinc-500">{label}</span>}
          {showValue && (
            <span className={`font-mono font-semibold ${getTextColor(value)}`}>{pct}%</span>
          )}
        </div>
      )}
      <div className="w-full bg-white/[0.06] rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full transition-all duration-700 ease-out ${getColor(value)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/** Severity Meter - 5 segments */
export function SeverityMeter({ value, size = 'md' }: { value: number; size?: 'sm' | 'md' }) {
  const filled = Math.round(value * 5);
  const h = size === 'sm' ? 'h-1' : 'h-1.5';
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <div
          key={i}
          className={`${h} flex-1 rounded-full transition-colors duration-300 ${
            i <= filled
              ? i <= 2 ? 'bg-emerald-500' : i <= 3 ? 'bg-amber-500' : 'bg-red-500'
              : 'bg-white/[0.06]'
          }`}
        />
      ))}
    </div>
  );
}

export function ScoreBadge({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color =
    value >= 0.8 ? 'badge-green' :
    value >= 0.6 ? 'badge-blue' :
    value >= 0.4 ? 'badge-yellow' :
    'badge-red';
  return <span className={`badge ${color} font-mono text-[11px]`}>{pct}%</span>;
}
