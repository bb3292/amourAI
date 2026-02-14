import { useEffect, useState } from 'react';
import { FileText, Plus, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '../api/client';
import type { Competitor, Report, ReportData } from '../types';
import { CompetitorLogoInline } from '../components/CompetitorLogo';
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
    try {
      return JSON.parse(content);
    } catch {
      return null;
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
          <h1 className="text-2xl font-bold text-gray-900">Snapshot Reports</h1>
          <p className="text-gray-500 text-sm mt-1">Generate and view competitive intelligence snapshots</p>
        </div>

        <div className="flex items-center gap-3">
          {competitors.length > 0 && (
            <select
              className="input w-auto"
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
            {generating ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
            ) : (
              <><Plus className="w-4 h-4" /> Generate Report</>
            )}
          </button>
        </div>
      </div>

      {error && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}

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

            return (
              <div key={report.id} className="card overflow-hidden">
                <div
                  className="px-6 py-4 cursor-pointer hover:bg-gray-50 transition-colors flex items-center justify-between"
                  onClick={() => setExpandedReport(expanded ? null : report.id)}
                >
                  <div>
                    <h3 className="font-semibold text-gray-900">{report.title || 'Competitive Snapshot'}</h3>
                    <div className="flex items-center gap-1.5 mt-1">
                      {(() => {
                        const comp = getCompetitor(report.competitor_id);
                        return comp ? <CompetitorLogoInline name={comp.name} url={comp.url} /> : null;
                      })()}
                      <span className="text-xs text-gray-500">
                        {competitorName(report.competitor_id)} — {new Date(report.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  {expanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                </div>

                {expanded && data && (
                  <div className="border-t border-gray-100 px-6 py-5 space-y-6">
                    {/* SWOT Grid */}
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-3">SWOT Analysis</h4>
                      <div className="grid grid-cols-2 gap-3">
                        {(['strengths', 'weaknesses', 'opportunities', 'threats'] as const).map(key => {
                          const colors = {
                            strengths: 'bg-emerald-50 border-emerald-200',
                            weaknesses: 'bg-red-50 border-red-200',
                            opportunities: 'bg-blue-50 border-blue-200',
                            threats: 'bg-amber-50 border-amber-200',
                          };
                          const textColors = {
                            strengths: 'text-emerald-800',
                            weaknesses: 'text-red-800',
                            opportunities: 'text-blue-800',
                            threats: 'text-amber-800',
                          };
                          return (
                            <div key={key} className={`p-4 rounded-lg border ${colors[key]}`}>
                              <h5 className={`text-xs font-bold uppercase mb-2 ${textColors[key]}`}>{key}</h5>
                              <ul className="space-y-1">
                                {data.swot[key].map((item, i) => (
                                  <li key={i} className={`text-sm ${textColors[key]}`}>• {item}</li>
                                ))}
                              </ul>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Positioning */}
                    <div className="bg-brand-50 p-4 rounded-lg">
                      <h4 className="text-sm font-semibold text-brand-800 mb-1">Positioning Angle</h4>
                      <p className="text-sm text-brand-700">{data.positioning_angle}</p>
                    </div>

                    {/* Top Weaknesses */}
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-3">Top Weaknesses</h4>
                      <div className="space-y-3">
                        {data.top_weaknesses.map((w, i) => (
                          <div key={i} className="flex items-start gap-4 bg-gray-50 p-3 rounded-lg">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-100 text-red-700 flex items-center justify-center font-bold text-sm">
                              {i + 1}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <h5 className="font-medium text-gray-900 text-sm">{w.name}</h5>
                                <span className="text-xs text-gray-400">Severity: {Math.round(w.severity * 100)}%</span>
                              </div>
                              <p className="text-xs text-gray-600 mt-1">{w.evidence}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Recommended Actions */}
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-3">Recommended Actions</h4>
                      <ol className="space-y-2">
                        {data.recommended_actions.map((a, i) => (
                          <li key={i} className="flex items-start gap-3 text-sm">
                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-semibold text-xs">
                              {i + 1}
                            </span>
                            <span className="text-gray-700">{a}</span>
                          </li>
                        ))}
                      </ol>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-6 pt-4 border-t border-gray-100 text-xs text-gray-500">
                      <span>Insights analyzed: {data.evidence_count}</span>
                      <span>Themes identified: {data.theme_count}</span>
                      <span>Avg confidence: {Math.round(data.avg_confidence * 100)}%</span>
                    </div>
                  </div>
                )}

                {expanded && !data && (
                  <div className="border-t border-gray-100 px-6 py-5">
                    <pre className="text-sm text-gray-600 whitespace-pre-wrap">{report.content}</pre>
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
