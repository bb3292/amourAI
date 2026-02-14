import { useEffect, useState } from 'react';
import {
  FileText, Plus, Loader2, ChevronDown, ChevronUp,
  Shield, Sword, Eye as EyeIcon, AlertTriangle, TrendingUp,
  Lightbulb, BarChart3, Download,
} from 'lucide-react';
import { api } from '../api/client';
import type { Competitor, Report, ReportData } from '../types';
import CompetitorLogo, { CompetitorLogoInline } from '../components/CompetitorLogo';
import { SeverityMeter } from '../components/ScoreBar';
import EmptyState from '../components/EmptyState';

export default function Reports() {
  const [reports, setReports] = useState<Report[]>([]);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedCompetitor, setSelectedCompetitor] = useState<number>(0);
  const [expandedReport, setExpandedReport] = useState<number | null>(null);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([
      api.listReports(),
      api.listCompetitors().catch(() => []),
    ]).then(([r, c]) => {
      setReports(r);
      setCompetitors(c);
      if (c.length > 0 && selectedCompetitor === 0) setSelectedCompetitor(c[0].id);
      setLoading(false);
    });
  };

  useEffect(load, []);

  const handleGenerate = async () => {
    if (!selectedCompetitor) return;
    setGenerating(true);
    setError('');
    try {
      await api.generateReport(selectedCompetitor);
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  };

  const parseReport = (content: string): ReportData | null => {
    try { return JSON.parse(content); } catch { return null; }
  };

  const getCompetitor = (id: number) => competitors.find(c => c.id === id);
  const competitorName = (id: number) => getCompetitor(id)?.name || `#${id}`;

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div className="skeleton h-8 w-48" />
          <div className="skeleton h-10 w-48 rounded-xl" />
        </div>
        <div className="space-y-4">
          {[1, 2].map(i => (
            <div key={i} className="card p-6">
              <div className="skeleton h-5 w-64 mb-3" />
              <div className="skeleton h-3 w-40" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Snapshot Reports</h1>
          <p className="text-zinc-500 text-sm mt-1">Competitive intelligence snapshots with SWOT analysis</p>
        </div>
        <div className="flex items-center gap-3">
          {competitors.length > 0 && (
            <select
              className="input w-auto min-w-[160px]"
              value={selectedCompetitor}
              onChange={e => setSelectedCompetitor(Number(e.target.value))}
            >
              {competitors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          <button
            onClick={handleGenerate}
            disabled={generating || competitors.length === 0}
            className="btn-primary flex items-center gap-2"
          >
            {generating
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
              : <><Plus className="w-4 h-4" /> Generate Report</>
            }
          </button>
        </div>
      </div>

      {error && <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm">{error}</div>}

      {reports.length === 0 ? (
        <EmptyState
          icon={<FileText className="w-8 h-8" />}
          title="No reports yet"
          description="Generate a competitive snapshot report from your ingested themes and insights."
        />
      ) : (
        <div className="space-y-4">
          {reports.map(report => {
            const data = parseReport(report.content);
            const expanded = expandedReport === report.id;
            const comp = getCompetitor(report.competitor_id);

            return (
              <div key={report.id} className="card overflow-hidden">
                <div
                  className="px-6 py-4 cursor-pointer hover:bg-white/[0.02] transition-colors flex items-center justify-between"
                  onClick={() => setExpandedReport(expanded ? null : report.id)}
                >
                  <div className="flex items-center gap-3">
                    {comp && <CompetitorLogo name={comp.name} url={comp.url} size="md" />}
                    <div>
                      <h3 className="font-semibold text-white">{report.title || 'Competitive Snapshot'}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-zinc-500">{competitorName(report.competitor_id)}</span>
                        <span className="text-zinc-700">·</span>
                        <span className="text-xs text-zinc-600 font-mono">
                          {new Date(report.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  {expanded ? <ChevronUp className="w-5 h-5 text-zinc-600" /> : <ChevronDown className="w-5 h-5 text-zinc-600" />}
                </div>

                {expanded && data && (
                  <div className="border-t border-white/[0.04] px-6 py-6 space-y-6 animate-fade-in bg-white/[0.01]">
                    {/* SWOT Grid */}
                    <div>
                      <h4 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-3">SWOT Analysis</h4>
                      <div className="grid grid-cols-2 gap-3">
                        {([
                          { key: 'strengths' as const, label: 'Strengths', bg: 'bg-emerald-500/5', border: 'border-emerald-500/15', text: 'text-emerald-400', icon: TrendingUp },
                          { key: 'weaknesses' as const, label: 'Weaknesses', bg: 'bg-red-500/5', border: 'border-red-500/15', text: 'text-red-400', icon: AlertTriangle },
                          { key: 'opportunities' as const, label: 'Opportunities', bg: 'bg-sky-500/5', border: 'border-sky-500/15', text: 'text-sky-400', icon: EyeIcon },
                          { key: 'threats' as const, label: 'Threats', bg: 'bg-amber-500/5', border: 'border-amber-500/15', text: 'text-amber-400', icon: Shield },
                        ]).map(({ key, label, bg, border, text, icon: Icon }) => (
                          <div key={key} className={`p-4 rounded-xl ${bg} border ${border}`}>
                            <div className="flex items-center gap-2 mb-2.5">
                              <Icon className={`w-4 h-4 ${text}`} />
                              <h5 className={`text-[10px] font-bold uppercase tracking-wider ${text}`}>{label}</h5>
                            </div>
                            <ul className="space-y-1.5">
                              {data.swot[key].map((item, i) => (
                                <li key={i} className="text-sm text-zinc-400 flex items-start gap-2">
                                  <span className={`w-1 h-1 rounded-full mt-2 flex-shrink-0 ${text.replace('text-', 'bg-')}`} />
                                  {item}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Positioning */}
                    <div className="bg-gradient-to-r from-brand-500/8 to-purple-500/8 border border-brand-500/15 p-5 rounded-xl">
                      <div className="flex items-center gap-2 mb-2">
                        <Lightbulb className="w-4 h-4 text-brand-400" />
                        <h4 className="text-xs font-semibold text-brand-300">Positioning Angle</h4>
                      </div>
                      <p className="text-sm text-brand-200/80 leading-relaxed">{data.positioning_angle}</p>
                    </div>

                    {/* Top Weaknesses */}
                    <div>
                      <h4 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-3">Ranked Weaknesses</h4>
                      <div className="space-y-2">
                        {data.top_weaknesses.map((w, i) => (
                          <div key={i} className="flex items-center gap-4 bg-white/[0.02] border border-white/[0.04] p-3.5 rounded-xl">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center font-bold text-sm font-mono">
                              {i + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1.5">
                                <h5 className="font-medium text-white text-sm">{w.name}</h5>
                                <span className="text-[10px] text-zinc-600 font-mono">{Math.round(w.severity * 100)}%</span>
                              </div>
                              <SeverityMeter value={w.severity} size="sm" />
                              <p className="text-xs text-zinc-500 mt-1.5">{w.evidence}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Recommended Actions */}
                    <div>
                      <h4 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-3">Recommended Actions</h4>
                      <div className="space-y-2">
                        {data.recommended_actions.map((a, i) => (
                          <div key={i} className="flex items-start gap-3 text-sm">
                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-500/10 text-brand-400 flex items-center justify-center font-semibold text-[11px] font-mono">
                              {i + 1}
                            </span>
                            <span className="text-zinc-400 leading-relaxed">{a}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Stats footer */}
                    <div className="flex items-center gap-6 pt-4 border-t border-white/[0.04] text-[10px] text-zinc-600 font-mono">
                      <span className="flex items-center gap-1"><BarChart3 className="w-3 h-3" /> {data.evidence_count} insights</span>
                      <span>{data.theme_count} themes</span>
                      <span>{Math.round(data.avg_confidence * 100)}% avg conf.</span>
                    </div>
                  </div>
                )}

                {expanded && !data && (
                  <div className="border-t border-white/[0.04] px-6 py-5 bg-white/[0.01]">
                    <pre className="text-sm text-zinc-500 whitespace-pre-wrap font-mono">{report.content}</pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
