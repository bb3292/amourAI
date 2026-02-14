import { useEffect, useState } from 'react';
import {
  Shield, AlertTriangle, CheckCircle, Clock, RefreshCw,
  Activity,
} from 'lucide-react';
import { api } from '../api/client';
import type { MonitoringSummary } from '../types';
import { ScoreBadge } from '../components/ScoreBar';
import EmptyState from '../components/EmptyState';

/* ─── Circular Score Gauge ─────────────────────────────────── */
function ScoreGauge({
  value, label, size = 100, strokeWidth = 6,
}: {
  value: number; label: string; size?: number; strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, value));
  const offset = circumference - clamped * circumference;
  const pct = Math.round(clamped * 100);

  const getColor = (v: number) => {
    if (v >= 0.8) return { stroke: '#10b981', text: 'text-emerald-400', track: 'rgba(16,185,129,0.1)', grade: 'A' };
    if (v >= 0.6) return { stroke: '#6366f1', text: 'text-brand-400', track: 'rgba(99,102,241,0.1)', grade: 'B' };
    if (v >= 0.4) return { stroke: '#f59e0b', text: 'text-amber-400', track: 'rgba(245,158,11,0.1)', grade: 'C' };
    return { stroke: '#ef4444', text: 'text-red-400', track: 'rgba(239,68,68,0.1)', grade: 'D' };
  };

  const colors = getColor(clamped);

  return (
    <div className="flex flex-col items-center gap-2.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke={colors.track} strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke={colors.stroke} strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 1s ease-out' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-lg font-bold font-mono ${colors.text}`}>{pct}</span>
          <span className={`text-[10px] font-bold ${colors.text} opacity-60`}>{colors.grade}</span>
        </div>
      </div>
      <span className="text-[11px] font-medium text-zinc-500 text-center leading-tight">{label}</span>
    </div>
  );
}

export default function Monitoring() {
  const [data, setData] = useState<MonitoringSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.getMonitoring().then(setData).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(load, []);

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="skeleton h-8 w-48" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="skeleton h-24 rounded-2xl" />)}
        </div>
        <div className="skeleton h-48 rounded-2xl" />
      </div>
    );
  }

  if (!data || data.total_artifacts === 0) {
    return (
      <div className="space-y-6 animate-fade-in">
        <h1 className="text-2xl font-bold text-white tracking-tight">Quality Monitoring</h1>
        <EmptyState
          icon={<Shield className="w-8 h-8" />}
          title="No data to monitor"
          description="Quality metrics appear once artifacts have been generated and evaluated. Create actions from themes to begin."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Quality Monitoring</h1>
          <p className="text-zinc-500 text-sm mt-1">White Circle evaluation — AI-powered quality scoring</p>
        </div>
        <button onClick={load} className="btn-secondary flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* ═══ Summary KPIs ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Artifacts', value: data.total_artifacts, icon: Shield, color: 'text-brand-400', bg: 'bg-brand-500/10' },
          { label: 'Accepted', value: data.accepted_count, icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          { label: 'Flagged', value: data.flagged_count, icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10' },
          { label: 'Pending Review', value: data.pending_review, icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="kpi-card">
            <div className="relative flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <div>
                <div className="text-2xl font-bold text-white font-mono">{value}</div>
                <div className="text-[10px] text-zinc-500">{label}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ═══ Quality Score Gauges ═══ */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-6">
          <Activity className="w-4 h-4 text-brand-400" />
          <h3 className="font-semibold text-white text-sm">Quality Scores</h3>
          <span className="text-[10px] text-zinc-600 ml-1">White Circle Evaluation</span>
        </div>
        <div className="flex flex-wrap justify-center gap-8 md:gap-10">
          <ScoreGauge value={data.avg_relevance} label="Relevance" size={100} />
          <ScoreGauge value={data.avg_evidence_coverage} label="Evidence" size={100} />
          <ScoreGauge value={data.avg_hallucination_risk} label="Safety" size={100} />
          <ScoreGauge value={data.avg_actionability} label="Actionability" size={100} />
          <ScoreGauge value={data.avg_freshness} label="Freshness" size={100} />
          <ScoreGauge value={data.avg_overall} label="Overall" size={120} strokeWidth={8} />
        </div>
      </div>

      {/* ═══ Evaluation History ═══ */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.06]">
          <h3 className="font-semibold text-white text-sm">Evaluation History</h3>
          <p className="text-[10px] text-zinc-600 mt-0.5">Scored by Claude (LLM-as-judge) against source evidence</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full table-premium">
            <thead>
              <tr>
                <th>Artifact</th>
                <th>Relevance</th>
                <th>Evidence</th>
                <th>Safety</th>
                <th>Actionability</th>
                <th>Freshness</th>
                <th>Overall</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.evaluations.map(ev => (
                <tr key={ev.id} className={ev.flagged ? 'bg-red-500/[0.03]' : ''}>
                  <td className="text-zinc-400 font-mono text-xs">#{ev.artifact_id}</td>
                  <td><ScoreBadge value={ev.relevance} /></td>
                  <td><ScoreBadge value={ev.evidence_coverage} /></td>
                  <td><ScoreBadge value={ev.hallucination_risk} /></td>
                  <td><ScoreBadge value={ev.actionability} /></td>
                  <td><ScoreBadge value={ev.freshness} /></td>
                  <td><ScoreBadge value={ev.overall_score} /></td>
                  <td>
                    {ev.flagged ? (
                      <span className="badge badge-red gap-1">
                        <AlertTriangle className="w-3 h-3" /> Flagged
                      </span>
                    ) : (
                      <span className="badge badge-green gap-1">
                        <CheckCircle className="w-3 h-3" /> Pass
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══ Threshold Config ═══ */}
      <div className="card p-6">
        <h3 className="font-semibold text-white text-sm mb-2">Evaluation Thresholds</h3>
        <p className="text-xs text-zinc-600 mb-4 leading-relaxed">
          Artifacts are flagged for human review when any metric falls below its threshold.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Relevance', threshold: 60, color: 'text-brand-400' },
            { label: 'Evidence', threshold: 50, color: 'text-sky-400' },
            { label: 'Safety', threshold: 40, color: 'text-emerald-400' },
            { label: 'Actionability', threshold: 50, color: 'text-purple-400' },
            { label: 'Freshness', threshold: 40, color: 'text-amber-400' },
          ].map(({ label, threshold, color }) => (
            <div key={label} className="text-center p-3 bg-white/[0.02] border border-white/[0.04] rounded-xl">
              <div className={`text-lg font-bold font-mono ${color}`}>{threshold}%</div>
              <div className="text-[10px] text-zinc-500 mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
