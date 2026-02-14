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
import ScoreBar, { SeverityMeter } from '../components/ScoreBar';
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

  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [researching, setResearching] = useState(false);

  const [previewTab, setPreviewTab] = useState<PreviewTab>('insights');
  const [previewInsights, setPreviewInsights] = useState<Insight[]>([]);
  const [previewThemes, setPreviewThemes] = useState<Theme[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
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
      setError('Provide at least one URL or paste some text'); return;
    }
    setIngesting(true); setError(''); setIngestResult(null); setShowPreview(false);
    try {
      const result = await api.ingestSources({ competitor_id: selectedCompetitor, urls: urlList, raw_texts: textList, source_type: 'manual' });
      setIngestResult(result); load();
      if (result.status === 'success' && result.insights_extracted > 0) await loadPreviewData(selectedCompetitor);
    } catch (e: any) { setError(e.message); }
    finally { setIngesting(false); }
  };

  const handlePdfUpload = async () => {
    if (!selectedCompetitor) { setError('Select a competitor'); return; }
    if (!pdfFile) { setError('Select a PDF file'); return; }
    setUploading(true); setError(''); setIngestResult(null); setShowPreview(false);
    try {
      const result = await api.uploadPdf(selectedCompetitor, pdfFile);
      setIngestResult(result); setPdfFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      load();
      if (result.status === 'success' && result.insights_extracted > 0) await loadPreviewData(selectedCompetitor);
    } catch (e: any) { setError(e.message); }
    finally { setUploading(false); }
  };

  const handleResearch = async () => {
    if (!selectedCompetitor) { setError('Select a competitor'); return; }
    setResearching(true); setError(''); setIngestResult(null); setShowPreview(false);
    try {
      const result = await api.researchCompetitor(selectedCompetitor);
      setIngestResult(result); load();
      if (result.status === 'success' && result.insights_extracted > 0) await loadPreviewData(selectedCompetitor);
    } catch (e: any) { setError(e.message); }
    finally { setResearching(false); }
  };

  const competitorName = (id: number) => competitors.find(c => c.id === id)?.name || `#${id}`;
  const isBusy = ingesting || uploading || researching;

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div className="skeleton h-8 w-40" />
          <div className="skeleton h-10 w-40 rounded-xl" />
        </div>
        <div className="card overflow-hidden">
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4].map(i => <div key={i} className="skeleton h-12 w-full rounded-lg" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Sources</h1>
          <p className="text-zinc-500 text-sm mt-1">Ingest competitor data from URLs, PDFs, or web research</p>
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
        <div className="card p-5 bg-amber-500/5 border-amber-500/20 text-amber-400 text-sm">
          You need to add at least one competitor before ingesting sources.{' '}
          <a href="/competitors" className="font-medium underline hover:text-amber-300">Add a competitor</a>
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
          <table className="w-full table-premium">
            <thead>
              <tr>
                <th className="w-8"></th>
                <th>Source</th>
                <th>Competitor</th>
                <th>Type</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {sources.map(s => (
                <>
                  <tr
                    key={s.id}
                    className="cursor-pointer"
                    onClick={() => setExpandedSource(expandedSource === s.id ? null : s.id)}
                  >
                    <td className="text-zinc-600">
                      {expandedSource === s.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </td>
                    <td>
                      {s.url ? (
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noopener"
                          className="text-brand-400/70 hover:text-brand-400 truncate block max-w-sm transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {s.url}
                        </a>
                      ) : (
                        <span className="text-zinc-500 italic">
                          {s.source_type === 'pdf' ? 'PDF Upload' :
                           s.source_type === 'research_snippets' ? 'Web Research Snippets' :
                           s.source_type.startsWith('research_') ? 'Web Research' :
                           'Manual text'}
                        </span>
                      )}
                      {s.error_message && (
                        <p className="text-[11px] text-red-400/70 mt-1 truncate max-w-xs">{s.error_message}</p>
                      )}
                    </td>
                    <td className="text-zinc-400">{competitorName(s.competitor_id)}</td>
                    <td>
                      <span className={`badge ${
                        s.source_type === 'pdf' ? 'badge-red' :
                        s.source_type.startsWith('research') ? 'badge-green' :
                        'badge-purple'
                      } text-[10px]`}>
                        {s.source_type === 'pdf' ? 'PDF' :
                         s.source_type.startsWith('research') ? 'Research' :
                         s.source_type}
                      </span>
                    </td>
                    <td><StatusBadge status={s.status} /></td>
                    <td className="text-xs text-zinc-600 font-mono">
                      {new Date(s.created_at).toLocaleDateString()}
                    </td>
                  </tr>

                  {expandedSource === s.id && (
                    <tr key={`${s.id}-content`}>
                      <td colSpan={6} className="bg-white/[0.01] !border-white/[0.04]">
                        <div className="p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Eye className="w-3.5 h-3.5 text-zinc-600" />
                            <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Raw Content</span>
                            {s.raw_content && (
                              <span className="text-[10px] text-zinc-700 font-mono">({s.raw_content.length.toLocaleString()} chars)</span>
                            )}
                          </div>
                          {s.raw_content ? (
                            <pre className="text-[11px] text-zinc-500 whitespace-pre-wrap font-mono bg-white/[0.02] border border-white/[0.04] rounded-xl p-4 max-h-64 overflow-y-auto leading-relaxed">
                              {s.raw_content}
                            </pre>
                          ) : (
                            <p className="text-xs text-zinc-700 italic">No content stored.</p>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ═══ Ingest Modal ═══ */}
      <Modal open={showIngest} onClose={() => setShowIngest(false)} title="Ingest Sources" wide>
        <div className="space-y-5">
          {error && <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm">{error}</div>}

          {/* Pipeline result */}
          {ingestResult && (
            <div className={`p-4 rounded-xl text-sm border ${
              ingestResult.status === 'success' ? 'bg-emerald-500/8 text-emerald-400 border-emerald-500/20' :
              ingestResult.status === 'error' ? 'bg-red-500/8 text-red-400 border-red-500/20' :
              'bg-amber-500/8 text-amber-400 border-amber-500/20'
            }`}>
              <p className="font-semibold mb-2">
                {ingestResult.status === 'success' ? 'Pipeline Complete' : 'Pipeline Finished with Issues'}
              </p>
              <div className="grid grid-cols-3 gap-3 my-2">
                {[
                  { label: 'sources', value: ingestResult.sources_created },
                  { label: 'insights', value: ingestResult.insights_extracted },
                  { label: 'themes', value: ingestResult.themes_generated },
                ].map(({ label, value }) => (
                  <div key={label} className="text-center">
                    <p className="text-2xl font-bold font-mono">{value}</p>
                    <p className="text-[10px] opacity-60">{label}</p>
                  </div>
                ))}
              </div>
              {ingestResult.message && <p className="text-xs opacity-60 mt-1">{ingestResult.message}</p>}
            </div>
          )}

          {/* Data preview */}
          {showPreview && ingestResult?.status === 'success' && (
            <DataPreviewPanel
              tab={previewTab} setTab={setPreviewTab}
              insights={previewInsights} themes={previewThemes}
              sources={sources.filter(s => s.competitor_id === selectedCompetitor)}
              loading={previewLoading} competitorName={competitorName(selectedCompetitor)}
            />
          )}

          {/* Competitor selector */}
          <div>
            <label className="label">Competitor</label>
            <select className="input" value={selectedCompetitor} onChange={e => setSelectedCompetitor(Number(e.target.value))}>
              {competitors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* URL/Text inputs */}
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Globe className="w-4 h-4 text-brand-400" />
                <label className="text-sm font-semibold text-zinc-300">URLs (one per line)</label>
              </div>
              <textarea
                className="input min-h-[100px] font-mono text-xs"
                placeholder={"https://reddit.com/r/devops/comments/...\nhttps://www.g2.com/products/.../reviews"}
                value={urls} onChange={e => setUrls(e.target.value)} disabled={isBusy}
              />
              <p className="text-[10px] text-zinc-700 mt-1">Supports: Reddit, G2, Capterra, forums, blogs, pricing pages</p>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-purple-400" />
                <label className="text-sm font-semibold text-zinc-300">Paste raw text</label>
              </div>
              <textarea
                className="input min-h-[100px]"
                placeholder="Paste competitor reviews, forum posts, or any text content..."
                value={rawText} onChange={e => setRawText(e.target.value)} disabled={isBusy}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button onClick={handleIngest} disabled={isBusy} className="btn-primary flex items-center gap-2">
              {ingesting
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing pipeline...</>
                : <><Upload className="w-4 h-4" /> Ingest URLs / Text</>
              }
            </button>
          </div>

          {/* PDF + Research */}
          <div className="border-t border-white/[0.06] pt-5">
            <div className="grid md:grid-cols-2 gap-4">
              {/* PDF Upload */}
              <div className="rounded-2xl p-4 border-2 border-dashed border-white/[0.08] hover:border-brand-500/30 transition-colors bg-white/[0.01]">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                    <FileText className="w-4 h-4 text-red-400" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">Upload PDF</h4>
                    <p className="text-[10px] text-zinc-600">Reports, analyst docs</p>
                  </div>
                </div>
                <input
                  ref={fileInputRef} type="file" accept=".pdf,application/pdf"
                  onChange={e => setPdfFile(e.target.files?.[0] || null)}
                  className="block w-full text-xs text-zinc-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-red-500/10 file:text-red-400 hover:file:bg-red-500/20 cursor-pointer mb-3"
                  disabled={isBusy}
                />
                {pdfFile && (
                  <p className="text-xs text-zinc-500 mb-2">
                    <strong className="text-zinc-300">{pdfFile.name}</strong> ({(pdfFile.size / 1024).toFixed(0)} KB)
                  </p>
                )}
                <button onClick={handlePdfUpload} disabled={isBusy || !pdfFile} className="btn-primary w-full text-sm flex items-center justify-center gap-2">
                  {uploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Extracting...</> : <><Upload className="w-4 h-4" /> Process PDF</>}
                </button>
              </div>

              {/* Auto Research */}
              <div className="rounded-2xl p-4 border-2 border-dashed border-white/[0.08] hover:border-emerald-500/30 transition-colors bg-white/[0.01]">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <Search className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">Auto-Research</h4>
                    <p className="text-[10px] text-zinc-600">Reviews, complaints, comparisons</p>
                  </div>
                </div>
                <p className="text-xs text-zinc-600 mb-3 leading-relaxed">
                  Searches the web for public information about{' '}
                  <strong className="text-zinc-400">{competitors.find(c => c.id === selectedCompetitor)?.name || 'competitor'}</strong>.
                </p>
                <button onClick={handleResearch} disabled={isBusy} className="btn-success w-full text-sm flex items-center justify-center gap-2">
                  {researching ? <><Loader2 className="w-4 h-4 animate-spin" /> Researching...</> : <><Search className="w-4 h-4" /> Start Research</>}
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button onClick={() => setShowIngest(false)} className="btn-secondary">Close</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}


/* ════════════════════════════════════════════════════════════════ */

function DataPreviewPanel({ tab, setTab, insights, themes, sources, loading, competitorName }: {
  tab: PreviewTab; setTab: (t: PreviewTab) => void;
  insights: Insight[]; themes: Theme[]; sources: Source[];
  loading: boolean; competitorName: string;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-brand-400 mr-2" />
        <span className="text-sm text-zinc-500">Loading preview...</span>
      </div>
    );
  }

  return (
    <div className="border border-white/[0.06] rounded-xl overflow-hidden">
      <div className="flex bg-white/[0.02] border-b border-white/[0.06]">
        {([
          { key: 'insights' as PreviewTab, label: `Insights (${insights.length})`, icon: MessageSquareQuote },
          { key: 'themes' as PreviewTab, label: `Themes (${themes.length})`, icon: TrendingUp },
          { key: 'sources' as PreviewTab, label: `Sources (${sources.length})`, icon: Globe },
        ]).map(({ key, label, icon: Icon }) => (
          <button
            key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-all ${
              tab === key
                ? 'bg-white/[0.04] text-white border-b-2 border-brand-500 -mb-px'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>
      <div className="max-h-80 overflow-y-auto">
        {tab === 'insights' && <InsightsPreview insights={insights} />}
        {tab === 'themes' && <ThemesPreview themes={themes} competitorName={competitorName} />}
        {tab === 'sources' && <SourcesPreview sources={sources} />}
      </div>
    </div>
  );
}

function InsightsPreview({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) return <p className="p-4 text-sm text-zinc-600 italic">No insights extracted yet.</p>;
  return (
    <div className="divide-y divide-white/[0.04]">
      {insights.map(ins => (
        <div key={ins.id} className="px-4 py-3 hover:bg-white/[0.02] transition-colors">
          <p className="text-sm text-zinc-300">{ins.text}</p>
          {ins.quote && (
            <blockquote className="mt-1.5 pl-3 border-l-2 border-brand-500/30 text-xs text-zinc-500 italic">"{ins.quote}"</blockquote>
          )}
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <SentimentBadge sentiment={ins.sentiment} score={ins.sentiment_score} />
            {ins.persona && <span className="flex items-center gap-1 text-[10px] text-zinc-600"><User className="w-3 h-3" /> {ins.persona}</span>}
            <span className="text-[10px] text-zinc-600 font-mono">{Math.round(ins.confidence * 100)}% conf.</span>
            {ins.source_url && ins.source_url !== 'internet_research' && (
              <a href={ins.source_url} target="_blank" rel="noopener" className="flex items-center gap-1 text-[10px] text-brand-400/60 hover:text-brand-400">
                <ExternalLink className="w-3 h-3" /> Source
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function ThemesPreview({ themes, competitorName }: { themes: Theme[]; competitorName: string }) {
  if (themes.length === 0) return <p className="p-4 text-sm text-zinc-600 italic">No themes clustered yet.</p>;
  return (
    <div className="divide-y divide-white/[0.04]">
      {themes.map(theme => (
        <div key={theme.id} className="px-4 py-3 hover:bg-white/[0.02] transition-colors">
          <div className="flex items-center gap-2">
            {theme.is_weakness ? <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" /> : <TrendingUp className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
            <h4 className="text-sm font-semibold text-white">{theme.name}</h4>
            {theme.is_weakness && <span className="badge badge-red text-[10px]">Weakness</span>}
            <SentimentBadge sentiment={theme.sentiment} />
          </div>
          {theme.description && <p className="text-xs text-zinc-500 mt-1.5 ml-6 leading-relaxed">{theme.description}</p>}
          <div className="flex items-center gap-4 mt-2 ml-6">
            <div className="w-32"><SeverityMeter value={theme.severity_score} size="sm" /></div>
            <span className="text-[10px] text-zinc-600 font-mono">{theme.frequency} mentions</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function SourcesPreview({ sources }: { sources: Source[] }) {
  const [expanded, setExpanded] = useState<number | null>(null);
  if (sources.length === 0) return <p className="p-4 text-sm text-zinc-600 italic">No sources collected yet.</p>;
  return (
    <div className="divide-y divide-white/[0.04]">
      {sources.map(s => (
        <div key={s.id}>
          <div className="px-4 py-3 hover:bg-white/[0.02] cursor-pointer flex items-center justify-between transition-colors" onClick={() => setExpanded(expanded === s.id ? null : s.id)}>
            <div className="flex items-center gap-2 min-w-0">
              <span className={`badge ${s.source_type === 'pdf' ? 'badge-red' : s.source_type.startsWith('research') ? 'badge-green' : 'badge-purple'} text-[10px]`}>
                {s.source_type === 'pdf' ? 'PDF' : s.source_type.startsWith('research') ? 'Research' : s.source_type}
              </span>
              <span className="text-sm text-zinc-400 truncate">
                {s.url || (s.source_type === 'pdf' ? 'PDF Upload' : s.source_type.startsWith('research') ? 'Web Research' : 'Manual text')}
              </span>
              <StatusBadge status={s.status} />
            </div>
            <div className="flex items-center gap-2">
              {s.raw_content && <span className="text-[10px] text-zinc-700 font-mono">{s.raw_content.length.toLocaleString()} chars</span>}
              {expanded === s.id ? <ChevronUp className="w-3.5 h-3.5 text-zinc-600" /> : <ChevronDown className="w-3.5 h-3.5 text-zinc-600" />}
            </div>
          </div>
          {expanded === s.id && s.raw_content && (
            <div className="px-4 pb-3">
              <pre className="text-[11px] text-zinc-500 whitespace-pre-wrap font-mono bg-white/[0.02] border border-white/[0.04] rounded-xl p-3 max-h-48 overflow-y-auto leading-relaxed">{s.raw_content}</pre>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
