// ── Competitors ─────────────────────────────────────────────
export interface Competitor {
  id: number;
  name: string;
  url: string | null;
  sector: string | null;
  description: string | null;
  created_at: string;
  source_count: number;
  theme_count: number;
  action_count: number;
}

export interface CompetitorCreate {
  name: string;
  url?: string;
  sector?: string;
  description?: string;
}

// ── Sources ─────────────────────────────────────────────────
export interface Source {
  id: number;
  competitor_id: number;
  url: string | null;
  source_type: string;
  status: string;
  error_message: string | null;
  raw_content: string | null;
  created_at: string;
}

// ── Insights ────────────────────────────────────────────────
export interface Insight {
  id: number;
  source_id: number;
  competitor_id: number;
  text: string;
  sentiment: string | null;
  sentiment_score: number | null;
  persona: string | null;
  quote: string | null;
  confidence: number;
  source_url: string | null;
  source_date: string | null;
  created_at: string;
}

// ── Themes ──────────────────────────────────────────────────
export interface Theme {
  id: number;
  competitor_id: number;
  name: string;
  description: string | null;
  sentiment: string | null;
  severity_score: number;
  frequency: number;
  recency_days: number;
  is_weakness: boolean;
  differentiation_move: string | null;
  created_at: string;
  insight_count: number;
  insights: Insight[];
}

// ── Evaluation ──────────────────────────────────────────────
export interface Evaluation {
  id: number;
  artifact_id: number;
  relevance: number;
  evidence_coverage: number;
  hallucination_risk: number;
  actionability: number;
  freshness: number;
  overall_score: number;
  flagged: boolean;
  flag_reason: string | null;
  created_at: string;
}

// ── Artifacts ───────────────────────────────────────────────
export interface Artifact {
  id: number;
  action_id: number;
  content: string;
  artifact_type: string;
  citations: string | null;
  accepted: boolean;
  created_at: string;
  evaluation: Evaluation | null;
}

// ── Actions ─────────────────────────────────────────────────
export interface Action {
  id: number;
  theme_id: number | null;
  competitor_id: number;
  action_type: string;
  title: string | null;
  owner: string | null;
  due_date: string | null;
  status: string;
  created_at: string;
  artifact: Artifact | null;
  theme: Theme | null;
}

export interface ActionCreate {
  theme_id: number;
  competitor_id: number;
  action_type: string;
  title?: string;
  owner?: string;
  due_date?: string;
}

// ── Reports ─────────────────────────────────────────────────
export interface Report {
  id: number;
  competitor_id: number;
  report_type: string;
  title: string | null;
  content: string;
  created_at: string;
}

export interface ReportData {
  title: string;
  swot: {
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
  };
  positioning_angle: string;
  top_weaknesses: { name: string; severity: number; evidence: string }[];
  recommended_actions: string[];
  evidence_count: number;
  theme_count: number;
  avg_confidence: number;
}

// ── Monitoring ──────────────────────────────────────────────
export interface MonitoringSummary {
  total_artifacts: number;
  avg_relevance: number;
  avg_evidence_coverage: number;
  avg_hallucination_risk: number;
  avg_actionability: number;
  avg_freshness: number;
  avg_overall: number;
  flagged_count: number;
  accepted_count: number;
  pending_review: number;
  evaluations: Evaluation[];
}

// ── Ingest ──────────────────────────────────────────────────
export interface IngestRequest {
  competitor_id: number;
  urls: string[];
  raw_texts: string[];
  source_type: string;
}

export interface IngestResponse {
  status: string;
  sources_created: number;
  insights_extracted: number;
  themes_generated: number;
  message: string;
}
