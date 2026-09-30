import { useEffect, useRef } from "react";
import { motion } from "motion/react";
import { ContextInspector, Evidence, Report, Run } from "../types/api";
import { ContextInspectorView } from "./ContextInspectorView";
import { ReportView } from "./ReportView";
import { STAGES, VERIFICATION_LABELS } from "./stageMeta";
import { StageFeed } from "./stageFeed";

interface CardDetailDrawerProps {
  stageId: string;
  run: Run | null;
  feed: StageFeed;
  report?: Report | null;
  evidence: Evidence[];
  context?: ContextInspector | null;
  onEvidence: (item: Evidence) => void;
  onClose: () => void;
}

function IterationList({ feed }: { feed: StageFeed }) {
  const listRef = useRef<HTMLDivElement>(null);
  const rows = [...feed.iterations];
  const running = feed.runningIteration;
  const live = feed.liveSearches.filter((s) => s.iteration_index === running);
  const hasLive = running != null && !rows.some((entry) => entry.index === running);

  // 新迭代到达时自动滚动到底部
  useEffect(() => {
    if (!listRef.current) return;
    const frame = requestAnimationFrame(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight }));
    return () => cancelAnimationFrame(frame);
  }, [rows.length, live.length]);

  return <div className="drawer-iter-list" ref={listRef}>
    {rows.length === 0 && !hasLive && <div className="drawer-empty">等待深度研究迭代开始…</div>}
    {rows.map((entry) => (
      <div key={entry.index} className="iter-block">
        <div className="iter-block-head">
          <span className="iter-block-title">第 {entry.index + 1} 轮迭代</span>
          <span className="iter-block-meta">{entry.queries.length} 次搜索 · {entry.total_results} 条结果{entry.answer_char_count != null ? ` · 答案 ${entry.answer_char_count} 字符` : ""}</span>
        </div>
        {entry.queries.map((query, index) => (
          <div key={index} className="iter-query">
            <span className="iter-query-text">"{query.query}"</span>
            <span className={`iter-query-meta ${query.found_useful ? "ok" : "miss"}`}>{query.result_count} 条{query.found_useful ? " · 有用" : " · 未命中"}</span>
          </div>
        ))}
        {entry.info_snippets.length > 0 && (
          <div className="iter-snippets">
            {entry.info_snippets.map((snippet, index) => <span key={index} className="iter-snippet">{snippet}</span>)}
          </div>
        )}
      </div>
    ))}
    {hasLive && (
      <div className="iter-block is-live">
        <div className="iter-block-head">
          <span className="iter-block-title">第 {running! + 1} 轮迭代</span>
          <span className="pulse-dot" />
        </div>
        {live.map((search, index) => (
          <div key={index} className="iter-query">
            <span className="iter-query-text">"{search.query}"</span>
            <span className="iter-query-meta ok">搜索中…</span>
          </div>
        ))}
        {live.length === 0 && <div className="iter-query"><span className="iter-query-text">正在思考检索方向…</span></div>}
      </div>
    )}
  </div>;
}

function ToolList({ feed }: { feed: StageFeed }) {
  return <div className="drawer-tool-list">
    {feed.tools.length === 0 && <div className="drawer-empty">暂无工具调用</div>}
    {[...feed.tools].reverse().map((tool, index) => (
      <div key={index} className="tool-row">
        <span className="tool-name">{tool.tool_name}</span>
        {tool.query && <span className="tool-query">"{tool.query}"</span>}
        {tool.result_count != null && <span className="tool-count">{tool.result_count} 条结果</span>}
      </div>
    ))}
  </div>;
}

export function CardDetailDrawer({ stageId, run, feed, report, evidence, context, onEvidence, onClose }: CardDetailDrawerProps) {
  const stage = STAGES.find((item) => item.id === stageId) ?? STAGES[2];
  return <motion.div className="drawer-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} onClick={onClose}>
    <motion.aside
      className={`card-detail-drawer${stageId === "context_building" ? " context-drawer" : ""}${stageId === "reporting" || (stageId === "completed" && report?.content) ? " report-drawer" : ""}`}
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", stiffness: 320, damping: 32 }}
      onClick={(event) => event.stopPropagation()}
    >
      <header className="card-detail-head">
        <div className="card-detail-title">
          <span className="stage-icon">{stage.icon}</span>
          <h2>{stage.label}</h2>
          <span className={`stage-state is-${run?.status}`}>{run?.status ?? ""}</span>
        </div>
        <button className="icon-button close" onClick={onClose} aria-label="关闭">×</button>
      </header>

      {run?.error_message && <div className="inline-error">{run.error_code ? `${run.error_code}: ` : ""}{run.error_message}</div>}

      {stageId === "context_building" && (
        <div className="drawer-body">
          <p className="drawer-desc">检查实际进入本 Run 的冻结 Memory、稳定/动态上下文块、按需历史召回、压缩与局部编辑保护。</p>
          <ContextInspectorView context={context} />
        </div>
      )}

      {stageId === "planning" && (
        <div className="drawer-body">
          <p className="drawer-desc">研究计划由多阶段任务构成，任务逐个执行、失败自动重试。</p>
          {feed.planTasks.length === 0 && <div className="drawer-empty">等待计划生成…</div>}
          {feed.planTasks.map((task) => (
            <div key={task.task_id} className="plan-task">
              <span className="plan-task-type">{task.task_type}</span>
              <span className="plan-task-desc">{task.description}</span>
              <span className="plan-task-id">{task.task_id}</span>
            </div>
          ))}
        </div>
      )}

      {stageId === "executing" && (
        <div className="drawer-body">
          <section className="drawer-section"><h3>迭代过程</h3><IterationList feed={feed} /></section>
          <section className="drawer-section"><h3>工具调用</h3><ToolList feed={feed} /></section>
          <section className="drawer-section"><h3>证据采集</h3>
            {evidence.length === 0 && <div className="drawer-empty">尚未采集到证据</div>}
            {[...evidence].sort((a, b) => b.created_at.localeCompare(a.created_at)).map((item) => (
              <button key={item.evidence_id} type="button" className="evidence-card" onClick={() => onEvidence(item)}>
                <div className="evidence-card-body">
                  <span className="evidence-title">{item.title || "未命名来源"}</span>
                  <span className="evidence-summary">{item.summary}</span>
                  <span className="evidence-meta">
                    <span className="source-badge web">Web</span>
                    <span className="evidence-provider">{item.provider}</span>
                    <span className="evidence-score">{item.score.toFixed(2)}</span>
                  </span>
                </div>
              </button>
            ))}
          </section>
        </div>
      )}

      {stageId === "reporting" && (
        <div className="drawer-body">
          {!report?.content && <div className="drawer-empty">{run?.status === "paused" ? "报告阶段已暂停，恢复后将从这里继续。" : run?.status === "cancelled" ? "任务已取消，报告未保存。" : "报告生成中…"}</div>}
          <ReportView report={report} evidence={evidence} onEvidence={onEvidence} />
        </div>
      )}

      {stageId === "verifying" && (
        <div className="drawer-body">
          <p className="drawer-desc">逐项核查报告可信度与全量证据覆盖；报告问题进入定向修复，证据问题返回规划检索，超过预算后才结束。</p>
          <div className="verification-chips">
            {feed.verification.length === 0 && <span className="pending">检查中…</span>}
            {feed.verification.map((check) => (
              <span key={check.kind} className={check.passed === true ? "pass" : check.passed === false ? "fail" : "pending"}>
                {check.passed === true ? "✓" : check.passed === false ? "!" : "·"} {VERIFICATION_LABELS[check.kind] ?? check.kind}
              </span>
            ))}
          </div>
          {feed.verifyFailures.length > 0 && (
            <div className="verify-failures">
              {feed.recovery && <div className="verify-failure">
                <span className="verify-failure-kind">恢复动作</span>
                <span className="verify-failure-msg">{feed.recovery.attemptsExhausted
                  ? `${feed.recovery.action === "repair_report" ? "报告修复" : "重新规划"} ${feed.recovery.attempt ?? feed.recovery.maxAttempts ?? 0} 次后仍未通过`
                  : `${feed.recovery.action === "repair_report" ? "修复报告" : feed.recovery.action === "replan" ? "重新规划检索" : "无法自动修复"}${feed.recovery.attempt != null ? ` · 第 ${feed.recovery.attempt}/${feed.recovery.maxAttempts ?? "?"} 次` : ""}`}</span>
              </div>}
              {feed.verifyFailures.map((failure, index) => (
                <div key={index} className="verify-failure">
                  <span className="verify-failure-kind">{VERIFICATION_LABELS[failure.kind] ?? failure.kind}</span>
                  {failure.message && <span className="verify-failure-msg">{failure.message}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {stageId === "completed" && (
        <div className="drawer-body">
          <p className="drawer-desc">研究完成，报告通过全部验证门禁。点击证据引用可查看来源详情。</p>
          <dl className="drawer-stats">
            <div><dt>迭代轮次</dt><dd>{feed.iterations.length + (feed.runningIteration != null ? 1 : 0)}</dd></div>
            <div><dt>工具调用</dt><dd>{run?.usage?.usage?.tool_calls ?? feed.tools.length}</dd></div>
            <div><dt>采集证据</dt><dd>{feed.contextCount}</dd></div>
          </dl>
          {report?.content && <ReportView report={report} evidence={evidence} onEvidence={onEvidence} />}
        </div>
      )}

      {run?.status === "cancelled" && stageId !== "reporting" && (
        <div className="drawer-body"><div className="drawer-empty">任务已取消，不会继续调用模型或生成报告。</div></div>
      )}
      {run?.status === "paused" && stageId !== "reporting" && (
        <div className="drawer-body"><div className="drawer-empty">任务已暂停；恢复后将从当前卡片对应的安全阶段继续。</div></div>
      )}
    </motion.aside>
  </motion.div>;
}
