import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Users, Globe, Layers, Zap, FileText, ArrowRight,
  AlertTriangle, TrendingUp, ChevronRight,
} from 'lucide-react';
import { api } from '../api/client';
import type { Competitor, Theme, Action } from '../types';
import CompetitorLogo from '../components/CompetitorLogo';
import ScoreBar from '../components/ScoreBar';

export default function Dashboard() {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [health, setHealth] = useState<{ status: string; mode: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      api.listCompetitors().catch(() => []),
      api.listThemes().catch(() => []),
      api.listActions().catch(() => []),
      api.health().catch(() => null),
    ]).then(([c, t, a, h]) => {
      setCompetitors(c);
      setThemes(t);
      setActions(a);
      setHealth(h);
      setLoading(false);
    });
  }, []);

  const weaknesses = themes.filter(t => t.is_weakness).sort((a, b) => b.severity_score - a.severity_score);

  // Group themes by competitor
  const themesByCompetitor = new Map<number, Theme[]>();
  for (const t of themes) {
    if (!themesByCompetitor.has(t.competitor_id)) themesByCompetitor.set(t.competitor_id, []);
    themesByCompetitor.get(t.competitor_id)!.push(t);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">
            Decision-Linked Competitive Research Copilot
            {health && (
              <span className={`ml-2 badge ${health.mode === 'live' ? 'badge-green' : 'badge-yellow'}`}>
                {health.mode === 'live' ? 'Live Mode' : health.mode}
              </span>
            )}
          </p>
        </div>
        <Link to="/competitors" className="btn-primary flex items-center gap-2 text-sm">
          <Users className="w-4 h-4" /> Manage Competitors
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Competitors', value: competitors.length, icon: Users, to: '/competitors', color: 'text-blue-600 bg-blue-50' },
          { label: 'Themes', value: themes.length, icon: Layers, to: '/themes', color: 'text-purple-600 bg-purple-50' },
          { label: 'Actions', value: actions.length, icon: Zap, to: '/actions', color: 'text-amber-600 bg-amber-50' },
          { label: 'Reports', value: 0, icon: FileText, to: '/reports', color: 'text-emerald-600 bg-emerald-50' },
        ].map(({ label, value, icon: Icon, to, color }) => (
          <Link key={label} to={to} className="card p-5 hover:shadow-md transition-shadow group">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
            </div>
            <div className="text-2xl font-bold text-gray-900">{value}</div>
            <div className="text-sm text-gray-500">{label}</div>
          </Link>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════
         COMPETITOR SUMMARY CARDS (grouped by business)
         ═══════════════════════════════════════════════════════ */}
      {competitors.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Intelligence by Business</h2>
            <Link to="/competitors" className="text-sm text-brand-600 hover:text-brand-700 flex items-center gap-1">
              View all <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
            {competitors.map(comp => {
              const compThemes = themesByCompetitor.get(comp.id) || [];
              const compWeaknesses = compThemes.filter(t => t.is_weakness).sort((a, b) => b.severity_score - a.severity_score);
              const compStrengths = compThemes.filter(t => !t.is_weakness);

              return (
                <div
                  key={comp.id}
                  onClick={() => navigate('/competitors')}
                  className="card overflow-hidden hover:shadow-lg hover:border-brand-200 transition-all cursor-pointer group"
                >
                  {/* Card header */}
                  <div className="p-4 flex items-center gap-3 border-b border-gray-100">
                    <CompetitorLogo name={comp.name} url={comp.url} size="lg" />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 group-hover:text-brand-700 transition-colors truncate">
                        {comp.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        {comp.sector && <span className="badge badge-blue text-[10px]">{comp.sector}</span>}
                        {comp.url && (
                          <span className="text-[10px] text-gray-400 truncate">
                            {comp.url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-brand-500 transition-colors flex-shrink-0" />
                  </div>

                  {/* Stat pills */}
                  <div className="px-4 py-2.5 flex items-center gap-3 text-[11px] text-gray-500 bg-gray-50/50">
                    <span className="flex items-center gap-1"><Globe className="w-3 h-3" /> {comp.source_count} sources</span>
                    <span className="flex items-center gap-1"><Layers className="w-3 h-3" /> {comp.theme_count} themes</span>
                    <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> {comp.action_count} actions</span>
                    {compWeaknesses.length > 0 && (
                      <span className="flex items-center gap-1 text-red-600 font-medium ml-auto">
                        <AlertTriangle className="w-3 h-3" /> {compWeaknesses.length} weaknesses
                      </span>
                    )}
                  </div>

                  {/* Top weaknesses & strengths */}
                  <div className="p-4 space-y-2">
                    {compThemes.length === 0 ? (
                      <p className="text-xs text-gray-400 italic py-2 text-center">
                        No data yet. Ingest sources to begin.
                      </p>
                    ) : (
                      <>
                        {compWeaknesses.slice(0, 3).map(w => (
                          <div key={w.id} className="flex items-start gap-2">
                            <AlertTriangle className="w-3.5 h-3.5 text-red-400 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-gray-800 truncate">{w.name}</p>
                              <div className="mt-0.5 max-w-[160px]">
                                <ScoreBar value={w.severity_score} label="" showValue={false} />
                              </div>
                            </div>
                            <span className="text-[10px] text-gray-400 flex-shrink-0">{Math.round(w.severity_score * 100)}%</span>
                          </div>
                        ))}
                        {compStrengths.slice(0, 2).map(s => (
                          <div key={s.id} className="flex items-start gap-2">
                            <TrendingUp className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
                            <p className="text-xs text-gray-600 truncate flex-1">{s.name}</p>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Top Weaknesses (across all competitors) – full width */}
      <div className="card">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Top Weaknesses (All Competitors)</h2>
          <Link to="/themes" className="text-sm text-brand-600 hover:text-brand-700">View all</Link>
        </div>
        <div className="divide-y divide-gray-50">
          {weaknesses.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-gray-400">
              No weaknesses identified yet. Add competitors and ingest sources to begin.
            </div>
          ) : (
            weaknesses.slice(0, 5).map(w => {
              const comp = competitors.find(c => c.id === w.competitor_id);
              return (
                <div key={w.id} className="px-5 py-3 flex items-center gap-3">
                  {comp && <CompetitorLogo name={comp.name} url={comp.url} size="sm" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm text-gray-900 truncate">{w.name}</span>
                      <span className="text-xs text-gray-400 flex-shrink-0 ml-2">{w.frequency} mentions</span>
                    </div>
                    <ScoreBar value={w.severity_score} label="Severity" />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Getting Started */}
      {competitors.length === 0 && (
        <div className="card p-8 text-center bg-gradient-to-br from-brand-50 to-white border-brand-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Get Started with DL-CRC</h3>
          <p className="text-sm text-gray-600 mb-6 max-w-lg mx-auto">
            Add your first competitor, paste in source URLs or text, and let the AI pipeline
            extract insights, identify weaknesses, and generate actionable artifacts.
          </p>
          <Link to="/competitors" className="btn-primary inline-flex items-center gap-2">
            <Users className="w-4 h-4" /> Add Your First Competitor
          </Link>
        </div>
      )}
    </div>
  );
}
