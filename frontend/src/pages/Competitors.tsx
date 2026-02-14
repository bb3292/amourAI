import { useEffect, useState } from 'react';
import {
  Users, Plus, Trash2, Globe, Layers, Zap, Eye,
  AlertTriangle, TrendingUp, ExternalLink, FileText,
  ChevronRight, Loader2, X,
} from 'lucide-react';
import { api } from '../api/client';
import type { Competitor, CompetitorCreate, Theme, Insight, Source } from '../types';
import Modal from '../components/Modal';
import CompetitorLogo from '../components/CompetitorLogo';
import SentimentBadge from '../components/SentimentBadge';
import ScoreBar, { SeverityMeter } from '../components/ScoreBar';
import EmptyState from '../components/EmptyState';

type SummaryTab = 'overview' | 'themes' | 'insights' | 'sources';

export default function Competitors() {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<CompetitorCreate>({ name: '', url: '', sector: '', description: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Drawer state
  const [selectedComp, setSelectedComp] = useState<Competitor | null>(null);
  const [summaryTab, setSummaryTab] = useState<SummaryTab>('overview');
  const [summaryThemes, setSummaryThemes] = useState<Theme[]>([]);
  const [summaryInsights, setSummaryInsights] = useState<Insight[]>([]);
  const [summarySources, setSummarySources] = useState<Source[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const load = () => {
    setLoading(true);
    api.listCompetitors().then(setCompetitors).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleCreate = async () => {
    if (!form.name.trim()) { setError('Name is required'); return; }
    setSubmitting(true);
    setError('');
    try {
      await api.createCompetitor(form);
      setForm({ name: '', url: '', sector: '', description: '' });
      setShowAdd(false);
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this competitor and all its data?')) return;
    await api.deleteCompetitor(id);
    load();
  };

  const openSummary = async (comp: Competitor) => {
    setSelectedComp(comp);
    setSummaryTab('overview');
    setSummaryLoading(true);
    try {
      const [themes, insights, sources] = await Promise.all([
        api.listThemes(comp.id).catch(() => []),
        api.listInsights(comp.id).catch(() => []),
        api.listSources(comp.id).catch(() => []),
      ]);
      setSummaryThemes(themes);
      setSummaryInsights(insights);
      setSummarySources(sources);
    } catch { /* continue */ }
    finally { setSummaryLoading(false); }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div className="skeleton h-8 w-48" />
          <div className="skeleton h-10 w-40 rounded-xl" />
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="card p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="skeleton w-12 h-12 rounded-xl" />
                <div>
                  <div className="skeleton h-4 w-28 mb-2" />
                  <div className="skeleton h-3 w-16" />
                </div>
              </div>
              <div className="skeleton h-3 w-full mb-2" />
              <div className="skeleton h-3 w-2/3" />
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
          <h1 className="text-2xl font-bold text-white tracking-tight">Competitors</h1>
          <p className="text-zinc-500 text-sm mt-1">Track and analyze your competitive landscape</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Competitor
        </button>
      </div>

      {competitors.length === 0 ? (
        <EmptyState
          icon={<Users className="w-8 h-8" />}
          title="No competitors yet"
          description="Add your first competitor to start tracking their weaknesses and generating competitive intelligence."
          action={
            <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add Competitor
            </button>
          }
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {competitors.map(comp => (
            <div
              key={comp.id}
              onClick={() => openSummary(comp)}
              className="card-hover group p-5"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <CompetitorLogo name={comp.name} url={comp.url} size="lg" />
                  <div>
                    <h3 className="font-semibold text-white group-hover:text-brand-400 transition-colors">
                      {comp.name}
                    </h3>
                    {comp.sector && <span className="badge badge-indigo mt-1 text-[10px] py-0.5">{comp.sector}</span>}
                  </div>
                </div>
                <button
                  onClick={(e) => handleDelete(comp.id, e)}
                  className="p-1.5 rounded-lg hover:bg-red-500/10 text-zinc-700 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {comp.url && (
                <a
                  href={comp.url}
                  target="_blank"
                  rel="noopener"
                  onClick={e => e.stopPropagation()}
                  className="text-xs text-brand-400/60 hover:text-brand-400 truncate block mb-3 flex items-center gap-1 transition-colors"
                >
                  <ExternalLink className="w-3 h-3 flex-shrink-0" />
                  {comp.url.replace(/^https?:\/\/(www\.)?/, '')}
                </a>
              )}

              {comp.description && (
                <p className="text-xs text-zinc-500 mb-3 line-clamp-2 leading-relaxed">{comp.description}</p>
              )}

              <div className="flex items-center gap-4 text-[11px] text-zinc-600 pt-3 border-t border-white/[0.04]">
                <span className="flex items-center gap-1"><Globe className="w-3 h-3" /> {comp.source_count}</span>
                <span className="flex items-center gap-1"><Layers className="w-3 h-3" /> {comp.theme_count}</span>
                <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> {comp.action_count}</span>
              </div>

              <div className="flex items-center justify-end mt-3 text-[11px] text-zinc-700 group-hover:text-brand-400 transition-colors">
                <Eye className="w-3 h-3 mr-1" /> View Summary
                <ChevronRight className="w-3 h-3 ml-0.5" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ═══ SUMMARY DRAWER ═══ */}
      {selectedComp && (
        <div className="fixed inset-0 z-50 flex justify-end animate-fade-in">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedComp(null)} />
          <div className="relative w-full max-w-2xl bg-elevated border-l border-white/[0.06] shadow-2xl overflow-y-auto animate-slide-in">
            {/* Drawer header */}
            <div className="sticky top-0 z-10 bg-elevated/90 backdrop-blur-xl border-b border-white/[0.06] px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <CompetitorLogo name={selectedComp.name} url={selectedComp.url} size="xl" />
                  <div>
                    <h2 className="text-lg font-bold text-white">{selectedComp.name}</h2>
                    <div className="flex items-center gap-2 mt-1">
                      {selectedComp.sector && <span className="badge badge-indigo text-[10px]">{selectedComp.sector}</span>}
                      {selectedComp.url && (
                        <a href={selectedComp.url} target="_blank" rel="noopener" className="text-[11px] text-brand-400/60 hover:text-brand-400 flex items-center gap-1">
                          <ExternalLink className="w-3 h-3" /> {selectedComp.url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}
                        </a>
                      )}
                    </div>
                  </div>
                </div>
                <button onClick={() => setSelectedComp(null)} className="btn-icon">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* KPI row */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Sources', value: selectedComp.source_count, icon: Globe, color: 'text-sky-400' },
                  { label: 'Themes', value: selectedComp.theme_count, icon: Layers, color: 'text-purple-400' },
                  { label: 'Actions', value: selectedComp.action_count, icon: Zap, color: 'text-amber-400' },
                ].map(({ label, value, icon: Icon, color }) => (
                  <div key={label} className="bg-white/[0.03] rounded-xl p-3 text-center border border-white/[0.04]">
                    <Icon className={`w-4 h-4 ${color} mx-auto mb-1.5`} />
                    <div className="text-xl font-bold text-white font-mono">{value}</div>
                    <div className="text-[10px] text-zinc-500 mt-0.5">{label}</div>
                  </div>
                ))}
              </div>

              {/* Tab bar */}
              <div className="flex bg-white/[0.03] rounded-xl p-1 gap-1 border border-white/[0.04]">
                {([
                  { key: 'overview' as SummaryTab, label: 'Overview' },
                  { key: 'themes' as SummaryTab, label: `Themes (${summaryThemes.length})` },
                  { key: 'insights' as SummaryTab, label: `Insights (${summaryInsights.length})` },
                  { key: 'sources' as SummaryTab, label: `Sources (${summarySources.length})` },
                ]).map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setSummaryTab(key)}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      summaryTab === key
                        ? 'bg-white/[0.08] text-white shadow-sm'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              {summaryLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin text-brand-400 mr-2" />
                  <span className="text-sm text-zinc-500">Loading data...</span>
                </div>
              ) : (
                <div className="rounded-xl border border-white/[0.06] overflow-hidden">
                  {summaryTab === 'overview' && (
                    <SummaryOverview themes={summaryThemes} insights={summaryInsights} sources={summarySources} competitorName={selectedComp.name} />
                  )}
                  {summaryTab === 'themes' && <SummaryThemes themes={summaryThemes} />}
                  {summaryTab === 'insights' && <SummaryInsights insights={summaryInsights} />}
                  {summaryTab === 'sources' && <SummarySources sources={summarySources} />}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ Add Competitor Modal ═══ */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Competitor">
        <div className="space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm">
              {error}
            </div>
          )}
          <div>
            <label className="label">Name *</label>
            <input className="input" placeholder="e.g. Acme Corp" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Website URL</label>
            <input className="input" placeholder="https://acme.com" value={form.url || ''} onChange={e => setForm({ ...form, url: e.target.value })} />
          </div>
          <div>
            <label className="label">Sector / Industry</label>
            <input className="input" placeholder="e.g. SaaS, DevTools, FinTech" value={form.sector || ''} onChange={e => setForm({ ...form, sector: e.target.value })} />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input min-h-[80px]" placeholder="Brief description of this competitor..." value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowAdd(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleCreate} disabled={submitting} className="btn-primary flex items-center gap-2">
              {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</> : 'Add Competitor'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}


/* ════════════════════════════════════════════════════════════════
   SUMMARY TAB CONTENT COMPONENTS
   ════════════════════════════════════════════════════════════════ */

function SummaryOverview({ themes, insights, sources, competitorName }: {
  themes: Theme[]; insights: Insight[]; sources: Source[]; competitorName: string;
}) {
  const weaknesses = themes.filter(t => t.is_weakness).sort((a, b) => b.severity_score - a.severity_score);
  const strengths = themes.filter(t => !t.is_weakness);
  const negInsights = insights.filter(i => i.sentiment === 'negative');
  const posInsights = insights.filter(i => i.sentiment === 'positive');
  const avgConfidence = insights.length > 0 ? insights.reduce((s, i) => s + i.confidence, 0) / insights.length : 0;

  if (themes.length === 0 && insights.length === 0) {
    return (
      <div className="p-10 text-center">
        <p className="text-sm text-zinc-600">No data yet. Ingest sources to populate intelligence for {competitorName}.</p>
      </div>
    );
  }

  return (
    <div className="p-5 space-y-5">
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Weaknesses', value: weaknesses.length, color: 'text-red-400 bg-red-500/8' },
          { label: 'Strengths', value: strengths.length, color: 'text-emerald-400 bg-emerald-500/8' },
          { label: 'Neg. Insights', value: negInsights.length, color: 'text-amber-400 bg-amber-500/8' },
          { label: 'Pos. Insights', value: posInsights.length, color: 'text-sky-400 bg-sky-500/8' },
        ].map(({ label, value, color }) => (
          <div key={label} className={`rounded-xl p-3 text-center ${color.split(' ')[1]}`}>
            <div className={`text-2xl font-bold font-mono ${color.split(' ')[0]}`}>{value}</div>
            <div className="text-[10px] text-zinc-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {insights.length > 0 && (
        <div className="max-w-xs">
          <ScoreBar value={avgConfidence} label="Avg. Insight Confidence" />
        </div>
      )}

      {weaknesses.length > 0 && (
        <div>
          <h4 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-3">Top Weaknesses</h4>
          <div className="space-y-2">
            {weaknesses.slice(0, 5).map(w => (
              <div key={w.id} className="flex items-start gap-2.5 bg-red-500/5 rounded-xl p-3 border border-red-500/10">
                <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">{w.name}</p>
                  <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{w.description}</p>
                  <div className="mt-2 max-w-[200px]">
                    <SeverityMeter value={w.severity_score} size="sm" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {strengths.length > 0 && (
        <div>
          <h4 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-3">Strengths to Counter</h4>
          <div className="space-y-2">
            {strengths.slice(0, 3).map(s => (
              <div key={s.id} className="flex items-start gap-2.5 bg-emerald-500/5 rounded-xl p-3 border border-emerald-500/10">
                <TrendingUp className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">{s.name}</p>
                  <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{s.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryThemes({ themes }: { themes: Theme[] }) {
  if (themes.length === 0) return <p className="p-8 text-sm text-zinc-600 text-center">No themes yet.</p>;
  return (
    <div className="divide-y divide-white/[0.04]">
      {themes.map(theme => (
        <div key={theme.id} className="px-4 py-3.5 hover:bg-white/[0.02] transition-colors">
          <div className="flex items-center gap-2">
            {theme.is_weakness
              ? <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
              : <TrendingUp className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            }
            <h4 className="text-sm font-semibold text-white flex-1">{theme.name}</h4>
            {theme.is_weakness && <span className="badge badge-red text-[10px]">Weakness</span>}
            <SentimentBadge sentiment={theme.sentiment} />
          </div>
          {theme.description && (
            <p className="text-xs text-zinc-500 mt-1.5 ml-6 leading-relaxed">{theme.description}</p>
          )}
          <div className="flex items-center gap-4 mt-2.5 ml-6">
            <div className="w-28">
              <SeverityMeter value={theme.severity_score} size="sm" />
            </div>
            <span className="text-[10px] text-zinc-600 font-mono">{theme.frequency} mentions</span>
            <span className="text-[10px] text-zinc-600 font-mono">{theme.insight_count} insights</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function SummaryInsights({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) return <p className="p-8 text-sm text-zinc-600 text-center">No insights yet.</p>;
  return (
    <div className="divide-y divide-white/[0.04]">
      {insights.map(ins => (
        <div key={ins.id} className="px-4 py-3.5 hover:bg-white/[0.02] transition-colors">
          <p className="text-sm text-zinc-300">{ins.text}</p>
          {ins.quote && (
            <blockquote className="mt-2 pl-3 border-l-2 border-brand-500/30 text-xs text-zinc-500 italic">
              "{ins.quote}"
            </blockquote>
          )}
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <SentimentBadge sentiment={ins.sentiment} score={ins.sentiment_score} />
            {ins.persona && (
              <span className="text-[10px] text-zinc-600 flex items-center gap-1">
                <Users className="w-3 h-3" /> {ins.persona}
              </span>
            )}
            <span className="text-[10px] text-zinc-600 font-mono">
              {Math.round(ins.confidence * 100)}% conf.
            </span>
            {ins.source_url && ins.source_url !== 'internet_research' && (
              <a href={ins.source_url} target="_blank" rel="noopener" className="text-[10px] text-brand-400/60 hover:text-brand-400 flex items-center gap-1">
                <ExternalLink className="w-3 h-3" /> Source
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function SummarySources({ sources }: { sources: Source[] }) {
  const [expanded, setExpanded] = useState<number | null>(null);
  if (sources.length === 0) return <p className="p-8 text-sm text-zinc-600 text-center">No sources yet.</p>;
  return (
    <div className="divide-y divide-white/[0.04]">
      {sources.map(s => (
        <div key={s.id}>
          <div
            className="px-4 py-3 hover:bg-white/[0.02] cursor-pointer flex items-center justify-between transition-colors"
            onClick={() => setExpanded(expanded === s.id ? null : s.id)}
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className={`badge ${
                s.source_type === 'pdf' ? 'badge-red' :
                s.source_type.startsWith('research') ? 'badge-green' :
                'badge-purple'
              } text-[10px]`}>
                {s.source_type === 'pdf' ? 'PDF' : s.source_type.startsWith('research') ? 'Research' : s.source_type}
              </span>
              <span className="text-sm text-zinc-400 truncate">
                {s.url || (s.source_type === 'pdf' ? 'PDF Upload' : s.source_type.startsWith('research') ? 'Web Research' : 'Manual')}
              </span>
            </div>
            {s.raw_content && (
              <span className="text-[10px] text-zinc-600 font-mono ml-2">{s.raw_content.length.toLocaleString()} chars</span>
            )}
          </div>
          {expanded === s.id && s.raw_content && (
            <div className="px-4 pb-3">
              <pre className="text-[11px] text-zinc-500 whitespace-pre-wrap font-mono bg-white/[0.02] border border-white/[0.04] rounded-xl p-3 max-h-48 overflow-y-auto">
                {s.raw_content}
              </pre>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
