import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { WhiteboardEntry } from "../types/api";

const EVENT_LABELS: Record<string, string> = {
  "run.queued": "Run 已入队", "run.started": "Run 开始", "run.stage_changed": "阶段切换",
  "run.pause_requested": "请求暂停", "run.paused": "Run 已暂停", "run.resumed": "Run 已恢复",
  "context.completed": "上下文完成", "plan.created": "计划创建", "plan.revised": "计划更新",
  "task.started": "任务开始", "task.completed": "任务完成", "task.failed": "任务失败",
  "tool.completed": "工具实时返回", "tool.failed": "工具失败", "evidence.added": "证据入账",
  "report.completed": "报告完成", "verification.completed": "验证完成", "run.completed": "Run 完成",
  "run.failed": "Run 失败", "run.retrying": "Run 重试",
  "learning.review.queued": "学习复盘已入队", "learning.review.started": "学习复盘开始",
  "learning.review.ignored": "学习复盘无可沉淀内容", "learning.review.failed": "学习复盘失败",
  "learning.review.retried": "学习复盘已重试",
  "skill.critic.rejected": "Skill Critic 驳回", "skill.validation.failed": "Skill 确定性校验失败",
  "skill.candidate.created": "Skill Candidate 已创建", "skill.candidate_created": "Skill Candidate 已创建",
  "skill.shadow_started": "Skill 进入 Shadow",
  "skill.canary_started": "Skill 进入 Canary", "skill.activated": "Skill 正式启用",
  "skill.suspended": "Skill 已暂停",
};

function entryTitle(entry: WhiteboardEntry) {
  if (entry.kind === "message") return entry.label;
  if (entry.kind === "tool") return `工具记录 · ${entry.label}`;
  return EVENT_LABELS[entry.label] ?? entry.label;
}

export function WhiteboardDrawer({sessionId, open, live, onClose}: {sessionId: string; open: boolean; live: boolean; onClose: () => void}) {
  const query = useQuery({
    queryKey: ["whiteboard", sessionId], queryFn: () => api.whiteboard(sessionId), enabled: open,
    refetchInterval: open && live ? 1000 : false,
  });
  if (!open) return null;
  const entries = query.data?.entries ?? [];
  return <aside className="whiteboard-drawer" aria-label="白板全链路日志">
    <header className="whiteboard-head"><div><span className="eyebrow">FULL CHAIN LOG</span><h2>白板</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="关闭白板">×</button></header>
    {query.data && <div className="whiteboard-counts"><span>对话 {query.data.counts.messages}</span><span>Run {query.data.counts.runs}</span><span>事件 {query.data.counts.events}</span><span>工具 {query.data.counts.tools}</span>{live && <i>实时更新</i>}</div>}
    <div className="whiteboard-list">
      {query.isLoading && <div className="drawer-empty">正在加载全链路日志…</div>}
      {query.error && <div className="whiteboard-error">{query.error instanceof Error ? query.error.message : "白板加载失败"}</div>}
      {!query.isLoading && entries.length === 0 && <div className="drawer-empty">当前会话还没有日志。</div>}
      {entries.map((entry) => <details className={`whiteboard-entry kind-${entry.kind}`} key={entry.id} open={entry.kind === "message"}>
        <summary><span className="whiteboard-kind">{entry.kind === "message" ? "对话" : entry.kind === "tool" ? "工具" : "事件"}</span><strong>{entryTitle(entry)}</strong><time>{new Date(entry.created_at).toLocaleTimeString()}</time></summary>
        {entry.content && <p>{entry.content}</p>}
        <div className="whiteboard-meta"><code>{entry.run_id ?? "session"}</code>{entry.status && <span>{entry.status}</span>}</div>
        {Object.keys(entry.payload).length > 0 && <pre>{JSON.stringify(entry.payload, null, 2)}</pre>}
      </details>)}
    </div>
  </aside>;
}
