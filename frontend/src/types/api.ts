export type SourceMode = "web";
export type WorkflowMode = "deep_research" | "plan_execute_report";

export interface Session { session_id: string; title: string; status: string; memory_snapshot_version?: number | null; memory_snapshot_created_at?: string | null; created_at: string; updated_at: string; }
export interface Message { message_id: string; run_id?: string | null; role: string; content: string; metadata_json: string; created_at: string; }
export interface Run {
  run_id: string; source_mode: SourceMode; workflow_mode: WorkflowMode; status: string; current_stage?: string | null;
  error_code?: string | null; error_message?: string | null; cancellation_requested?: boolean; pause_requested?: boolean; created_at: string; updated_at: string;
  usage?: RunUsage | null;
}
export interface RunUsage {
  limits?: {
    wall_time_seconds?: number; max_plan_tasks?: number; max_tool_calls?: number; max_tavily_calls?: number;
    max_replans?: number; max_task_retries?: number; max_llm_tokens?: number; max_concurrency?: number; tool_timeout_seconds?: number;
  };
  usage?: {
    tool_calls?: number; tavily_calls?: number; replans?: number; task_retries?: number;
    llm_tokens?: number; elapsed_seconds?: number;
    prefix_cache_requests?: number; prefix_cache_hit_tokens?: number; prefix_cache_miss_tokens?: number;
  };
}
export interface CacheTotals { requests: number; input_tokens: number; hit_tokens: number; miss_tokens: number; output_tokens: number; }
export interface CacheStats { totals: CacheTotals; per_model: Record<string, CacheTotals>; started_at: number; hit_rate: number; }
export interface SessionDetail extends Session { messages: Message[]; runs: Run[]; }
export interface Evidence {
  evidence_id: string; source_mode: SourceMode; provider: string; source_id: string; title?: string | null;
  summary: string; metadata: Record<string, unknown>; score: number; created_at: string;
}
export interface ReportEvidenceIndex {
  evidence_id: string; title?: string | null; source_id: string; source_mode: SourceMode;
  provider: string; summary: string; url?: string | null; score: number;
}
export interface ReportSection { id: string; title: string; level: number; }
export interface Report {
  run_id: string; status: string; content?: string | null; report_mode?: "normal" | "budget_fallback";
  sections?: ReportSection[]; evidence_index?: ReportEvidenceIndex[];
  verification: Array<{kind: string; required: boolean; passed?: boolean | null; evidence: Record<string, unknown>}>;
}
export interface RunEvent { event_id?: number; event_type: string; stage?: string; [key: string]: unknown; }
export interface WhiteboardEntry {
  id: string; kind: "message" | "event" | "tool"; run_id?: string | null;
  created_at: string; label: string; status?: string | null; content: string;
  payload: Record<string, unknown>;
}
export interface WhiteboardLog {
  session_id: string; title: string; entries: WhiteboardEntry[];
  counts: {messages: number; runs: number; events: number; tools: number};
}
export interface Capability { available: boolean; reason?: string | null; }
export interface Capabilities { sources: { web: Capability }; workflows: WorkflowMode[]; default_source_mode: "web"; }

export interface CuratedMemory {
  memory_id: string; target: "user" | "project"; kind: string; content: string;
  provenance_refs: string[]; status: string; confidence?: number; created_by?: string; expires_at?: string | null;
  created_at: string; updated_at: string;
}
export interface MemoryCapacity { tokens: number; max_tokens: number; chars: number; max_chars: number; usage_ratio: number; warning?: boolean; }
export interface ContextBlock {
  name: string; content: string; source_type: string; source_ids: string[]; trust_level: string;
  priority: number; protected: boolean; trimmed: boolean; token_count: number;
}
export interface ContextTrace {
  name: string; source_type: string; source_ids: string[]; trust_level: string; tokens: number; trimmed: boolean;
}
export interface ContextMessage { message_id: string; role: string; content: string; created_at?: string; anchor?: boolean; }
export interface HistoricalRecall {
  session_id: string; title: string; snippet: string; match_message_id: string; detail: string;
  bookend_start: ContextMessage[]; messages: ContextMessage[]; bookend_end: ContextMessage[];
  messages_before: number; messages_after: number;
}
export interface ArtifactVerification {
  available: boolean; target_heading?: string | null; target_changed: boolean; all_preserved: boolean;
  preserved_sections: Array<{heading: string; expected_sha256: string; actual_sha256?: string | null; passed: boolean}>;
}
export interface ContextInspector {
  run_id: string; ready: boolean; status: string;
  checkpoint?: {version: number; stage: string; state_hash: string; verified: boolean; created_at: string};
  stable_snapshot_id?: string | null; memory_snapshot_version: number;
  stable_blocks: ContextBlock[]; dynamic_blocks: ContextBlock[]; retrieval_trace: ContextTrace[];
  token_usage_by_block: Record<string, number>; total_input_tokens: number;
  curated_memory: CuratedMemory[]; recent_messages: ContextMessage[]; session_summary: Record<string, unknown>;
  historical_recall_searched: boolean; historical_recall: HistoricalRecall[]; used_session_ids: string[];
  selected_skill?: Record<string, unknown> | null; artifact_edit?: Record<string, unknown> | null;
  active_skill_policy?: Record<string, unknown> | null; skill_policy_consumers?: string[];
  artifact_verification?: ArtifactVerification | null;
}

export interface EvolutionOverview {
  reviews: {total: number; by_status: Record<string, number>};
  candidates: {total: number; by_status: Record<string, number>};
  evaluations: {total: number; by_status: Record<string, number>; real_replay: number};
  versions: {total: number; by_status: Record<string, number>};
  deployments: {active: number; canary: number};
  impact: {token_delta: number; latency_delta_seconds: number; evaluated_samples: number};
  funnel: Array<{stage: string; count: number}>;
}

export interface EvolutionReviewSummary {
  review_id: string; run_id: string; goal: string; workflow_mode: string; source_mode: string;
  run_status: string; status: string; stage: string; decision?: string | null;
  skill_name?: string | null; critic_decision?: string | null; validation_passed?: boolean | null;
  candidate_id?: string | null; retry_count: number; revision_count: number;
  error_message?: string | null; created_at: string; updated_at: string;
}

export interface EvolutionTimelineEntry {
  id: string; event_type: string; stage?: string | null; payload: Record<string, unknown>; created_at: string;
}

export interface EvolutionReviewDetail extends Record<string, unknown> {
  review_id: string; run_id: string; status: string; goal: string; retry_count: number; revision_count: number;
  review_pack: Record<string, unknown>; proposal: Record<string, unknown>; critic: Record<string, unknown>;
  validation: Record<string, unknown>; timeline: EvolutionTimelineEntry[];
  run?: Record<string, unknown> | null; candidate?: Record<string, unknown> | null;
  evaluation?: Record<string, unknown> | null; version?: Record<string, unknown> | null;
  deployments: Array<Record<string, unknown>>;
}

export class ApiError extends Error {
  code: string; retryable: boolean; details: unknown;
  constructor(payload: {code: string; message: string; retryable?: boolean; details?: unknown}) {
    super(payload.message); this.code = payload.code; this.retryable = Boolean(payload.retryable); this.details = payload.details;
  }
}
