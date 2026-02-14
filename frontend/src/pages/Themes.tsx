import { useEffect, useState } from 'react';
import {
  Layers, AlertTriangle, TrendingUp, ChevronDown, ChevronUp,
  Zap, Lightbulb, Clock, Hash, Loader2,
} from 'lucide-react';
import { api } from '../api/client';
import type { Competitor, Theme, ActionCreate } from '../types';
import { CompetitorLogoInline } from '../components/CompetitorLogo';
import SentimentBadge from '../components/SentimentBadge';
import { SeverityMeter } from '../components/ScoreBar';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';

export default function Themes() {
  const [themes, setThemes] = useState<Theme[]>([]);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [filterCompetitor, setFilterCompetitor] = useState<number>(0);
  const [expandedTheme, setExpandedTheme] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const [showAction, setShowAction] = useState(false);
  const [actionTheme, setActionTheme] = useState<Theme | null>(null);
  const [actionType, setActionType] = useState('battlecard');
  const [actionOwner, setActionOwner] = useState('');
  const [creating, setCreating] = useState(false);
  const [actionResult, setActionResult] = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([
      api.listThemes(filterCompetitor || undefined),
      api.listCompetitors().catch(() => []),
    ]).then(([t, c]) => {
      setThemes(t);
      setCompetitors(c);
      setLoading(false);
    });
  };

  useEffect(load, [filterCompetitor]);

  const handleCreateAction = async () => {
    if (!actionTheme) return;
    setCreating(true);
    setActionResult('');
    try {
      await api.createAction({
        theme_id: actionTheme.id,
        competitor_id: actionTheme.competitor_id,
        action_type: actionType,
        owner: actionOwner || undefined,
      });
      setActionResult('Action created! Check the Actions page.');
      setTimeout(() => { setShowAction(false); setActionResult(''); }, 2000);
    } catch (e: any) {
      setActionResult(`Error: ${e.message}`);
    } finally {
      setCreating(false);
    }
  };

  const getCompetitor = (id: number) => competitors.find(c => c.id === id);

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div className="skeleton h-8 w-48" />
          <div className="skeleton h-10 w-40 rounded-xl" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="card p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="skeleton w-5 h-5 rounded" />
                <div className="skeleton h-4 w-48" />
              </div>
              <div className="skeleton h-1.5 w-full" />
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
          <h1 className="text-2xl font-bold text-white tracking-tight">Themes & Insights</h1>
          <p className="text-zinc-500 text-sm mt-1">Clustered intelligence with sentiment and evidence</p>
        </div>
        {competitors.length > 0 && (
          <select
            className="input w-auto min-w-[180px]"
            value={filterCompetitor}
            onChange={e => setFilterCompetitor(Number(e.target.value))}
          >
            <option value={0}>All Competitors</option>
            {competitors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
      </div>

      {themes.length === 0 ? (
        <EmptyState
          icon={<Layers className="w-8 h-8" />}
          title="No themes yet"
          description="Themes are generated automatically when you ingest sources. Go to Sources to add URLs or text."
        />
      ) : (
        <div className="space-y-3">
          {themes.map(theme => {
            const isExpanded = expandedTheme === theme.id;
            const comp = getCompetitor(theme.competitor_id);

            return (
              <div key={theme.id} className="card overflow-hidden group">
                {/* Theme header */}
                <div
                  className="px-5 py-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
                  onClick={() => setExpandedTheme(isExpanded ? null : theme.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        theme.is_weakness ? 'bg-red-500/10' : 'bg-emerald-500/10'
                      }`}>
                        {theme.is_weakness
                          ? <AlertTriangle className="w-4 h-4 text-red-400" />
                          : <TrendingUp className="w-4 h-4 text-emerald-400" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-white text-[15px]">{theme.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          {comp && (
                            <>
                              <CompetitorLogoInline name={comp.name} url={comp.url} />
                              <span className="text-[11px] text-zinc-500">{comp.name}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <SentimentBadge sentiment={theme.sentiment} />
                      <span className="text-[10px] text-zinc-600 font-mono flex items-center gap-1">
                        <Hash className="w-3 h-3" />{theme.frequency}
                      </span>
                      {isExpanded
                        ? <ChevronUp className="w-4 h-4 text-zinc-600" />
                        : <ChevronDown className="w-4 h-4 text-zinc-600" />
                      }
                    </div>
                  </div>

                  {theme.description && (
                    <p className="text-sm text-zinc-500 mt-2 ml-11 line-clamp-2">{theme.description}</p>
                  )}

                  <div className="mt-3 ml-11 max-w-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-zinc-600 w-14">Severity</span>
                      <div className="flex-1"><SeverityMeter value={theme.severity_score} size="sm" /></div>
                      <span className="text-[10px] font-mono text-zinc-600">{Math.round(theme.severity_score * 100)}%</span>
                    </div>
                  </div>
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t border-white/[0.04] px-5 py-5 bg-white/[0.01] animate-fade-in">
                    <div className="grid md:grid-cols-2 gap-6">
                      {/* Left: Insights */}
                      <div>
                        <h4 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-3">
                          Evidence ({theme.insight_count} insights)
                        </h4>
                        {theme.insights.length > 0 ? (
                          <div className="space-y-2.5">
                            {theme.insights.map(ins => (
                              <div key={ins.id} className="bg-white/[0.03] p-3 rounded-xl border border-white/[0.04]">
                                <p className="text-sm text-zinc-300 leading-relaxed">{ins.text}</p>
                                {ins.quote && (
                                  <blockquote className="mt-2 pl-3 border-l-2 border-brand-500/30 text-xs text-zinc-500 italic">
                                    "{ins.quote}"
                                  </blockquote>
                                )}
                                <div className="flex items-center gap-3 mt-2 text-[10px] text-zinc-600">
                                  <SentimentBadge sentiment={ins.sentiment} score={ins.sentiment_score} />
                                  {ins.persona && <span>{ins.persona}</span>}
                                  <span className="font-mono">{Math.round(ins.confidence * 100)}% conf.</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-zinc-600 italic">No linked insights</p>
                        )}
                      </div>

                      {/* Right: Actions */}
                      <div>
                        {theme.differentiation_move && (
                          <div className="bg-brand-500/8 border border-brand-500/15 p-4 rounded-xl mb-4">
                            <div className="flex items-center gap-2 mb-2">
                              <Lightbulb className="w-4 h-4 text-brand-400" />
                              <h4 className="text-xs font-semibold text-brand-300">Recommended Move</h4>
                            </div>
                            <p className="text-sm text-brand-200/80 leading-relaxed">{theme.differentiation_move}</p>
                          </div>
                        )}

                        <div className="flex items-center gap-4 text-[10px] text-zinc-600 mb-4">
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {theme.recency_days}d ago</span>
                          <span className="flex items-center gap-1"><Hash className="w-3 h-3" /> {theme.frequency} mentions</span>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActionTheme(theme);
                            setShowAction(true);
                            setActionResult('');
                          }}
                          className="btn-primary flex items-center gap-2 text-sm"
                        >
                          <Zap className="w-4 h-4" /> Create Action
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ═══ Create Action Modal ═══ */}
      <Modal open={showAction} onClose={() => setShowAction(false)} title="Create Action">
        <div className="space-y-4">
          {actionTheme && (
            <div className="p-3 bg-white/[0.03] rounded-xl border border-white/[0.04]">
              <p className="text-sm font-medium text-white">{actionTheme.name}</p>
              <p className="text-xs text-zinc-500 mt-1">{actionTheme.description}</p>
            </div>
          )}

          {actionResult && (
            <div className={`p-3 rounded-xl text-sm ${
              actionResult.startsWith('Error') ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
            }`}>
              {actionResult}
            </div>
          )}

          <div>
            <label className="label">Action Type</label>
            <select className="input" value={actionType} onChange={e => setActionType(e.target.value)}>
              <option value="battlecard">Battlecard Update</option>
              <option value="messaging">Messaging Draft</option>
              <option value="roadmap">Roadmap Ticket</option>
              <option value="ignore">Ignore</option>
            </select>
          </div>

          <div>
            <label className="label">Owner (optional)</label>
            <input className="input" placeholder="e.g. Sarah - PMM" value={actionOwner} onChange={e => setActionOwner(e.target.value)} />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowAction(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleCreateAction} disabled={creating} className="btn-primary flex items-center gap-2">
              {creating ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</> : <><Zap className="w-4 h-4" /> Create & Generate</>}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
