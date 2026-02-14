import { useEffect, useState } from 'react';
import { Layers, AlertTriangle, TrendingUp, ChevronDown, ChevronUp, Zap } from 'lucide-react';
import { api } from '../api/client';
import type { Competitor, Theme, ActionCreate } from '../types';
import { CompetitorLogoInline } from '../components/CompetitorLogo';
import SentimentBadge from '../components/SentimentBadge';
import ScoreBar from '../components/ScoreBar';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';

export default function Themes() {
  const [themes, setThemes] = useState<Theme[]>([]);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [filterCompetitor, setFilterCompetitor] = useState<number>(0);
  const [expandedTheme, setExpandedTheme] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Action creation
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
      setActionResult('Action created with artifact! Check the Actions page.');
      setTimeout(() => { setShowAction(false); setActionResult(''); }, 2000);
    } catch (e: any) {
      setActionResult(`Error: ${e.message}`);
    } finally {
      setCreating(false);
    }
  };

  const getCompetitor = (id: number) => competitors.find(c => c.id === id);
  const competitorName = (id: number) => getCompetitor(id)?.name || `#${id}`;

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
          <h1 className="text-2xl font-bold text-gray-900">Themes & Insights</h1>
          <p className="text-gray-500 text-sm mt-1">Clustered competitive intelligence with sentiment and evidence</p>
        </div>

        {competitors.length > 0 && (
          <select
            className="input w-auto"
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
          {themes.map(theme => (
            <div key={theme.id} className="card overflow-hidden">
              {/* Theme header */}
              <div
                className="px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setExpandedTheme(expandedTheme === theme.id ? null : theme.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {theme.is_weakness ? (
                      <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
                    ) : (
                      <TrendingUp className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900">{theme.name}</h3>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {(() => {
                          const comp = getCompetitor(theme.competitor_id);
                          return comp ? (
                            <>
                              <CompetitorLogoInline name={comp.name} url={comp.url} />
                              <span className="text-xs text-gray-500">{comp.name}</span>
                            </>
                          ) : (
                            <span className="text-xs text-gray-500">#{theme.competitor_id}</span>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <SentimentBadge sentiment={theme.sentiment} />
                    {theme.is_weakness && <span className="badge badge-red">Weakness</span>}
                    <span className="text-xs text-gray-400">{theme.frequency} mentions</span>
                    {expandedTheme === theme.id ? (
                      <ChevronUp className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </div>

                {theme.description && (
                  <p className="text-sm text-gray-600 mt-2 ml-8">{theme.description}</p>
                )}

                <div className="mt-3 ml-8 max-w-md">
                  <ScoreBar value={theme.severity_score} label="Severity" />
                </div>
              </div>

              {/* Expanded content */}
              {expandedTheme === theme.id && (
                <div className="border-t border-gray-100 px-5 py-4 bg-gray-50/50">
                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Left: Insights */}
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-3">
                        Supporting Insights ({theme.insight_count})
                      </h4>
                      {theme.insights.length > 0 ? (
                        <div className="space-y-3">
                          {theme.insights.map(ins => (
                            <div key={ins.id} className="bg-white p-3 rounded-lg border border-gray-200">
                              <p className="text-sm text-gray-800">{ins.text}</p>
                              {ins.quote && (
                                <blockquote className="mt-2 pl-3 border-l-2 border-brand-300 text-xs text-gray-500 italic">
                                  "{ins.quote}"
                                </blockquote>
                              )}
                              <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                                <SentimentBadge sentiment={ins.sentiment} score={ins.sentiment_score} />
                                {ins.persona && <span>{ins.persona}</span>}
                                <span>Confidence: {Math.round(ins.confidence * 100)}%</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-400 italic">No linked insights</p>
                      )}
                    </div>

                    {/* Right: Actions */}
                    <div>
                      {theme.differentiation_move && (
                        <div className="bg-brand-50 p-4 rounded-lg mb-4">
                          <h4 className="text-sm font-semibold text-brand-800 mb-1">Recommended Move</h4>
                          <p className="text-sm text-brand-700">{theme.differentiation_move}</p>
                        </div>
                      )}

                      <div className="flex items-center gap-2 text-xs text-gray-500 mb-4">
                        <span>Recency: {theme.recency_days} days</span>
                        <span>|</span>
                        <span>Frequency: {theme.frequency}</span>
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
          ))}
        </div>
      )}

      {/* Create Action Modal */}
      <Modal open={showAction} onClose={() => setShowAction(false)} title="Classify & Assign Action">
        <div className="space-y-4">
          {actionTheme && (
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-900">{actionTheme.name}</p>
              <p className="text-xs text-gray-500 mt-1">{actionTheme.description}</p>
            </div>
          )}

          {actionResult && (
            <div className={`p-3 rounded-lg text-sm ${
              actionResult.startsWith('Error') ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
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
            <input
              className="input"
              placeholder="e.g. Sarah - PMM"
              value={actionOwner}
              onChange={e => setActionOwner(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowAction(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleCreateAction} disabled={creating} className="btn-primary">
              {creating ? 'Generating artifact...' : 'Create & Generate'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
