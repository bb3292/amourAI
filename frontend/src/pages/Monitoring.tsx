import { useEffect, useState } from 'react';
import { Shield, AlertTriangle, CheckCircle, Clock, RefreshCw } from 'lucide-react';
import { api } from '../api/client';
import type { MonitoringSummary } from '../types';
import { ScoreBadge } from '../components/ScoreBar';
import EmptyState from '../components/EmptyState';

/* ─────────────────────────────────────────────────────────────────
   Circular progress indicator – the actual "White Circle" component
   ───────────────────────────────────────────────────────────────── */
function WhiteCircle({
  value,
  label,
  size = 100,
  strokeWidth = 8,
}: {
  value: number;
  label: string;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, value));
  const offset = circumference - clamped * circumference;

  // Color based on score
  const getColor = (v: number) => {
    if (v >= 0.8) return { stroke: '#059669', text: 'text-emerald-600', bg: 'text-emerald-100' };
    if (v >= 0.6) return { stroke: '#2563eb', text: 'text-blue-600', bg: 'text-blue-100' };
    if (v >= 0.4) return { stroke: '#d97706', text: 'text-amber-600', bg: 'text-amber-100' };
    return { stroke: '#dc2626', text: 'text-red-600', bg: 'text-red-100' };
  };

  const colors = getColor(clamped);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          {/* Background track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className={colors.bg}
          />
          {/* Progress arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={colors.stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.8s ease-in-out' }}
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-lg font-bold ${colors.text}`}>
            {Math.round(clamped * 100)}%
          </span>
        </div>
      </div>
      <span className="text-xs font-medium text-gray-600 text-center leading-tight">{label}</span>
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
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!data || data.total_artifacts === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Quality Monitoring</h1>
        <EmptyState
          icon={<Shield className="w-8 h-8" />}
          title="No data to monitor"
          description="Quality metrics appear once artifacts have been generated and evaluated. Create actions from themes to begin."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quality Monitoring</h1>
          <p className="text-gray-500 text-sm mt-1">White Circle evaluation dashboard — all scores from live AI evaluation</p>
        </div>
        <button onClick={load} className="btn-secondary flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <Shield className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{data.total_artifacts}</div>
              <div className="text-xs text-gray-500">Total Artifacts</div>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{data.accepted_count}</div>
              <div className="text-xs text-gray-500">Accepted</div>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{data.flagged_count}</div>
              <div className="text-xs text-gray-500">Flagged</div>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{data.pending_review}</div>
              <div className="text-xs text-gray-500">Pending Review</div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
         WHITE CIRCLE QUALITY INDICATORS
         ═══════════════════════════════════════════════════════ */}
      <div className="card p-6">
        <h3 className="font-semibold text-gray-900 mb-6">Quality Scores (White Circle Evaluation)</h3>
        <div className="flex flex-wrap justify-center gap-8">
          <WhiteCircle value={data.avg_relevance} label="Relevance" size={110} />
          <WhiteCircle value={data.avg_evidence_coverage} label="Evidence Coverage" size={110} />
          <WhiteCircle value={data.avg_hallucination_risk} label="Hallucination Safety" size={110} />
          <WhiteCircle value={data.avg_actionability} label="Actionability" size={110} />
          <WhiteCircle value={data.avg_freshness} label="Freshness" size={110} />
          <WhiteCircle value={data.avg_overall} label="Overall Quality" size={130} strokeWidth={10} />
        </div>
      </div>

      {/* Evaluation Detail Table */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Evaluation History</h3>
          <p className="text-xs text-gray-400 mt-0.5">Each row is scored by Claude (LLM-as-judge) against the source evidence</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-3">Artifact</th>
                <th className="px-4 py-3">Relevance</th>
                <th className="px-4 py-3">Evidence</th>
                <th className="px-4 py-3">Hallucination</th>
                <th className="px-4 py-3">Actionability</th>
                <th className="px-4 py-3">Freshness</th>
                <th className="px-4 py-3">Overall</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.evaluations.map(ev => (
                <tr key={ev.id} className={`hover:bg-gray-50 ${ev.flagged ? 'bg-red-50/30' : ''}`}>
                  <td className="px-4 py-3 text-sm text-gray-700">Artifact #{ev.artifact_id}</td>
                  <td className="px-4 py-3"><ScoreBadge value={ev.relevance} /></td>
                  <td className="px-4 py-3"><ScoreBadge value={ev.evidence_coverage} /></td>
                  <td className="px-4 py-3"><ScoreBadge value={ev.hallucination_risk} /></td>
                  <td className="px-4 py-3"><ScoreBadge value={ev.actionability} /></td>
                  <td className="px-4 py-3"><ScoreBadge value={ev.freshness} /></td>
                  <td className="px-4 py-3"><ScoreBadge value={ev.overall_score} /></td>
                  <td className="px-4 py-3">
                    {ev.flagged ? (
                      <span className="badge badge-red flex items-center gap-1 w-fit">
                        <AlertTriangle className="w-3 h-3" /> Flagged
                      </span>
                    ) : (
                      <span className="badge badge-green">Pass</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Threshold Info */}
      <div className="card p-6">
        <h3 className="font-semibold text-gray-900 mb-3">Evaluation Thresholds</h3>
        <p className="text-sm text-gray-600 mb-3">
          Artifacts are flagged for human review when any metric falls below its threshold.
          All evaluations are performed live by Claude (LLM-as-judge) comparing the artifact against source evidence.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
          {[
            { label: 'Relevance', threshold: '60%' },
            { label: 'Evidence', threshold: '50%' },
            { label: 'Hallucination', threshold: '40%' },
            { label: 'Actionability', threshold: '50%' },
            { label: 'Freshness', threshold: '40%' },
          ].map(({ label, threshold }) => (
            <div key={label} className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="font-semibold text-gray-900">{threshold}</div>
              <div className="text-xs text-gray-500">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
