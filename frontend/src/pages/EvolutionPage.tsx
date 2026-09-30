import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { ErrorState } from "../components/ErrorState";
import { EvolutionReviewDetail } from "../types/api";

const PIPELINE = [
  ["run", "真实 Run", "持久化任务、工具、证据与 Contract"],
  ["review_pack", "Review Pack", "有界压缩、轨迹引用与来源隔离"],
  ["proposal", "Proposer", "创建、修改或忽略 Skill"],
  ["critic", "Critic", "独立审查可复用性、证据与安全"],
  ["validation", "安全门禁", "权限、来源、Trace、停止条件"],
  ["candidate", "Candidate", "生成完整 SKILL.md 与 Machine Policy"],
  ["evaluation", "真实评测", "Control / Treatment / Holdout"],
  ["deployment", "受控发布", "Shadow → Canary → Active / Suspend"],
] as const;

const EVENT_NAMES: Record<string, string> = {
  "learning.review.queued": "学习任务入队", "learning.review.started": "后台复盘开始",
  "learning.review_pack.built": "Review Pack 构建完成", "learning.review.ignored": "本次轨迹无需沉淀",
  "learning.review.failed": "学习任务失败", "learning.review.retried": "学习任务重试",
  "skill.proposal.created": "Proposer 生成提案", "skill.proposal.revised": "Proposer 修订提案",
  "skill.critic.completed": "Critic 审查完成", "skill.critic.rejected": "Critic 驳回",
  "skill.validation.completed": "确定性门禁完成", "skill.validation.failed": "确定性门禁失败",
  "skill.candidate.created": "Candidate 创建完成", "skill.candidate_created": "Candidate 创建完成", "skill.evaluation.started": "真实评测开始",
  "skill.evaluation.case_started": "评测分支开始", "skill.evaluation.arm_completed": "评测分支完成",
  "skill.evaluation.evaluation_completed": "真实评测完成", "skill.shadow_started": "进入 Shadow",
  "skill.canary_started": "进入 Canary", "skill.activated": "正式 Active",
  "skill.suspended": "Skill 暂停", "skill.rolled_back": "Skill 回滚",
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function list(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === "object") as Array<Record<string, unknown>> : [];
}
function json(value: unknown) { return <pre className="evo-json">{JSON.stringify(value ?? {}, null, 2)}</pre>; }
function fmt(value: unknown) { return typeof value === "number" ? value.toLocaleString() : String(value ?? "—"); }
function time(value: unknown) { return value ? new Date(String(value)).toLocaleString() : "—"; }

function stageState(detail: EvolutionReviewDetail, key: string) {
  const exists: Record<string, boolean> = {
    run: Boolean(detail.run), review_pack: Object.keys(detail.review_pack ?? {}).length > 0,
    proposal: Object.keys(detail.proposal ?? {}).length > 0, critic: Object.keys(detail.critic ?? {}).length > 0,
    validation: Object.keys(detail.validation ?? {}).length > 0, candidate: Boolean(detail.candidate),
    evaluation: Boolean(detail.evaluation), deployment: (detail.deployments ?? []).length > 0,
  };
  if (exists[key]) return "done";
  const checkpoint = String(record(detail.checkpoint).stage ?? detail.status);
  const aliases: Record<string, string> = {building_pack: "review_pack", proposing: "proposal", criticizing: "critic", revising: "proposal", writing_candidate: "candidate"};
  return aliases[checkpoint] === key || checkpoint === key ? "active" : "pending";
}

function EvaluationPanel({detail}: {detail: EvolutionReviewDetail}) {
  const evaluation = record(detail.evaluation); const metrics = record(evaluation.metrics);
  const pairs = list(metrics.pairs);
  if (!Object.keys(evaluation).length) return <div className="evo-empty">Candidate 尚未执行真实 Control/Treatment 评测。</div>;
  return <div className="evo-eval">
    <div className="evo-metrics compact">
      <div><small>状态</small><strong>{fmt(evaluation.status)}</strong></div>
      <div><small>Control 通过率</small><strong>{fmt(metrics.active_contract_pass_rate)}</strong></div>
      <div><small>Treatment 通过率</small><strong>{fmt(metrics.contract_pass_rate)}</strong></div>
      <div><small>Token Δ</small><strong>{fmt(metrics.token_delta)}</strong></div>
      <div><small>时延 Δ</small><strong>{fmt(metrics.latency_delta_seconds)}s</strong></div>
      <div><small>Holdout</small><strong>{metrics.holdout_passed === false ? "失败" : "通过"}</strong></div>
    </div>
    <div className="evo-pairs">
      {pairs.map((pair, index) => { const control = record(pair.control); const treatment = record(pair.treatment); const testCase = record(pair.case); return <details key={index}>
        <summary><span>用例 {index + 1} · {String(testCase.split ?? "eval")}</span><b className={treatment.completed ? "ok" : "bad"}>{treatment.completed ? "Treatment 通过" : "Treatment 失败"}</b></summary>
        <p>{String(testCase.query ?? "隐藏用例")}</p>
        <div className="evo-compare"><section><h5>Control</h5>{json(control)}</section><section><h5>Treatment</h5>{json(treatment)}</section></div>
      </details>; })}
    </div>
  </div>;
}

function Detail({detail, onRetry, retrying}: {detail: EvolutionReviewDetail; onRetry: () => void; retrying: boolean}) {
  const pack = detail.review_pack ?? {}; const proposal = detail.proposal ?? {}; const critic = detail.critic ?? {};
  const validation = detail.validation ?? {}; const candidate = record(detail.candidate); const candidatePayload = record(candidate.payload);
  const spec = record(candidatePayload.spec); const content = String(candidatePayload.content ?? "");
  return <section className="evo-detail">
    <header className="evo-detail-head"><div><span className="eyebrow">LEARNING TRACE</span><h2>{String(proposal.name ?? proposal.target_skill_id ?? "Learning Review")}</h2><p>{detail.goal}</p></div><div className="evo-detail-status"><span className={`evo-status ${detail.status}`}>{detail.status}</span><code>{detail.review_id}</code>{["failed", "rejected"].includes(detail.status) && <button onClick={onRetry} disabled={retrying}>{retrying ? "重试中…" : "重新复盘"}</button>}</div></header>
    <div className="evo-pipeline">{PIPELINE.map(([key, label, sub]) => <div className={`evo-stage ${stageState(detail, key)}`} key={key}><i>{stageState(detail, key) === "done" ? "✓" : ""}</i><strong>{label}</strong><small>{sub}</small></div>)}</div>

    <div className="evo-detail-grid">
      <article><h3>01 · 真实 Run 轨迹</h3><div className="evo-facts"><span>Run <code>{detail.run_id}</code></span><span>模型 <b>{String(record(record(pack.context_and_budget_metrics).model_snapshot).llm_model ?? record(record(pack.context_and_budget_metrics).model_snapshot).model ?? record(record(pack.context_and_budget_metrics).model_snapshot).model_name ?? "—")}</b></span><span>工作流 <b>{String(record(detail.run).workflow_mode ?? "—")}</b></span><span>来源 <b>{String(record(detail.run).source_mode ?? "—")}</b></span></div>{json({completion_contract: pack.completion_contract, context_and_budget_metrics: pack.context_and_budget_metrics})}</article>
      <article><h3>02 · Review Pack</h3><div className="evo-facts"><span>Episodes <b>{Array.isArray(pack.episodes) ? pack.episodes.length : 0}</b></span><span>Loaded Skills <b>{Array.isArray(pack.loaded_skills) ? pack.loaded_skills.length : 0}</b></span><span>Artifacts <b>{Array.isArray(pack.artifact_refs) ? pack.artifact_refs.length : 0}</b></span></div>{json(pack)}</article>
      <article><h3>03 · Proposer Agent</h3><div className="evo-verdict"><span className={`evo-status ${String(proposal.decision)}`}>{String(proposal.decision ?? "pending")}</span><p>{String(proposal.rationale ?? "等待提案")}</p></div>{json(proposal)}</article>
      <article><h3>04 · Critic Agent</h3><div className="evo-verdict"><span className={`evo-status ${String(critic.decision)}`}>{String(critic.decision ?? "pending")}</span><p>修订次数：{detail.revision_count} · 阻塞问题：{Array.isArray(critic.blocking_issues) ? critic.blocking_issues.length : 0}</p></div>{json(critic)}</article>
      <article><h3>05 · 确定性安全门禁</h3><div className="gate-list"><div><b>Trace Integrity</b><span>{validation.passed === true ? "通过" : "待检查/失败"}</span></div><div><b>Tool Permission</b><span>{Array.isArray(validation.errors) && validation.errors.length > 0 ? "检查错误" : "未发现扩权"}</span></div><div><b>Source Isolation</b><span>{validation.passed === true ? "通过" : "待检查"}</span></div><div><b>Warnings</b><span>{Array.isArray(validation.warnings) ? validation.warnings.length : 0}</span></div></div>{json(validation)}</article>
      <article><h3>06 · Candidate Skill</h3>{Object.keys(candidate).length ? <><div className="evo-facts"><span>状态 <b>{String(candidate.status)}</b></span><span>版本 <b>{String(candidate.version)}</b></span><span>工具 <b>{Array.isArray(spec.allowed_tools) ? spec.allowed_tools.join(", ") : "—"}</b></span></div><pre className="evo-skill-content">{content}</pre><details><summary>Machine Policy</summary>{json(candidatePayload.machine_policy ?? spec.machine_policy)}</details></> : <div className="evo-empty">尚未生成 Candidate。</div>}</article>
      <article className="wide"><h3>07 · Control / Treatment 真实评测</h3><EvaluationPanel detail={detail} /></article>
      <article className="wide"><h3>08 · Shadow / Canary / Active 发布</h3>{detail.deployments?.length ? <div className="deployment-track">{detail.deployments.map((item, index) => <div key={String(item.deployment_id ?? index)} className={`deployment-node ${item.status}`}><strong>{String(item.stage)}</strong><span>流量 {String(item.allocation_percent)}%</span><small>{time(item.started_at)} → {time(item.stopped_at)}</small>{json(item.metrics)}</div>)}</div> : <div className="evo-empty">尚未进入受控发布阶段。</div>}</article>
      <article className="wide"><h3>全链路事件时间线</h3><div className="evo-timeline">{detail.timeline?.length ? detail.timeline.map((item) => <details key={item.id}><summary><time>{time(item.created_at)}</time><b>{EVENT_NAMES[item.event_type] ?? item.event_type}</b><code>{item.stage}</code></summary>{json(item.payload)}</details>) : <div className="evo-empty">历史 Review 尚无阶段级事件；新 Run 会记录完整时间线。</div>}</div></article>
    </div>
  </section>;
}

export function EvolutionPage() {
  const client = useQueryClient(); const [status, setStatus] = useState(""); const [q, setQ] = useState(""); const [selected, setSelected] = useState<string | null>(null);
  const overview = useQuery({queryKey: ["evolution-overview"], queryFn: api.evolutionOverview, refetchInterval: 5000});
  const reviews = useQuery({queryKey: ["evolution-reviews", status, q], queryFn: () => api.evolutionReviews(status, q), refetchInterval: 3000});
  useEffect(() => { if (!selected && reviews.data?.items.length) setSelected(reviews.data.items[0].review_id); }, [reviews.data, selected]);
  const detail = useQuery({queryKey: ["evolution-review", selected], queryFn: () => api.evolutionReview(selected!), enabled: Boolean(selected), refetchInterval: (query) => ["completed", "rejected", "failed"].includes(String(query.state.data?.status)) ? false : 2000});
  const retry = useMutation({mutationFn: () => api.retryLearningReview(selected!), onSuccess: async () => { await Promise.all([client.invalidateQueries({queryKey: ["evolution-reviews"]}), client.invalidateQueries({queryKey: ["evolution-review", selected]})]); }});
  const funnelMax = useMemo(() => Math.max(1, ...(overview.data?.funnel.map((item) => item.count) ?? [1])), [overview.data]);
  return <main className="management-page evolution-page"><header><span className="eyebrow">CONTROLLED SELF-EVOLUTION</span><h1>自进化控制台</h1><p>从真实研究轨迹到 Candidate、评测、Canary 和 Active，每一步都有持久化证据。</p></header>
    <ErrorState error={overview.error ?? reviews.error ?? detail.error ?? retry.error} />
    <section className="evo-metrics">{[
      ["Learning Reviews", overview.data?.reviews.total], ["Candidates", overview.data?.candidates.total],
      ["真实评测", overview.data?.evaluations.real_replay], ["Canary", overview.data?.deployments.canary],
      ["Active", overview.data?.versions.by_status.active ?? 0], ["Token Δ", overview.data?.impact.token_delta ?? 0],
    ].map(([label, value]) => <div key={String(label)}><small>{label}</small><strong>{fmt(value)}</strong></div>)}</section>
    <section className="evo-funnel"><h2>学习漏斗</h2><div>{overview.data?.funnel.map((item) => <span key={item.stage}><i style={{width: `${Math.max(8, item.count / funnelMax * 100)}%`}} /><b>{item.stage}</b><em>{item.count}</em></span>)}</div></section>
    <section className="evo-workbench"><aside className="evo-review-list"><header><h2>学习任务</h2><span>{reviews.data?.total ?? 0}</span></header><div className="evo-filters"><input value={q} onChange={(event) => setQ(event.target.value)} placeholder="搜索任务、Run 或 Skill" /><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">全部状态</option><option value="queued">Queued</option><option value="completed">Completed</option><option value="rejected">Rejected</option><option value="failed">Failed</option></select></div><div className="evo-review-scroll">{reviews.data?.items.map((item) => <button key={item.review_id} className={selected === item.review_id ? "selected" : ""} onClick={() => setSelected(item.review_id)}><div><strong>{item.skill_name || "轨迹复盘"}</strong><span className={`evo-status ${item.status}`}>{item.status}</span></div><p>{item.goal}</p><small>{item.source_mode} · {item.workflow_mode} · {time(item.updated_at)}</small><code>{item.review_id}</code></button>)}{reviews.data && !reviews.data.items.length && <div className="evo-empty">暂无学习任务，请先完成一次新的研究 Run。</div>}</div></aside>
      <div className="evo-detail-host">{detail.data ? <Detail detail={detail.data} onRetry={() => retry.mutate()} retrying={retry.isPending} /> : <div className="evo-empty large">选择一条 Learning Review 查看完整链路。</div>}</div>
    </section>
  </main>;
}
