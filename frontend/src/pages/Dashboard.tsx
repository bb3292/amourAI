import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Users, Globe, Layers, Zap, FileText, ArrowRight,
  AlertTriangle, TrendingUp, ChevronRight,
  Activity, Shield,
} from 'lucide-react';
import { api } from '../api/client';
import type { Competitor, Theme, Action } from '../types';
import CompetitorLogo from '../components/CompetitorLogo';
import { SeverityMeter } from '../components/ScoreBar';

type HealthInfo = {
  status: string;
  mode: string;
  integrations?: {
    blaxel: boolean;
    anthropic: boolean;
    whitecircle: boolean;
    lovable: boolean;
  };
};

export default function Dashboard() {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [health, setHealth] = useState<HealthInfo | null>(null);
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

  const themesByCompetitor = new Map<number, Theme[]>();
  for (const t of themes) {
    if (!themesByCompetitor.has(t.competitor_id)) themesByCompetitor.set(t.competitor_id, []);
    themesByCompetitor.get(t.competitor_id)!.push(t);
  }

  if (loading) {
    return (
      <div className="space-y-8 animate-fade-in">
        {/* Skeleton KPI row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="kpi-card">
              <div className="skeleton h-4 w-20 mb-3" />
              <div className="skeleton h-8 w-16 mb-1" />
              <div className="skeleton h-3 w-24" />
            </div>
          ))}
        </div>
        {/* Skeleton cards */}
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
          {[1, 2, 3].map(i => (
            <div key={i} className="card p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="skeleton w-12 h-12 rounded-xl" />
                <div>
                  <div className="skeleton h-4 w-32 mb-2" />
                  <div className="skeleton h-3 w-20" />
                </div>
              </div>
              <div className="skeleton h-1.5 w-full mb-3" />
              <div className="skeleton h-1.5 w-3/4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* ═══ Header ═══ */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Command Center</h1>
          <p className="text-zinc-500 mt-1 text-sm">
            Competitive intelligence overview
            {health && (
              <span className={`ml-2 badge ${health.mode === 'live' ? 'badge-green' : 'badge-yellow'}`}>
                <Activity className="w-3 h-3 mr-1" />
                {health.mode === 'live' ? 'Live' : health.mode}
              </span>
            )}
          </p>
        </div>
        <Link to="/sources" className="btn-primary flex items-center gap-2 text-sm">
          <Globe className="w-4 h-4" /> Run Research
        </Link>
      </div>

      {/* ═══ KPI Row ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Competitors Tracked', value: competitors.length, icon: Users, to: '/competitors', accent: 'from-brand-500/20 to-brand-500/5', iconColor: 'text-brand-400' },
          { label: 'Themes Detected', value: themes.length, icon: Layers, to: '/themes', accent: 'from-purple-500/20 to-purple-500/5', iconColor: 'text-purple-400' },
          { label: 'Actions Pending', value: actions.filter(a => a.status === 'pending').length, icon: Zap, to: '/actions', accent: 'from-amber-500/20 to-amber-500/5', iconColor: 'text-amber-400' },
          { label: 'Quality Score', value: '—', icon: Shield, to: '/monitoring', accent: 'from-emerald-500/20 to-emerald-500/5', iconColor: 'text-emerald-400' },
        ].map(({ label, value, icon: Icon, to, accent, iconColor }) => (
          <Link
            key={label}
            to={to}
            className="kpi-card group hover:-translate-y-0.5 hover:border-white/[0.1] transition-all duration-300"
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${accent} opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl`} />
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <div className={`w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center ${iconColor}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <ArrowRight className="w-4 h-4 text-zinc-700 group-hover:text-zinc-400 group-hover:translate-x-0.5 transition-all" />
              </div>
              <div className="text-3xl font-bold text-white font-mono tracking-tight">{value}</div>
              <div className="text-xs text-zinc-500 mt-1">{label}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* ═══ Competitor Intelligence Grid ═══ */}
      {competitors.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-white">Intelligence by Business</h2>
            <Link to="/competitors" className="text-sm text-zinc-500 hover:text-brand-400 flex items-center gap-1 transition-colors">
              View all <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {competitors.map(comp => {
              const compThemes = themesByCompetitor.get(comp.id) || [];
              const compWeaknesses = compThemes.filter(t => t.is_weakness).sort((a, b) => b.severity_score - a.severity_score);
              const compStrengths = compThemes.filter(t => !t.is_weakness);
              const maxSeverity = compWeaknesses.length > 0 ? compWeaknesses[0].severity_score : 0;

              return (
                <div
                  key={comp.id}
                  onClick={() => navigate('/competitors')}
                  className="card-hover group overflow-hidden"
                >
                  {/* Card header */}
                  <div className="p-4 flex items-center gap-3">
                    <CompetitorLogo name={comp.name} url={comp.url} size="lg" />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-white group-hover:text-brand-400 transition-colors truncate">
                        {comp.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        {comp.sector && <span className="badge badge-indigo text-[10px] py-0.5">{comp.sector}</span>}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-700 group-hover:text-brand-400 transition-colors flex-shrink-0" />
                  </div>

                  {/* Risk meter */}
                  <div className="px-4 pb-2">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] text-zinc-600 uppercase tracking-wider font-medium">Risk Level</span>
                      <span className="text-[10px] text-zinc-500 font-mono">{Math.round(maxSeverity * 100)}%</span>
                    </div>
                    <SeverityMeter value={maxSeverity} />
                  </div>

                  {/* Stats */}
                  <div className="px-4 py-2.5 flex items-center gap-4 text-[11px] text-zinc-600 border-t border-white/[0.04]">
                    <span className="flex items-center gap-1"><Globe className="w-3 h-3" /> {comp.source_count}</span>
                    <span className="flex items-center gap-1"><Layers className="w-3 h-3" /> {comp.theme_count}</span>
                    <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> {comp.action_count}</span>
                    {compWeaknesses.length > 0 && (
                      <span className="flex items-center gap-1 text-red-400/80 ml-auto">
                        <AlertTriangle className="w-3 h-3" /> {compWeaknesses.length}
                      </span>
                    )}
                  </div>

                  {/* Weakness chips */}
                  {compWeaknesses.length > 0 && (
                    <div className="px-4 pb-3 flex flex-wrap gap-1.5">
                      {compWeaknesses.slice(0, 3).map(w => (
                        <span key={w.id} className="text-[10px] px-2 py-0.5 rounded-md bg-red-500/8 text-red-400/80 border border-red-500/10 truncate max-w-[140px]">
                          {w.name}
                        </span>
                      ))}
                      {compWeaknesses.length > 3 && (
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/[0.03] text-zinc-600">
                          +{compWeaknesses.length - 3}
                        </span>
                      )}
                    </div>
                  )}

                  {compThemes.length === 0 && (
                    <div className="px-4 pb-4">
                      <p className="text-[11px] text-zinc-700 italic text-center py-2">
                        No data yet — ingest sources to begin
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ Top Weaknesses Feed ═══ */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <h2 className="font-semibold text-white text-sm">Top Weaknesses</h2>
            <span className="text-[10px] text-zinc-600 ml-1">across all competitors</span>
          </div>
          <Link to="/themes" className="text-xs text-zinc-500 hover:text-brand-400 transition-colors">View all</Link>
        </div>
        <div className="divide-y divide-white/[0.04]">
          {weaknesses.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-zinc-600">
              No weaknesses identified yet. Add competitors and ingest sources to begin.
            </div>
          ) : (
            weaknesses.slice(0, 6).map((w, i) => {
              const comp = competitors.find(c => c.id === w.competitor_id);
              return (
                <div key={w.id} className="px-5 py-3.5 flex items-center gap-4 hover:bg-white/[0.02] transition-colors">
                  <span className="text-[10px] font-mono text-zinc-700 w-4 text-right">{i + 1}</span>
                  {comp && <CompetitorLogo name={comp.name} url={comp.url} size="sm" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm text-white truncate">{w.name}</span>
                      <span className="text-[10px] text-zinc-600 flex-shrink-0 ml-3 font-mono">{w.frequency} mentions</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 max-w-[200px]">
                        <SeverityMeter value={w.severity_score} size="sm" />
                      </div>
                      <span className="text-[10px] font-mono text-red-400/60">{Math.round(w.severity_score * 100)}%</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ═══ Getting Started (empty state) ═══ */}
      {competitors.length === 0 && (
        <div className="relative overflow-hidden rounded-2xl border border-brand-500/20 p-8 text-center">
          <div className="absolute inset-0 bg-gradient-hero opacity-[0.06]" />
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center mx-auto mb-4">
              <Zap className="w-8 h-8 text-brand-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Get Started with DL-CRC</h3>
            <p className="text-sm text-zinc-500 mb-6 max-w-lg mx-auto leading-relaxed">
              Add your first competitor, ingest source URLs or text, and let the AI pipeline
              extract insights, identify weaknesses, and generate actionable artifacts.
            </p>
            <Link to="/competitors" className="btn-primary inline-flex items-center gap-2">
              <Users className="w-4 h-4" /> Add Your First Competitor
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
