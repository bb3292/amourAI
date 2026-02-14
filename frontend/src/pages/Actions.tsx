import { useEffect, useState } from 'react';
import { Zap, Check, Eye, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { api } from '../api/client';
import type { Competitor, Action } from '../types';
import { CompetitorLogoInline } from '../components/CompetitorLogo';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';

const TYPE_COLORS: Record<string, string> = {
  battlecard: 'badge-blue',
  messaging: 'badge-purple',
  roadmap: 'badge-yellow',
  ignore: 'badge-gray',
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

  const handleReject = async (actionId: number) => {
    await api.updateAction(actionId, { status: 'pending' } as any);
    load();
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
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Action Queue</h1>
          <p className="text-gray-500 text-sm mt-1">Review and manage generated artifacts</p>
        </div>
        <select className="input w-auto" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="done">Done</option>
        </select>
      </div>

      {actions.length === 0 ? (
        <EmptyState
          icon={<Zap className="w-8 h-8" />}
          title="No actions yet"
          description="Go to Themes and create actions from competitor weaknesses to generate artifacts."
        />
      ) : (
        <div className="space-y-3">
          {actions.map(action => (
            <div key={action.id} className="card p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`badge ${TYPE_COLORS[action.action_type] || 'badge-gray'}`}>
                      {action.action_type}
                    </span>
                    <StatusBadge status={action.status} />
                  </div>
                  <h3 className="font-semibold text-gray-900">
                    {action.title || `${action.action_type} action`}
                  </h3>
                  <div className="flex items-center gap-1.5 mt-1">
                    {(() => {
                      const comp = getCompetitor(action.competitor_id);
                      return comp ? <CompetitorLogoInline name={comp.name} url={comp.url} /> : null;
                    })()}
                    <span className="text-xs text-gray-500">
                    {competitorName(action.competitor_id)}
                    {action.theme && ` — ${action.theme.name}`}
                    {action.owner && ` — Owner: ${action.owner}`}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => setViewAction(action)}
                    className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                    title="View artifact"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  {action.status !== 'done' && action.artifact && (
                    <button
                      onClick={() => handleAccept(action.id)}
                      className="p-2 rounded-lg hover:bg-emerald-50 text-gray-400 hover:text-emerald-600 transition-colors"
                      title="Accept artifact"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(action.id)}
                    className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Artifact Viewer Modal */}
      <Modal
        open={!!viewAction}
        onClose={() => setViewAction(null)}
        title={viewAction?.title || 'Artifact'}
        wide
      >
        {viewAction?.artifact ? (
          <div className="space-y-6">
            {/* Artifact content */}
            <div className="prose max-w-none">
              <ReactMarkdown>{viewAction.artifact.content}</ReactMarkdown>
            </div>

            {/* Citations */}
            {viewAction.artifact.citations && (
              <div className="border-t border-gray-100 pt-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Citations</h4>
                <div className="space-y-2">
                  {(() => {
                    try {
                      const cits = JSON.parse(viewAction.artifact.citations);
                      return cits.map((c: any, i: number) => (
                        <div key={i} className="text-xs bg-gray-50 p-2 rounded border border-gray-100">
                          <span className="font-medium">[{c.source} — {c.date}]</span>
                          {c.quote && <span className="italic text-gray-500 ml-1">"{c.quote}"</span>}
                          {c.url && (
                            <a href={c.url} target="_blank" rel="noopener" className="text-brand-600 ml-1 hover:underline">
                              Link
                            </a>
                          )}
                        </div>
                      ));
                    } catch {
                      return <p className="text-xs text-gray-400">No structured citations</p>;
                    }
                  })()}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
              {!viewAction.artifact.accepted && (
                <button
                  onClick={() => handleAccept(viewAction.id)}
                  className="btn-success flex items-center gap-2"
                >
                  <Check className="w-4 h-4" /> Accept Artifact
                </button>
              )}
              {viewAction.artifact.accepted && (
                <span className="badge badge-green text-sm py-1.5 px-3">Accepted</span>
              )}
            </div>
          </div>
        ) : (
          <p className="text-gray-400 text-center py-8">No artifact generated for this action.</p>
        )}
      </Modal>
    </div>
  );
}
