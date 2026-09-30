import { FormEvent, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { ErrorState } from "../components/ErrorState";
import { CuratedMemory } from "../types/api";

const STATUS_LABELS: Record<string, string> = {candidate: "候选", active: "已启用", rejected: "已拒绝", archived: "已归档", expired: "已过期"};
const KIND_LABELS: Record<string, string> = {preference: "偏好", fact: "事实", decision: "决策", lesson: "经验", note: "备注"};

function isLegacyFullReply(item: CuratedMemory): boolean {
  return item.content.length > 600 || /(^|\n)#{1,3}\s+(报告|研究|结论)|<think>|Final Information|\[E\d+\]/i.test(item.content);
}

export function MemoryPage() {
  const client = useQueryClient();
  const [target, setTarget] = useState<"user" | "project">("project");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CuratedMemory | null>(null);
  const [content, setContent] = useState("");
  const [kind, setKind] = useState("note");
  const [provenance, setProvenance] = useState("user:explicit");
  const [activate, setActivate] = useState(false);
  const [expiresAt, setExpiresAt] = useState("");
  const [mutationError, setMutationError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);
  const query = useQuery({queryKey: ["memories"], queryFn: api.memories});
  const capacity = useQuery({queryKey: ["memory-capacity"], queryFn: api.memoryCapacity});
  const allForTarget = useMemo(() => query.data?.items.filter((item) => item.target === target) ?? [], [query.data, target]);
  const items = statusFilter === "all" ? allForTarget : allForTarget.filter((item) => item.status === statusFilter);
  const usage = capacity.data?.targets[target];
  const counts = useMemo(() => allForTarget.reduce<Record<string, number>>((result, item) => ({...result, [item.status]: (result[item.status] ?? 0) + 1}), {}), [allForTarget]);
  async function refresh() { await Promise.all([client.invalidateQueries({queryKey: ["memories"]}), client.invalidateQueries({queryKey: ["memory-capacity"]})]); }
  function resetForm() { setEditing(null); setContent(""); setKind(target === "user" ? "preference" : "note"); setProvenance("user:explicit"); setActivate(false); setExpiresAt(""); setShowForm(false); }
  function edit(item: CuratedMemory) { setEditing(item); setContent(item.content); setKind(item.kind); setProvenance(item.provenance_refs.join(", ")); setActivate(item.status === "active"); setExpiresAt(item.expires_at?.slice(0, 16) ?? ""); setShowForm(true); setMutationError(null); }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!content.trim() || saving) return; setSaving(true); setMutationError(null);
    try {
      if (editing) await api.patchMemory(editing.memory_id, {content: content.trim(), expires_at: expiresAt ? new Date(expiresAt).toISOString() : null});
      else await api.createMemory({target, content: content.trim(), kind, provenance_refs: provenance.split(",").map((item) => item.trim()).filter(Boolean), activate});
      resetForm(); await refresh();
    } catch (error) { setMutationError(error); } finally { setSaving(false); }
  }
  async function changeStatus(id: string, status: string) { setMutationError(null); try { await api.patchMemory(id, {status}); await refresh(); } catch (error) { setMutationError(error); } }
  async function remove(item: CuratedMemory) { if (!window.confirm(`永久移除这条 ${item.target} Memory？审计记录会保留。`)) return; setMutationError(null); try { await api.deleteMemory(item.memory_id); await refresh(); } catch (error) { setMutationError(error); } }

  return <main className="management-page memory-page"><header><span className="eyebrow">CURATED MEMORY</span><h1>精选持久记忆</h1><p>一个 Memory 系统，按“用户信息”和“项目记忆”两个 target 管理。候选必须确认后才能进入新 Session；已经开始的 Session 使用冻结快照，不会被后续编辑悄悄改变。</p></header><ErrorState error={query.error ?? capacity.error ?? mutationError} />
    <section className="memory-toolbar"><div className="memory-target-tabs" role="tablist"><button className={target === "user" ? "active" : ""} onClick={() => {resetForm(); setTarget("user"); setKind("preference");}}>用户信息 <span>{query.data?.items.filter((item) => item.target === "user").length ?? 0}</span></button><button className={target === "project" ? "active" : ""} onClick={() => {resetForm(); setTarget("project"); setKind("note");}}>项目记忆 <span>{query.data?.items.filter((item) => item.target === "project").length ?? 0}</span></button></div><button className="primary-action" onClick={() => {resetForm(); setShowForm(true);}}>＋ 新增候选</button></section>
    {usage && <section className={`memory-capacity${usage.usage_ratio >= 0.8 ? " warning" : ""}`} data-testid="memory-capacity"><div><strong>{target === "user" ? "用户信息" : "项目记忆"}容量</strong><span>{Math.round(usage.usage_ratio * 100)}%</span></div><div className="capacity-track"><i style={{width: `${Math.min(100, usage.usage_ratio * 100)}%`}} /></div><small>{usage.tokens} / {usage.max_tokens} tokens · {usage.chars} / {usage.max_chars} chars{usage.usage_ratio >= 0.8 ? " · 接近硬上限，请合并或归档条目" : ""}</small></section>}
    {showForm && <form className="memory-editor" onSubmit={submit}><div className="memory-editor-head"><div><span className="eyebrow">{editing ? "EDIT MEMORY" : "NEW CANDIDATE"}</span><h2>{editing ? "编辑 Memory" : `新增${target === "user" ? "用户信息" : "项目记忆"}候选`}</h2></div><button type="button" className="icon-button" onClick={resetForm}>×</button></div><label className="wide">内容<textarea autoFocus rows={4} value={content} onChange={(event) => setContent(event.target.value)} placeholder="只记录跨 Session 仍然有价值的偏好、事实或决策。" /></label><label>类型<select value={kind} disabled={Boolean(editing)} onChange={(event) => setKind(event.target.value)}>{Object.entries(KIND_LABELS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label>有效期（可选）<input type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} /></label><label className="wide">来源引用<input value={provenance} disabled={Boolean(editing)} onChange={(event) => setProvenance(event.target.value)} placeholder="message:xxx, user:explicit" /><small>多个引用用英文逗号分隔；用于审计 Memory 从哪里产生。</small></label>{!editing && <label className="memory-checkbox"><input type="checkbox" checked={activate} onChange={(event) => setActivate(event.target.checked)} />创建后立即启用（通常建议先作为候选审核）</label>}<div className="memory-form-actions"><button type="button" onClick={resetForm}>取消</button><button className="primary-action" disabled={saving || !content.trim()}>{saving ? "保存中…" : "保存"}</button></div></form>}
    <section className="memory-status-tabs">{["all", "candidate", "active", "rejected", "archived"].map((status) => <button className={statusFilter === status ? "active" : ""} key={status} onClick={() => setStatusFilter(status)}>{status === "all" ? "全部" : STATUS_LABELS[status]} <span>{status === "all" ? allForTarget.length : counts[status] ?? 0}</span></button>)}</section>
    <div className="data-table memory-list" data-testid="memory-list">{items.length ? items.map((item) => {
      const legacy = isLegacyFullReply(item);
      return <article className={`data-row memory-row status-${item.status}${legacy ? " is-legacy-reply" : ""}`} key={item.memory_id}><div className="memory-row-main"><div className="memory-row-meta"><span className={`memory-status ${item.status}`}>{STATUS_LABELS[item.status] ?? item.status}</span><span>{KIND_LABELS[item.kind] ?? item.kind}</span>{item.created_by === "llm_review" && <span className="memory-origin">LLM 提取{typeof item.confidence === "number" ? ` · ${Math.round(item.confidence * 100)}%` : ""}</span>}{legacy && <span className="memory-legacy-badge">旧版完整回复 · 不可启用</span>}<code>{item.memory_id}</code></div>{legacy ? <details className="memory-legacy-content"><summary>{item.content.slice(0, 180)}… <b>查看历史原文</b></summary><pre>{item.content}</pre></details> : <p>{item.content}</p>}<small>provenance：{item.provenance_refs.length ? item.provenance_refs.join(", ") : "未标注"} · 更新于 {new Date(item.updated_at).toLocaleString()}{item.expires_at ? ` · 有效至 ${new Date(item.expires_at).toLocaleString()}` : ""}</small></div><div className="row-actions memory-actions"><button onClick={() => edit(item)}>编辑</button>{item.status !== "active" && <button disabled={legacy} title={legacy ? "完整 AI 回复不是可复用的原子记忆，请编辑为简短事实后再启用" : undefined} onClick={() => changeStatus(item.memory_id, "active")}>确认启用</button>}{item.status !== "rejected" && <button onClick={() => changeStatus(item.memory_id, "rejected")}>拒绝</button>}{item.status !== "archived" && <button onClick={() => changeStatus(item.memory_id, "archived")}>归档</button>}<button className="danger" onClick={() => remove(item)}>删除</button></div></article>;
    }) : <div className="empty-state">当前筛选下没有 Memory。</div>}</div>
  </main>;
}
