import { ReactNode, useEffect, useMemo, useState } from "react";
import DOMPurify from "dompurify";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { VERIFICATION_LABELS } from "./stageMeta";
import { Evidence, Report } from "../types/api";

type ReportTab = "report" | "evidence" | "verification";

export function ReportView({ report, evidence, onEvidence }: {report?: Report | null; evidence: Evidence[]; onEvidence: (item: Evidence) => void}) {
  const [tab, setTab] = useState<ReportTab>("report");
  useEffect(() => setTab("report"), [report?.run_id]);
  const sanitized = useMemo(() => DOMPurify.sanitize(report?.content ?? "", { ALLOWED_TAGS: [] }), [report?.content]);
  const citationIds = useMemo(() => {
    const ids: string[] = [];
    for (const match of sanitized.matchAll(/\[(?:\^)?(ev_[\w-]+)\]/g)) if (!ids.includes(match[1])) ids.push(match[1]);
    return ids;
  }, [sanitized]);
  const citationNumbers = useMemo(() => new Map(citationIds.map((id, index) => [id, index + 1])), [citationIds]);
  const markdown = useMemo(() => sanitized.replace(/\[(?:\^)?(ev_[\w-]+)\](?!\()/g, (_, id: string) => `[${citationNumbers.get(id) ?? "?"}](#evidence-${id})`), [sanitized, citationNumbers]);
  const headings = useMemo(() => report?.sections?.length ? report.sections : [...sanitized.matchAll(/^(#{1,4})\s+(.+?)\s*$/gm)].map((match, index) => ({id: `report-section-${index}`, title: match[2], level: match[1].length})), [report?.sections, sanitized]);
  const evidenceById = useMemo(() => new Map(evidence.map((item) => [item.evidence_id, item])), [evidence]);
  const indexedEvidence = report?.evidence_index ?? evidence.map((item) => ({...item, url: typeof item.metadata.url === "string" ? item.metadata.url : item.source_id}));
  if (!report?.content) return null;

  function openCitation(id: string) {
    const item = evidenceById.get(id);
    if (item) onEvidence(item); else setTab("evidence");
  }
  function jumpToHeading(index: number) {
    document.querySelectorAll(".report-article h1, .report-article h2, .report-article h3, .report-article h4")[index]?.scrollIntoView({behavior: "smooth", block: "start"});
  }

  return <section className="report-view">
    <div className="report-toolbar">
      <div className="report-tabs" role="tablist" aria-label="报告视图">
        <button className={tab === "report" ? "active" : ""} onClick={() => setTab("report")}>报告</button>
        <button className={tab === "evidence" ? "active" : ""} onClick={() => setTab("evidence")}>证据 <span>{indexedEvidence.length}</span></button>
        <button className={tab === "verification" ? "active" : ""} onClick={() => setTab("verification")}>验证 <span>{report.verification.filter((item) => item.passed).length}/{report.verification.length}</span></button>
      </div>
      <span className={`report-mode ${report.report_mode === "budget_fallback" ? "fallback" : ""}`}>{report.report_mode === "budget_fallback" ? "预算保护报告" : "完整研究报告"}</span>
    </div>

    {tab === "report" && <div className="report-reading-layout">
      <nav className="report-toc" aria-label="报告目录"><strong>目录</strong>{headings.map((heading, index) => <button key={`${heading.id}-${index}`} className={`level-${heading.level}`} onClick={() => jumpToHeading(index)}>{heading.title}</button>)}</nav>
      <article className="report-article">
        {report.report_mode === "budget_fallback" && <div className="report-notice"><strong>预算保护模式</strong><span>正文仅呈现可确定交付的主要发现；完整证据保存在“证据”视图。</span></div>}
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
          a: ({href, children}) => {
            const match = href?.match(/^#evidence-(ev_[\w-]+)$/);
            if (match) return <button className="citation-link" title={evidenceById.get(match[1])?.title ?? match[1]} onClick={() => openCitation(match[1])}>{children}</button>;
            if (!href || !/^https?:\/\//i.test(href)) return <span>{children}</span>;
            return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
          },
          table: ({children}) => <div className="report-table-scroll"><table>{children}</table></div>,
        }}>{markdown}</ReactMarkdown>
      </article>
      <aside className="report-citation-rail"><strong>本文引用</strong>{citationIds.slice(0, 12).map((id) => <button key={id} onClick={() => openCitation(id)}><span>[{citationNumbers.get(id)}]</span><em>{evidenceById.get(id)?.title || "证据详情"}</em></button>)}{citationIds.length === 0 && <p>正文暂无可解析引用。</p>}</aside>
    </div>}

    {tab === "evidence" && <div className="report-evidence-panel">
      <header><div><h3>证据台账</h3><p>全部证据独立保存；正文只显示支撑结论的引用。</p></div><span>{indexedEvidence.length} 条</span></header>
      <div className="report-evidence-grid">{indexedEvidence.map((entry, index) => {
        const item = evidenceById.get(entry.evidence_id); const url = entry.url || entry.source_id;
        return <article key={entry.evidence_id}><div className="report-evidence-head"><span>{citationNumbers.has(entry.evidence_id) ? `[${citationNumbers.get(entry.evidence_id)}]` : `E${index + 1}`}</span><small>{entry.provider} · {entry.score.toFixed(2)}</small></div><h4>{entry.title || "未命名来源"}</h4><p>{entry.summary || "暂无摘要"}</p><footer><span>{safeDomain(url)}</span>{item && <button onClick={() => onEvidence(item)}>查看证据</button>}</footer></article>;
      })}</div>
    </div>}

    {tab === "verification" && <div className="report-verification-panel"><header><h3>交付验证</h3><p>研究结论、引用和证据台账分别核查。</p></header><div className="verification-row">{report.verification.map((check) => <article key={check.kind} className={check.passed ? "pass" : "fail"}><span>{check.passed ? "✓" : "!"}</span><div><strong>{VERIFICATION_LABELS[check.kind] ?? check.kind}</strong><small>{check.passed ? "已通过" : "需要检查"}</small></div></article>)}</div></div>}
  </section>;
}

function safeDomain(value?: string | null): ReactNode {
  if (!value) return "未知来源";
  try { return new URL(value).hostname; } catch { return value.slice(0, 48); }
}
