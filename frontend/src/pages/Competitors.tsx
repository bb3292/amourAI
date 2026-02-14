import { useEffect, useState } from 'react';
import {
  Users, Plus, Trash2, Globe, Layers, Zap, Eye,
  AlertTriangle, TrendingUp, ExternalLink, FileText,
  MessageSquareQuote, ChevronRight, Loader2,
} from 'lucide-react';
import { api } from '../api/client';
import type { Competitor, CompetitorCreate, Theme, Insight, Source } from '../types';
import Modal from '../components/Modal';
import CompetitorLogo from '../components/CompetitorLogo';
import SentimentBadge from '../components/SentimentBadge';
import ScoreBar from '../components/ScoreBar';
import EmptyState from '../components/EmptyState';

type SummaryTab = 'overview' | 'themes' | 'insights' | 'sources';

export default function Competitors() {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<CompetitorCreate>({ name: '', url: '', sector: '', description: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Summary modal state
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
    } catch {
      // continue with empty data
    } finally {
      setSummaryLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Competitors</h1>
          <p className="text-gray-500 text-sm mt-1">Track and analyze your competitive landscape</p>
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
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {competitors.map(comp => (
            <div
              key={comp.id}
              onClick={() => openSummary(comp)}
              className="card p-5 hover:shadow-lg hover:border-brand-200 transition-all cursor-pointer group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <CompetitorLogo name={comp.name} url={comp.url} size="lg" />
                  <div>
                    <h3 className="font-semibold text-gray-900 group-hover:text-brand-700 transition-colors">
                      {comp.name}
                    </h3>
                    {comp.sector && <span className="badge badge-blue mt-1">{comp.sector}</span>}
                  </div>
                </div>
                <button
                  onClick={(e) => handleDelete(comp.id, e)}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
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
                  className="text-xs text-brand-500 hover:underline truncate block mb-3 flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3 flex-shrink-0" />
                  {comp.url.replace(/^https?:\/\/(www\.)?/, '')}
                </a>
              )}

              {comp.description && (
                <p className="text-xs text-gray-500 mb-3 line-clamp-2">{comp.description}</p>
              )}

              <div className="flex items-center gap-4 text-xs text-gray-500 pt-3 border-t border-gray-100">
                <span className="flex items-center gap-1"><Globe className="w-3.5 h-3.5" /> {comp.source_count} sources</span>
                <span className="flex items-center gap-1"><Layers className="w-3.5 h-3.5" /> {comp.theme_count} themes</span>
                <span className="flex items-center gap-1"><Zap className="w-3.5 h-3.5" /> {comp.action_count} actions</span>
              </div>

              {/* Quick "View" indicator */}
              <div className="flex items-center justify-end mt-3 text-xs text-gray-300 group-hover:text-brand-500 transition-colors">
                <Eye className="w-3.5 h-3.5 mr-1" /> View Summary
                <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
         COMPETITOR SUMMARY MODAL
         ════════════════════════════════════════════════════════════ */}
      <Modal
        open={!!selectedComp}
        onClose={() => setSelectedComp(null)}
        title=""
        wide
      >
        {selectedComp && (
          <div className="space-y-5 -mt-2">
            {/* Header with logo */}
            <div className="flex items-center gap-4">
              <CompetitorLogo name={selectedComp.name} url={selectedComp.url} size="xl" />
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold text-gray-900">{selectedComp.name}</h2>
                {selectedComp.sector && <span className="badge badge-blue mt-1">{selectedComp.sector}</span>}
                {selectedComp.url && (
                  <a
                    href={selectedComp.url}
                    target="_blank"
                    rel="noopener"
                    className="text-xs text-brand-500 hover:underline mt-1 flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    {selectedComp.url.replace(/^https?:\/\/(www\.)?/, '')}
                  </a>
                )}
                {selectedComp.description && (
                  <p className="text-sm text-gray-500 mt-2">{selectedComp.description}</p>
                )}
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Sources', value: selectedComp.source_count, icon: Globe, color: 'text-blue-600 bg-blue-50' },
                { label: 'Themes', value: selectedComp.theme_count, icon: Layers, color: 'text-purple-600 bg-purple-50' },
                { label: 'Actions', value: selectedComp.action_count, icon: Zap, color: 'text-amber-600 bg-amber-50' },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="bg-gray-50 rounded-xl p-3 text-center">
                  <div className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center mx-auto mb-1.5`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="text-xl font-bold text-gray-900">{value}</div>
                  <div className="text-xs text-gray-500">{label}</div>
                </div>
              ))}
            </div>

            {/* Tab bar */}
            <div className="flex bg-gray-50 rounded-lg p-1 gap-1">
              {([
                { key: 'overview' as SummaryTab, label: 'Overview' },
                { key: 'themes' as SummaryTab, label: `Themes (${summaryThemes.length})` },
                { key: 'insights' as SummaryTab, label: `Insights (${summaryInsights.length})` },
                { key: 'sources' as SummaryTab, label: `Sources (${summarySources.length})` },
              ]).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setSummaryTab(key)}
                  className={`flex-1 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                    summaryTab === key
                      ? 'bg-white text-brand-700 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            {summaryLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-brand-600 mr-2" />
                <span className="text-sm text-gray-500">Loading data...</span>
              </div>
            ) : (
              <div className="max-h-[50vh] overflow-y-auto rounded-lg border border-gray-200">
                {summaryTab === 'overview' && (
                  <SummaryOverview
                    themes={summaryThemes}
                    insights={summaryInsights}
                    sources={summarySources}
                    competitorName={selectedComp.name}
                  />
                )}
                {summaryTab === 'themes' && <SummaryThemes themes={summaryThemes} />}
                {summaryTab === 'insights' && <SummaryInsights insights={summaryInsights} />}
                {summaryTab === 'sources' && <SummarySources sources={summarySources} />}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Add Competitor Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Competitor">
        <div className="space-y-4">
          {error && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}

          <div>
            <label className="label">Name *</label>
            <input
              className="input"
              placeholder="e.g. Acme Corp"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Website URL</label>
            <input
              className="input"
              placeholder="https://acme.com"
              value={form.url || ''}
              onChange={e => setForm({ ...form, url: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Sector / Industry</label>
            <input
              className="input"
              placeholder="e.g. SaaS, DevTools, FinTech"
              value={form.sector || ''}
              onChange={e => setForm({ ...form, sector: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea
              className="input min-h-[80px]"
              placeholder="Brief description of this competitor..."
              value={form.description || ''}
              onChange={e => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowAdd(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleCreate} disabled={submitting} className="btn-primary">
              {submitting ? 'Creating...' : 'Add Competitor'}
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

function SummaryOverview({
  themes, insights, sources, competitorName,
}: {
  themes: Theme[];
  insights: Insight[];
  sources: Source[];
  competitorName: string;
}) {
  const weaknesses = themes.filter(t => t.is_weakness).sort((a, b) => b.severity_score - a.severity_score);
  const strengths = themes.filter(t => !t.is_weakness);
  const negInsights = insights.filter(i => i.sentiment === 'negative');
  const posInsights = insights.filter(i => i.sentiment === 'positive');
  const avgConfidence = insights.length > 0
    ? insights.reduce((s, i) => s + i.confidence, 0) / insights.length
    : 0;

  if (themes.length === 0 && insights.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-gray-400">No data yet. Ingest sources to populate intelligence for {competitorName}.</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-5">
      {/* Sentiment breakdown */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Weaknesses', value: weaknesses.length, color: 'text-red-600 bg-red-50' },
          { label: 'Strengths', value: strengths.length, color: 'text-emerald-600 bg-emerald-50' },
          { label: 'Neg. Insights', value: negInsights.length, color: 'text-amber-600 bg-amber-50' },
          { label: 'Pos. Insights', value: posInsights.length, color: 'text-blue-600 bg-blue-50' },
        ].map(({ label, value, color }) => (
          <div key={label} className={`rounded-lg p-3 text-center ${color.split(' ')[1]}`}>
            <div className={`text-2xl font-bold ${color.split(' ')[0]}`}>{value}</div>
            <div className="text-[10px] font-medium text-gray-600 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Average confidence */}
      {insights.length > 0 && (
        <div className="max-w-xs">
          <ScoreBar value={avgConfidence} label="Avg. Insight Confidence" />
        </div>
      )}

      {/* Top weaknesses */}
      {weaknesses.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Top Weaknesses</h4>
          <div className="space-y-2">
            {weaknesses.slice(0, 5).map(w => (
              <div key={w.id} className="flex items-start gap-2 bg-red-50/50 rounded-lg p-2.5">
                <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{w.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{w.description}</p>
                  <div className="mt-1.5 max-w-[200px]">
                    <ScoreBar value={w.severity_score} label="Severity" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top strengths */}
      {strengths.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Strengths to Counter</h4>
          <div className="space-y-2">
            {strengths.slice(0, 3).map(s => (
              <div key={s.id} className="flex items-start gap-2 bg-emerald-50/50 rounded-lg p-2.5">
                <TrendingUp className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{s.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{s.description}</p>
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
  if (themes.length === 0) {
    return <p className="p-6 text-sm text-gray-400 text-center italic">No themes yet.</p>;
  }
  return (
    <div className="divide-y divide-gray-100">
      {themes.map(theme => (
        <div key={theme.id} className="px-4 py-3 hover:bg-gray-50/50">
          <div className="flex items-center gap-2">
            {theme.is_weakness
              ? <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
              : <TrendingUp className="w-4 h-4 text-emerald-500 flex-shrink-0" />
            }
            <h4 className="text-sm font-semibold text-gray-900 flex-1">{theme.name}</h4>
            {theme.is_weakness && <span className="badge badge-red text-[10px]">Weakness</span>}
            <SentimentBadge sentiment={theme.sentiment} />
          </div>
          {theme.description && (
            <p className="text-xs text-gray-600 mt-1 ml-6 leading-relaxed">{theme.description}</p>
          )}
          <div className="flex items-center gap-4 mt-2 ml-6">
            <div className="w-28">
              <ScoreBar value={theme.severity_score} label="Severity" />
            </div>
            <span className="text-xs text-gray-400">{theme.frequency} mentions</span>
            <span className="text-xs text-gray-400">{theme.insight_count} insights</span>
          </div>
          {theme.differentiation_move && (
            <div className="mt-2 ml-6 p-2 bg-brand-50 rounded text-xs text-brand-700">
              <strong>Move:</strong> {theme.differentiation_move}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function SummaryInsights({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) {
    return <p className="p-6 text-sm text-gray-400 text-center italic">No insights yet.</p>;
  }
  return (
    <div className="divide-y divide-gray-100">
      {insights.map(ins => (
        <div key={ins.id} className="px-4 py-3 hover:bg-gray-50/50">
          <p className="text-sm text-gray-800">{ins.text}</p>
          {ins.quote && (
            <blockquote className="mt-1.5 pl-3 border-l-2 border-brand-300 text-xs text-gray-500 italic">
              "{ins.quote}"
            </blockquote>
          )}
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <SentimentBadge sentiment={ins.sentiment} score={ins.sentiment_score} />
            {ins.persona && (
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <Users className="w-3 h-3" /> {ins.persona}
              </span>
            )}
            <span className="text-xs text-gray-400">
              Confidence: {Math.round(ins.confidence * 100)}%
            </span>
            {ins.source_url && ins.source_url !== 'internet_research' && (
              <a href={ins.source_url} target="_blank" rel="noopener" className="text-xs text-brand-500 hover:underline flex items-center gap-1">
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
  if (sources.length === 0) {
    return <p className="p-6 text-sm text-gray-400 text-center italic">No sources yet.</p>;
  }
  return (
    <div className="divide-y divide-gray-100">
      {sources.map(s => (
        <div key={s.id}>
          <div
            className="px-4 py-3 hover:bg-gray-50/50 cursor-pointer flex items-center justify-between"
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
              <span className="text-sm text-gray-700 truncate">
                {s.url || (s.source_type === 'pdf' ? 'PDF Upload' : s.source_type.startsWith('research') ? 'Web Research' : 'Manual')}
              </span>
            </div>
            {s.raw_content && (
              <span className="text-[10px] text-gray-400 ml-2">{s.raw_content.length.toLocaleString()} chars</span>
            )}
          </div>
          {expanded === s.id && s.raw_content && (
            <div className="px-4 pb-3">
              <pre className="text-[11px] text-gray-600 whitespace-pre-wrap font-mono bg-gray-50 rounded-lg p-3 max-h-48 overflow-y-auto">
                {s.raw_content}
              </pre>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
