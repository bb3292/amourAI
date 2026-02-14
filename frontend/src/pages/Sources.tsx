import { useEffect, useState, useRef } from 'react';
import {
  Globe, Upload, FileText, Search, Loader2,
  ChevronDown, ChevronUp, Eye, AlertTriangle,
  TrendingUp, MessageSquareQuote, User, ExternalLink,
} from 'lucide-react';
import { api } from '../api/client';
import type { Competitor, Source, IngestResponse, Theme, Insight } from '../types';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import SentimentBadge from '../components/SentimentBadge';
import ScoreBar from '../components/ScoreBar';
import EmptyState from '../components/EmptyState';

type PreviewTab = 'insights' | 'themes' | 'sources';

export default function Sources() {
  const [sources, setSources] = useState<Source[]>([]);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showIngest, setShowIngest] = useState(false);
  const [selectedCompetitor, setSelectedCompetitor] = useState<number>(0);
  const [urls, setUrls] = useState('');
  const [rawText, setRawText] = useState('');
  const [ingesting, setIngesting] = useState(false);
  const [ingestResult, setIngestResult] = useState<IngestResponse | null>(null);
  const [error, setError] = useState('');

  // PDF upload state
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Research state
  const [researching, setResearching] = useState(false);

  // Data preview state
  const [previewTab, setPreviewTab] = useState<PreviewTab>('insights');
  const [previewInsights, setPreviewInsights] = useState<Insight[]>([]);
  const [previewThemes, setPreviewThemes] = useState<Theme[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Source row expansion
  const [expandedSource, setExpandedSource] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.listSources().catch(() => []),
      api.listCompetitors().catch(() => []),
    ]).then(([s, c]) => {
      setSources(s);
      setCompetitors(c);
      if (c.length > 0 && selectedCompetitor === 0) setSelectedCompetitor(c[0].id);
      setLoading(false);
    });
  };

  useEffect(load, []);

  /** After a successful pipeline, fetch the actual data for preview */
  const loadPreviewData = async (competitorId: number) => {
    setPreviewLoading(true);
    try {
      const [themes, insights] = await Promise.all([
        api.listThemes(competitorId),
        api.listInsights(competitorId),
      ]);
      setPreviewThemes(themes);
      setPreviewInsights(insights);
      setShowPreview(true);
      setPreviewTab('insights');
    } catch (e) {
      console.error('Failed to load preview data', e);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleIngest = async () => {
    if (!selectedCompetitor) { setError('Select a competitor'); return; }
    const urlList = urls.split('\n').map(u => u.trim()).filter(Boolean);
    const textList = rawText.trim() ? [rawText.trim()] : [];
    if (urlList.length === 0 && textList.length === 0) {
      setError('Provide at least one URL or paste some text');
      return;
    }

    setIngesting(true);
    setError('');
    setIngestResult(null);
    setShowPreview(false);
    try {
      const result = await api.ingestSources({
        competitor_id: selectedCompetitor,
        urls: urlList,
        raw_texts: textList,
        source_type: 'manual',
      });
      setIngestResult(result);
      load();
      if (result.status === 'success' && result.insights_extracted > 0) {
        await loadPreviewData(selectedCompetitor);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIngesting(false);
    }
  };

  const handlePdfUpload = async () => {
    if (!selectedCompetitor) { setError('Select a competitor'); return; }
    if (!pdfFile) { setError('Select a PDF file'); return; }

    setUploading(true);
    setError('');
    setIngestResult(null);
    setShowPreview(false);
    try {
      const result = await api.uploadPdf(selectedCompetitor, pdfFile);
      setIngestResult(result);
      setPdfFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      load();
      if (result.status === 'success' && result.insights_extracted > 0) {
        await loadPreviewData(selectedCompetitor);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleResearch = async () => {
    if (!selectedCompetitor) { setError('Select a competitor'); return; }
    setResearching(true);
    setError('');
    setIngestResult(null);
    setShowPreview(false);
    try {
      const result = await api.researchCompetitor(selectedCompetitor);
      setIngestResult(result);
      load();
      if (result.status === 'success' && result.insights_extracted > 0) {
        await loadPreviewData(selectedCompetitor);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setResearching(false);
    }
  };

  const competitorName = (id: number) => competitors.find(c => c.id === id)?.name || `#${id}`;
  const isBusy = ingesting || uploading || researching;

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
          <h1 className="text-2xl font-bold text-gray-900">Sources</h1>
          <p className="text-gray-500 text-sm mt-1">Ingest competitor data from URLs, PDFs, or auto-research the web</p>
        </div>
        <button
          onClick={() => { setShowIngest(true); setIngestResult(null); setError(''); setShowPreview(false); }}
          className="btn-primary flex items-center gap-2"
          disabled={competitors.length === 0}
        >
          <Upload className="w-4 h-4" /> Ingest Sources
        </button>
      </div>

      {competitors.length === 0 && (
        <div className="card p-5 bg-amber-50 border-amber-200 text-amber-800 text-sm">
          You need to add at least one competitor before ingesting sources.{' '}
          <a href="/competitors" className="font-medium underline">Add a competitor</a>
        </div>
      )}

      {sources.length === 0 ? (
        <EmptyState
          icon={<Globe className="w-8 h-8" />}
          title="No sources ingested"
          description="Paste URLs, upload PDFs, or auto-research the web to extract competitive insights."
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <th className="px-5 py-3 w-8"></th>
                <th className="px-5 py-3">Source</th>
                <th className="px-5 py-3">Competitor</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sources.map(s => (
                <>
                  <tr
                    key={s.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => setExpandedSource(expandedSource === s.id ? null : s.id)}
                  >
                    <td className="px-5 py-3 text-gray-400">
                      {expandedSource === s.id
                        ? <ChevronUp className="w-4 h-4" />
                        : <ChevronDown className="w-4 h-4" />
                      }
                    </td>
                    <td className="px-5 py-3 text-sm">
                      {s.url ? (
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noopener"
                          className="text-brand-600 hover:underline truncate block max-w-sm"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {s.url}
                        </a>
                      ) : (
                        <span className="text-gray-500 italic">
                          {s.source_type === 'pdf' ? 'PDF Upload' :
                           s.source_type === 'research_snippets' ? 'Web Research Snippets' :
                           s.source_type.startsWith('research_') ? 'Web Research' :
                           'Manual text'}
                        </span>
                      )}
                      {s.error_message && (
                        <p className="text-xs text-red-500 mt-1 truncate max-w-xs" title={s.error_message}>
                          {s.error_message}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-700">{competitorName(s.competitor_id)}</td>
                    <td className="px-5 py-3">
                      <span className={`badge ${
                        s.source_type === 'pdf' ? 'badge-red' :
                        s.source_type.startsWith('research') ? 'badge-green' :
                        'badge-purple'
                      }`}>
                        {s.source_type === 'pdf' ? 'PDF' :
                         s.source_type.startsWith('research') ? 'Research' :
                         s.source_type}
                      </span>
                    </td>
                    <td className="px-5 py-3"><StatusBadge status={s.status} /></td>
                    <td className="px-5 py-3 text-xs text-gray-500">
                      {new Date(s.created_at).toLocaleDateString()}
                    </td>
                  </tr>

                  {/* Expanded raw content preview */}
                  {expandedSource === s.id && (
                    <tr key={`${s.id}-content`}>
                      <td colSpan={6} className="px-5 py-4 bg-gray-50/80">
                        <div className="flex items-center gap-2 mb-2">
                          <Eye className="w-4 h-4 text-gray-400" />
                          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Raw Content Preview</span>
                          {s.raw_content && (
                            <span className="text-xs text-gray-400">({s.raw_content.length.toLocaleString()} chars)</span>
                          )}
                        </div>
                        {s.raw_content ? (
                          <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono bg-white border border-gray-200 rounded-lg p-4 max-h-64 overflow-y-auto leading-relaxed">
                            {s.raw_content}
                          </pre>
                        ) : (
                          <p className="text-xs text-gray-400 italic">No content stored for this source.</p>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Ingest Modal */}
      <Modal open={showIngest} onClose={() => setShowIngest(false)} title="Ingest Sources" wide>
        <div className="space-y-5">
          {error && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}

          {/* Pipeline result summary */}
          {ingestResult && (
            <div className={`p-4 rounded-lg text-sm ${
              ingestResult.status === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
              ingestResult.status === 'error' ? 'bg-red-50 text-red-800 border border-red-200' :
              'bg-amber-50 text-amber-800 border border-amber-200'
            }`}>
              <p className="font-semibold mb-1">
                {ingestResult.status === 'success' ? 'Pipeline Complete' : 'Pipeline Finished with Issues'}
              </p>
              <div className="grid grid-cols-3 gap-3 my-2">
                <div className="text-center">
                  <p className="text-2xl font-bold">{ingestResult.sources_created}</p>
                  <p className="text-xs opacity-70">sources</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">{ingestResult.insights_extracted}</p>
                  <p className="text-xs opacity-70">insights</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">{ingestResult.themes_generated}</p>
                  <p className="text-xs opacity-70">themes</p>
                </div>
              </div>
              {ingestResult.message && <p className="text-xs opacity-70 mt-1">{ingestResult.message}</p>}
            </div>
          )}

          {/* DATA PREVIEW PANEL */}
          {showPreview && ingestResult?.status === 'success' && (
            <DataPreviewPanel
              tab={previewTab}
              setTab={setPreviewTab}
              insights={previewInsights}
              themes={previewThemes}
              sources={sources.filter(s => s.competitor_id === selectedCompetitor)}
              loading={previewLoading}
              competitorName={competitorName(selectedCompetitor)}
            />
          )}

          {/* Competitor selector */}
          <div>
            <label className="label">Competitor</label>
            <select
              className="input"
              value={selectedCompetitor}
              onChange={e => setSelectedCompetitor(Number(e.target.value))}
            >
              {competitors.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Three input methods */}
          <div className="grid grid-cols-3 gap-3">
            {/* URLs */}
            <div className="col-span-3">
              <div className="flex items-center gap-2 mb-2">
                <Globe className="w-4 h-4 text-brand-600" />
                <label className="text-sm font-semibold text-gray-700">URLs (one per line)</label>
              </div>
              <textarea
                className="input min-h-[100px] font-mono text-xs"
                placeholder={"https://reddit.com/r/devops/comments/...\nhttps://www.g2.com/products/.../reviews\nhttps://community.example.com/..."}
                value={urls}
                onChange={e => setUrls(e.target.value)}
                disabled={isBusy}
              />
              <p className="text-xs text-gray-400 mt-1">Supports: Reddit, G2, Capterra, forums, blogs, pricing pages, PDF links</p>
            </div>

            {/* Raw text */}
            <div className="col-span-3">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-purple-600" />
                <label className="text-sm font-semibold text-gray-700">Paste raw text</label>
              </div>
              <textarea
                className="input min-h-[100px]"
                placeholder="Paste competitor reviews, forum posts, or any text content here..."
                value={rawText}
                onChange={e => setRawText(e.target.value)}
                disabled={isBusy}
              />
            </div>
          </div>

          {/* URL / Text ingest button */}
          <div className="flex justify-end">
            <button onClick={handleIngest} disabled={isBusy} className="btn-primary flex items-center gap-2">
              {ingesting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Processing pipeline...</>
              ) : (
                <><Upload className="w-4 h-4" /> Ingest URLs / Text</>
              )}
            </button>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-200 pt-4">
            <div className="grid md:grid-cols-2 gap-4">

              {/* PDF Upload */}
              <div className="card p-4 border-dashed border-2 border-gray-200 hover:border-brand-300 transition-colors">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                    <FileText className="w-4 h-4 text-red-600" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900">Upload PDF Report</h4>
                    <p className="text-xs text-gray-500">Competitor reports, analyst docs, etc.</p>
                  </div>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={e => setPdfFile(e.target.files?.[0] || null)}
                  className="block w-full text-xs text-gray-500 file:mr-3 file:py-1.5 file:px-3
                             file:rounded-lg file:border-0 file:text-xs file:font-medium
                             file:bg-red-50 file:text-red-700 hover:file:bg-red-100
                             cursor-pointer mb-3"
                  disabled={isBusy}
                />

                {pdfFile && (
                  <p className="text-xs text-gray-600 mb-2">
                    Selected: <strong>{pdfFile.name}</strong> ({(pdfFile.size / 1024).toFixed(0)} KB)
                  </p>
                )}

                <button
                  onClick={handlePdfUpload}
                  disabled={isBusy || !pdfFile}
                  className="btn-primary w-full text-sm flex items-center justify-center gap-2"
                >
                  {uploading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Extracting PDF...</>
                  ) : (
                    <><Upload className="w-4 h-4" /> Upload & Process PDF</>
                  )}
                </button>
              </div>

              {/* Auto Research */}
              <div className="card p-4 border-dashed border-2 border-gray-200 hover:border-emerald-300 transition-colors">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                    <Search className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900">Auto-Research Web</h4>
                    <p className="text-xs text-gray-500">Searches reviews, complaints, comparisons</p>
                  </div>
                </div>

                <p className="text-xs text-gray-500 mb-3">
                  Automatically searches the internet for public information about{' '}
                  <strong>{competitors.find(c => c.id === selectedCompetitor)?.name || 'the competitor'}</strong>
                  : reviews, complaints, comparisons, and forum discussions.
                </p>

                <button
                  onClick={handleResearch}
                  disabled={isBusy}
                  className="btn-success w-full text-sm flex items-center justify-center gap-2"
                >
                  {researching ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Researching the web...</>
                  ) : (
                    <><Search className="w-4 h-4" /> Research {competitors.find(c => c.id === selectedCompetitor)?.name || 'Competitor'}</>
                  )}
                </button>
              </div>

            </div>
          </div>

          {/* Close */}
          <div className="flex justify-end pt-2">
            <button onClick={() => setShowIngest(false)} className="btn-secondary">Close</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   DATA PREVIEW PANEL – Shown inline after successful pipeline
   ════════════════════════════════════════════════════════════════ */

function DataPreviewPanel({
  tab, setTab, insights, themes, sources, loading, competitorName,
}: {
  tab: PreviewTab;
  setTab: (t: PreviewTab) => void;
  insights: Insight[];
  themes: Theme[];
  sources: Source[];
  loading: boolean;
  competitorName: string;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-brand-600 mr-2" />
        <span className="text-sm text-gray-500">Loading preview data...</span>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      {/* Tab bar */}
      <div className="flex bg-gray-50 border-b border-gray-200">
        {([
          { key: 'insights' as PreviewTab, label: `Insights (${insights.length})`, icon: MessageSquareQuote },
          { key: 'themes' as PreviewTab, label: `Themes (${themes.length})`, icon: TrendingUp },
          { key: 'sources' as PreviewTab, label: `Sources (${sources.length})`, icon: Globe },
        ]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors ${
              tab === key
                ? 'bg-white text-brand-700 border-b-2 border-brand-600 -mb-px'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="max-h-80 overflow-y-auto">
        {tab === 'insights' && <InsightsPreview insights={insights} />}
        {tab === 'themes' && <ThemesPreview themes={themes} competitorName={competitorName} />}
        {tab === 'sources' && <SourcesPreview sources={sources} />}
      </div>
    </div>
  );
}

/* ─── Insights Preview ────────────────────────────────────── */
function InsightsPreview({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) {
    return <p className="p-4 text-sm text-gray-400 italic">No insights extracted yet.</p>;
  }
  return (
    <div className="divide-y divide-gray-100">
      {insights.map(ins => (
        <div key={ins.id} className="px-4 py-3 hover:bg-gray-50/50">
          <p className="text-sm text-gray-800 leading-snug">{ins.text}</p>
          {ins.quote && (
            <blockquote className="mt-1.5 pl-3 border-l-2 border-brand-300 text-xs text-gray-500 italic leading-relaxed">
              "{ins.quote}"
            </blockquote>
          )}
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <SentimentBadge sentiment={ins.sentiment} score={ins.sentiment_score} />
            {ins.persona && (
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <User className="w-3 h-3" /> {ins.persona}
              </span>
            )}
            <span className="text-xs text-gray-400">
              Confidence: {Math.round(ins.confidence * 100)}%
            </span>
            {ins.source_url && ins.source_url !== 'internet_research' && (
              <a
                href={ins.source_url}
                target="_blank"
                rel="noopener"
                className="flex items-center gap-1 text-xs text-brand-500 hover:underline"
              >
                <ExternalLink className="w-3 h-3" /> Source
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Themes Preview ──────────────────────────────────────── */
function ThemesPreview({ themes, competitorName }: { themes: Theme[]; competitorName: string }) {
  if (themes.length === 0) {
    return <p className="p-4 text-sm text-gray-400 italic">No themes clustered yet.</p>;
  }
  return (
    <div className="divide-y divide-gray-100">
      {themes.map(theme => (
        <div key={theme.id} className="px-4 py-3 hover:bg-gray-50/50">
          <div className="flex items-center gap-2">
            {theme.is_weakness ? (
              <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
            ) : (
              <TrendingUp className="w-4 h-4 text-emerald-500 flex-shrink-0" />
            )}
            <h4 className="text-sm font-semibold text-gray-900">{theme.name}</h4>
            {theme.is_weakness && <span className="badge badge-red text-[10px]">Weakness</span>}
            <SentimentBadge sentiment={theme.sentiment} />
          </div>
          {theme.description && (
            <p className="text-xs text-gray-600 mt-1 ml-6 leading-relaxed">{theme.description}</p>
          )}
          <div className="flex items-center gap-4 mt-2 ml-6">
            <div className="w-32">
              <ScoreBar value={theme.severity_score} label="Severity" />
            </div>
            <span className="text-xs text-gray-400">{theme.frequency} mentions</span>
            <span className="text-xs text-gray-400">{theme.insight_count} insights</span>
          </div>
          {theme.differentiation_move && (
            <div className="mt-2 ml-6 p-2 bg-brand-50 rounded text-xs text-brand-700 leading-relaxed">
              <strong>Move:</strong> {theme.differentiation_move}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ─── Sources Preview ─────────────────────────────────────── */
function SourcesPreview({ sources }: { sources: Source[] }) {
  const [expanded, setExpanded] = useState<number | null>(null);

  if (sources.length === 0) {
    return <p className="p-4 text-sm text-gray-400 italic">No sources collected yet.</p>;
  }
  return (
    <div className="divide-y divide-gray-100">
      {sources.map(s => (
        <div key={s.id}>
          <div
            className="px-4 py-3 hover:bg-gray-50/50 cursor-pointer flex items-center justify-between"
            onClick={() => setExpanded(expanded === s.id ? null : s.id)}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className={`badge ${
                s.source_type === 'pdf' ? 'badge-red' :
                s.source_type.startsWith('research') ? 'badge-green' :
                'badge-purple'
              } text-[10px]`}>
                {s.source_type === 'pdf' ? 'PDF' :
                 s.source_type.startsWith('research') ? 'Research' :
                 s.source_type}
              </span>
              <span className="text-sm text-gray-700 truncate">
                {s.url || (s.source_type === 'pdf' ? 'PDF Upload' : s.source_type.startsWith('research') ? 'Web Research' : 'Manual text')}
              </span>
              <StatusBadge status={s.status} />
            </div>
            <div className="flex items-center gap-2">
              {s.raw_content && (
                <span className="text-[10px] text-gray-400">{s.raw_content.length.toLocaleString()} chars</span>
              )}
              {expanded === s.id ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
            </div>
          </div>
          {expanded === s.id && s.raw_content && (
            <div className="px-4 pb-3">
              <pre className="text-[11px] text-gray-600 whitespace-pre-wrap font-mono bg-gray-100 rounded-lg p-3 max-h-48 overflow-y-auto leading-relaxed">
                {s.raw_content}
              </pre>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
