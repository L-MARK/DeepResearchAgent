/** 阶段画板元数据：阶段定义、中英文映射与派生逻辑（画板各组件共享） */

/** 完成验证的中文标签（画板验证卡 / 报告页复用） */
export const VERIFICATION_LABELS: Record<string, string> = {
  source_match: "来源匹配",
  min_evidence: "最小证据数",
  citation_integrity: "引用完整性",
  required_section: "必需章节",
  claim_support: "主张支持",
  report_consistency: "报告一致性",
  source_diversity: "来源多样性",
  evidence_card_coverage: "全量证据覆盖",
  custom: "自定义",
};

export interface StageMeta {
  id: string;
  label: string;
  icon: string;
}

/** 画板卡片顺序（与 Harness 状态机阶段对应） */
export const STAGES: StageMeta[] = [
  { id: "context_building", label: "上下文构建", icon: "◈" },
  { id: "planning", label: "规划", icon: "◎" },
  { id: "executing", label: "执行研究", icon: "⚙" },
  { id: "reporting", label: "报告", icon: "▤" },
  { id: "verifying", label: "验证", icon: "✓" },
  { id: "completed", label: "完成", icon: "★" },
];

/** 运行阶段 → 画板卡片 id（retrying/replanning 归执行卡；失败态也归执行卡） */
export function stageCardId(stage?: string | null): string | null {
  if (!stage) return null;
  if (["retrying", "replanning", "failed", "cancelled", "budget_exhausted", "interrupted"].includes(stage)) return "executing";
  return STAGES.some((s) => s.id === stage) ? stage : null;
}

/** 已到达（应渲染）的卡片 id 列表：当前卡及其之前所有卡 */
export function arrivedStages(currentStage?: string | null): string[] {
  const current = stageCardId(currentStage);
  if (!current) return [];
  const index = STAGES.findIndex((s) => s.id === current);
  return STAGES.slice(0, index + 1).map((s) => s.id);
}

export type StageState = "pending" | "busy" | "paused" | "done" | "cancelled" | "error";
