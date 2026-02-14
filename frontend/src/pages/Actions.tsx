import { useEffect, useState } from 'react';
import {
  Zap, Check, Eye, Trash2, Target, MessageSquare,
  Map, MinusCircle, ExternalLink, Loader2,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { api } from '../api/client';
import type { Competitor, Action } from '../types';
import { CompetitorLogoInline } from '../components/CompetitorLogo';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';

const TYPE_CONFIG: Record<string, { badge: string; icon: typeof Target; label: string }> = {
  battlecard: { badge: 'badge-blue', icon: Target, label: 'Battlecard' },
  messaging: { badge: 'badge-purple', icon: MessageSquare, label: 'Messaging' },
  roadmap: { badge: 'badge-yellow', icon: Map, label: 'Roadmap' },
  ignore: { badge: 'badge-gray', icon: MinusCircle, label: 'Ignore' },
};

export default function Actions() {
  const [actions, setActions] = useState<Action[]>([]);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [filterStatus, setFilterStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [viewAction, setViewAction] = useState<Action | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.listActions(undefined, filterStatus || undefined),
      api.listCompetitors().catch(() => []),
    ]).then(([a, c]) => {
      setActions(a);
      setCompetitors(c);
      setLoading(false);
    });
  };

  useEffect(load, [filterStatus]);

  const handleAccept = async (actionId: number) => {
    await api.acceptArtifact(actionId, true);
    load();
    if (viewAction?.id === actionId) {
      setViewAction(prev => prev ? { ...prev, status: 'done', artifact: prev.artifact ? { ...prev.artifact, accepted: true } : null } : null);
    }
  };

  const handleDelete = async (actionId: number) => {
    if (!confirm('Delete this action and its artifact?')) return;
    await api.deleteAction(actionId);
    setViewAction(null);
    load();
  };

  const getCompetitor = (id: number) => competitors.find(c => c.id === id);
  const competitorName = (id: number) => getCompetitor(id)?.name || `#${id}`;

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div className="skeleton h-8 w-40" />
          <div className="skeleton h-10 w-36 rounded-xl" />
        </div>
        <div className="card overflow-hidden">
          <div className="p-4 space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="skeleton h-16 w-full rounded-lg" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Action Queue</h1>
          <p className="text-zinc-500 text-sm mt-1">Review and manage generated artifacts</p>
        </div>
        <div className="flex items-center gap-2">
          {['', 'pending', 'done'].map(status => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filterStatus === status
                  ? 'bg-white/[0.08] text-white'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]'
              }`}
            >
              {status === '' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {actions.length === 0 ? (
        <EmptyState
          icon={<Zap className="w-8 h-8" />}
          title="No actions yet"
          description="Go to Themes and create actions from competitor weaknesses to generate artifacts."
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full table-premium">
            <thead>
              <tr>
                <th>Type</th>
                <th>Title</th>
                <th>Status</th>
                <th>Competitor</th>
                <th>Theme</th>
                <th>Owner</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {actions.map(action => {
                const typeConfig = TYPE_CONFIG[action.action_type] || TYPE_CONFIG.ignore;
                const TypeIcon = typeConfig.icon;
                const comp = getCompetitor(action.competitor_id);

                return (
                  <tr key={action.id} className="group">
                    <td>
                      <span className={`badge ${typeConfig.badge} gap-1.5`}>
                        <TypeIcon className="w-3 h-3" />
                        {typeConfig.label}
                      </span>
                    </td>
                    <td>
                      <span className="font-medium text-white">
                        {action.title || `${action.action_type} action`}
                      </span>
                    </td>
                    <td><StatusBadge status={action.status} /></td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        {comp && <CompetitorLogoInline name={comp.name} url={comp.url} />}
                        <span className="text-zinc-400 text-xs">{competitorName(action.competitor_id)}</span>
                      </div>
                    </td>
                    <td className="text-zinc-500 text-xs truncate max-w-[150px]">
                      {action.theme?.name || '—'}
                    </td>
                    <td className="text-zinc-500 text-xs">
                      {action.owner || '—'}
                    </td>
                    <td>
                      <div className="flex items-center gap-1 justify-end opacity-50 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setViewAction(action)}
                          className="btn-icon" title="View"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {action.status !== 'done' && action.artifact && (
                          <button
                            onClick={() => handleAccept(action.id)}
                            className="p-2 rounded-lg hover:bg-emerald-500/10 text-zinc-500 hover:text-emerald-400 transition-all"
                            title="Accept"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(action.id)}
                          className="p-2 rounded-lg hover:bg-red-500/10 text-zinc-500 hover:text-red-400 transition-all"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ═══ Artifact Viewer ═══ */}
      <Modal open={!!viewAction} onClose={() => setViewAction(null)} title={viewAction?.title || 'Artifact'} wide>
        {viewAction?.artifact ? (
          <div className="space-y-6">
            {/* Status bar */}
            <div className="flex items-center gap-3">
              <StatusBadge status={viewAction.status} />
              {(() => {
                const config = TYPE_CONFIG[viewAction.action_type];
                return config && <span className={`badge ${config.badge} gap-1`}><config.icon className="w-3 h-3" />{config.label}</span>;
              })()}
              {viewAction.owner && <span className="text-xs text-zinc-500">Owner: {viewAction.owner}</span>}
            </div>

            {/* Content */}
            <div className="bg-white/[0.02] rounded-xl border border-white/[0.04] p-6">
              <div className="prose max-w-none">
                <ReactMarkdown>{viewAction.artifact.content}</ReactMarkdown>
              </div>
            </div>

            {/* Citations */}
            {viewAction.artifact.citations && (
              <div>
                <h4 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-3">Citations</h4>
                <div className="space-y-2">
                  {(() => {
                    try {
                      const cits = JSON.parse(viewAction.artifact.citations);
                      return cits.map((c: any, i: number) => (
                        <div key={i} className="text-xs bg-white/[0.02] border border-white/[0.04] p-3 rounded-xl flex items-start gap-2">
                          <span className="text-zinc-600 font-mono flex-shrink-0">[{i + 1}]</span>
                          <div>
                            <span className="font-medium text-zinc-400">{c.source} — {c.date}</span>
                            {c.quote && <span className="italic text-zinc-600 ml-1">"{c.quote}"</span>}
                            {c.url && (
                              <a href={c.url} target="_blank" rel="noopener" className="text-brand-400/60 hover:text-brand-400 ml-2 inline-flex items-center gap-1">
                                <ExternalLink className="w-3 h-3" /> Link
                              </a>
                            )}
                          </div>
                        </div>
                      ));
                    } catch {
                      return <p className="text-xs text-zinc-600">No structured citations</p>;
                    }
                  })()}
                </div>
              </div>
            )}

            {/* Footer actions */}
            <div className="flex items-center gap-3 pt-4 border-t border-white/[0.06]">
              {!viewAction.artifact.accepted ? (
                <button onClick={() => handleAccept(viewAction.id)} className="btn-success flex items-center gap-2">
                  <Check className="w-4 h-4" /> Accept Artifact
                </button>
              ) : (
                <span className="badge badge-green py-1.5 px-3 text-sm">Accepted</span>
              )}
            </div>
          </div>
        ) : (
          <div className="py-12 text-center">
            <p className="text-zinc-600">No artifact generated for this action.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
