import { ContextBlock, ContextInspector, ContextMessage } from "../types/api";

function shortHash(value?: string | null) {
  return value ? `${value.slice(0, 10)}…${value.slice(-8)}` : "—";
}

function MessageList({ messages }: { messages: ContextMessage[] }) {
  if (!messages.length) return <div className="drawer-empty compact">没有消息进入此上下文块。</div>;
  return <div className="context-message-list">{messages.map((message) => (
    <article className={`context-message${message.anchor ? " is-anchor" : ""}`} key={message.message_id}>
      <div><span className="context-role">{message.role}</span>{message.anchor && <span className="context-badge accent">命中</span>}<code>{message.message_id}</code></div>
      <p>{message.content}</p>
    </article>
  ))}</div>;
}

function BlockList({ title, blocks }: { title: string; blocks: ContextBlock[] }) {
  return <details className="context-group" open>
    <summary><strong>{title}</strong><span>{blocks.length} 个块 · {blocks.reduce((sum, block) => sum + block.token_count, 0)} tokens</span></summary>
    <div className="context-block-list">
      {blocks.map((block) => <details className="context-block" key={block.name}>
        <summary>
          <span><strong>{block.name}</strong><small>{block.source_type} · {block.trust_level}</small></span>
          <span className="context-block-metrics"><b>{block.token_count}</b> tokens{block.protected && <i>受保护</i>}{block.trimmed && <i className="danger">已裁剪</i>}</span>
        </summary>
        <div className="context-block-detail">
          <div className="context-kv"><span>优先级 {block.priority}</span><span>来源 ID：{block.source_ids.join(", ") || "系统策略"}</span></div>
          <pre>{block.content}</pre>
        </div>
      </details>)}
    </div>
  </details>;
}

function SummaryView({ summary }: { summary: Record<string, unknown> }) {
  const groups = ["decisions", "verified_facts", "completed", "unresolved", "constraints", "superseded"];
  if (!Object.keys(summary).length) return <div className="drawer-empty compact">当前对话未达到压缩阈值，无结构化摘要。</div>;
  return <div className="summary-grid">
    {typeof summary.goal === "string" && <div className="summary-item wide"><strong>目标</strong><p>{summary.goal}</p></div>}
    {groups.map((name) => {
      const values = Array.isArray(summary[name]) ? summary[name] as Array<unknown> : [];
      return <div className="summary-item" key={name}><strong>{name}</strong><span>{values.length}</span>
        {values.slice(0, 4).map((value, index) => <p key={index}>{typeof value === "string" ? value : String((value as Record<string, unknown>).text ?? JSON.stringify(value))}</p>)}
      </div>;
    })}
    <div className="summary-item wide"><strong>覆盖范围</strong><p>{Array.isArray(summary.covered_message_ids) ? summary.covered_message_ids.length : 0} 条消息 · 压缩前 {String(summary.source_token_count ?? 0)} tokens</p></div>
  </div>;
}

export function ContextInspectorView({ context }: { context?: ContextInspector | null }) {
  if (!context?.ready) return <div className="drawer-empty">上下文快照正在构建，完成后会在这里显示。</div>;
  const artifact = context.artifact_edit ?? {};
  const verification = context.artifact_verification;
  return <div className="context-inspector" data-testid="context-inspector">
    <section className="context-overview">
      <div><small>Memory 快照</small><strong>v{context.memory_snapshot_version}</strong></div>
      <div><small>输入预算</small><strong>{context.total_input_tokens} tokens</strong></div>
      <div><small>历史搜索</small><strong>{context.historical_recall_searched ? "已执行" : "未触发"}</strong></div>
      <div><small>Checkpoint</small><strong>{context.checkpoint?.verified ? "✓ 完整" : "待验证"}</strong></div>
    </section>

    <section className="context-meta">
      <span>稳定快照 <code title={context.stable_snapshot_id ?? ""}>{shortHash(context.stable_snapshot_id)}</code></span>
      <span>checkpoint v{context.checkpoint?.version ?? 0} · {context.checkpoint?.stage ?? "—"}</span>
      <span>状态 {context.status}</span>
    </section>

    <details className="context-group" open>
      <summary><strong>冻结的精选 Memory</strong><span>{context.curated_memory.length} 条</span></summary>
      {context.curated_memory.length === 0 ? <div className="drawer-empty compact">该 Session 创建时没有已启用的 Memory。</div> : <div className="context-memory-list">
        {context.curated_memory.map((memory) => <article key={memory.memory_id}>
          <div><span className={`context-badge ${memory.target}`}>{memory.target}</span><code>{memory.memory_id}</code></div>
          <p>{memory.content}</p>
          <small>来源：{memory.provenance_refs?.join(", ") || "未标注"}</small>
        </article>)}
      </div>}
    </details>

    <BlockList title="稳定上下文块" blocks={context.stable_blocks} />
    <BlockList title="动态上下文块" blocks={context.dynamic_blocks} />

    <details className="context-group">
      <summary><strong>当前 Session 消息</strong><span>{context.recent_messages.length} 条</span></summary>
      <MessageList messages={context.recent_messages} />
    </details>

    <details className="context-group">
      <summary><strong>结构化压缩摘要</strong><span>{Object.keys(context.session_summary).length ? "已生成" : "未触发"}</span></summary>
      <SummaryView summary={context.session_summary} />
    </details>

    <details className="context-group" open={context.historical_recall_searched}>
      <summary><strong>按需历史召回</strong><span>{context.historical_recall_searched ? `搜索过 · 命中 ${context.historical_recall.length}` : "未搜索"}</span></summary>
      {!context.historical_recall_searched && <div className="context-notice success">本轮问题不依赖过去对话，因此没有消耗历史搜索和上下文预算。</div>}
      {context.historical_recall_searched && context.historical_recall.length === 0 && <div className="context-notice">执行了历史搜索，但没有找到可信匹配。</div>}
      {context.historical_recall.map((hit) => <details className="history-hit" key={hit.session_id} open>
        <summary><span><strong>{hit.title}</strong><code>{hit.session_id}</code></span><span>{hit.detail} · 前 {hit.messages_before} / 后 {hit.messages_after}</span></summary>
        <p className="history-snippet">{hit.snippet}</p>
        <div className="bookend-label">开头 bookend</div><MessageList messages={hit.bookend_start} />
        <div className="bookend-label">命中窗口</div><MessageList messages={hit.messages} />
        <div className="bookend-label">结尾 bookend</div><MessageList messages={hit.bookend_end} />
      </details>)}
    </details>

    {context.artifact_edit && <details className="context-group" open>
      <summary><strong>报告局部编辑合同</strong><span>{String(artifact.target_heading ?? "目标章节")}</span></summary>
      <div className="artifact-contract">
        <dl><div><dt>操作</dt><dd>{String(artifact.operation)}</dd></div><div><dt>基础 Run</dt><dd><code>{String(artifact.base_run_id)}</code></dd></div><div><dt>目标章节</dt><dd>{String(artifact.target_heading)}</dd></div><div><dt>基础报告哈希</dt><dd><code>{shortHash(String(artifact.base_sha256))}</code></dd></div></dl>
        <h4>目标章节原文</h4><pre>{String(artifact.target_content ?? "")}</pre>
        <h4>保护章节校验</h4>
        {!verification?.available && <div className="context-notice">报告尚未生成，完成后校验非目标章节。</div>}
        {verification?.available && <div className="preserve-list">
          {verification.preserved_sections.map((section) => <div className={section.passed ? "pass" : "fail"} key={section.heading}>
            <span>{section.passed ? "✓" : "!"} {section.heading}</span><code>{shortHash(section.actual_sha256)}</code><strong>{section.passed ? "保持不变" : "校验失败"}</strong>
          </div>)}
          <div className={verification.target_changed ? "pass" : "fail"}><span>{verification.target_changed ? "✓" : "!"} {verification.target_heading}</span><strong>{verification.target_changed ? "已修改" : "未检测到变化"}</strong></div>
        </div>}
      </div>
    </details>}

    <details className="context-group">
      <summary><strong>检索与裁剪轨迹</strong><span>{context.retrieval_trace.length} 项</span></summary>
      <div className="trace-table"><div className="trace-head"><span>块</span><span>来源 / 信任</span><span>Tokens</span><span>状态</span></div>
        {context.retrieval_trace.map((trace) => <div key={trace.name}><span><strong>{trace.name}</strong><small>{trace.source_ids.join(", ") || "—"}</small></span><span>{trace.source_type}<small>{trace.trust_level}</small></span><span>{trace.tokens}</span><span className={trace.trimmed ? "danger" : "success"}>{trace.trimmed ? "已裁剪" : "已保留"}</span></div>)}
      </div>
    </details>
  </div>;
}
