import type {
  Competitor, CompetitorCreate, Source, Theme, Insight,
  Action, ActionCreate, Report, MonitoringSummary,
  IngestRequest, IngestResponse,
} from '../types';

const BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
    ...options,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || `Request failed: ${res.status}`);
  }
  return res.json();
}

// ── Competitors ─────────────────────────────────────────────
export const api = {
  // Competitors
  listCompetitors: () => request<Competitor[]>('/competitors'),
  getCompetitor: (id: number) => request<Competitor>(`/competitors/${id}`),
  createCompetitor: (data: CompetitorCreate) =>
    request<Competitor>('/competitors', { method: 'POST', body: JSON.stringify(data) }),
  deleteCompetitor: (id: number) =>
    request(`/competitors/${id}`, { method: 'DELETE' }),

  // Sources
  listSources: (competitorId?: number) =>
    request<Source[]>(`/sources${competitorId ? `?competitor_id=${competitorId}` : ''}`),
  ingestSources: (data: IngestRequest) =>
    request<IngestResponse>('/sources/ingest', { method: 'POST', body: JSON.stringify(data) }),

  // PDF Upload
  uploadPdf: async (competitorId: number, file: File): Promise<IngestResponse> => {
    const form = new FormData();
    form.append('competitor_id', String(competitorId));
    form.append('file', file);
    const res = await fetch(`${BASE}/sources/upload-pdf`, { method: 'POST', body: form });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(error.detail || `Upload failed: ${res.status}`);
    }
    return res.json();
  },

  // Internet Research
  researchCompetitor: (competitorId: number) =>
    request<IngestResponse>('/sources/research', {
      method: 'POST',
      body: JSON.stringify({ competitor_id: competitorId }),
    }),

  // Themes
  listThemes: (competitorId?: number) =>
    request<Theme[]>(`/themes${competitorId ? `?competitor_id=${competitorId}` : ''}`),
  getTheme: (id: number) => request<Theme>(`/themes/${id}`),

  // Insights
  listInsights: (competitorId?: number) =>
    request<Insight[]>(`/themes/insights/all${competitorId ? `?competitor_id=${competitorId}` : ''}`),

  // Actions
  listActions: (competitorId?: number, status?: string) => {
    const params = new URLSearchParams();
    if (competitorId) params.set('competitor_id', String(competitorId));
    if (status) params.set('status', status);
    const qs = params.toString();
    return request<Action[]>(`/actions${qs ? `?${qs}` : ''}`);
  },
  createAction: (data: ActionCreate) =>
    request<Action>('/actions', { method: 'POST', body: JSON.stringify(data) }),
  updateAction: (id: number, data: Partial<Action>) =>
    request<Action>(`/actions/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  acceptArtifact: (actionId: number, accepted: boolean) =>
    request(`/actions/${actionId}/artifact/accept`, {
      method: 'POST', body: JSON.stringify({ accepted }),
    }),
  deleteAction: (id: number) =>
    request(`/actions/${id}`, { method: 'DELETE' }),

  // Reports
  listReports: (competitorId?: number) =>
    request<Report[]>(`/reports${competitorId ? `?competitor_id=${competitorId}` : ''}`),
  generateReport: (competitorId: number) =>
    request<Report>('/reports', {
      method: 'POST', body: JSON.stringify({ competitor_id: competitorId, report_type: 'snapshot' }),
    }),

  // Monitoring
  getMonitoring: () => request<MonitoringSummary>('/monitoring'),

  // Health
  health: () => request<{
    status: string;
    mode: string;
    integrations?: {
      blaxel: boolean;
      anthropic: boolean;
      whitecircle: boolean;
      lovable: boolean;
    };
  }>('/health'),
};
