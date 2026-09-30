import { Evidence } from "../types/api";

export function EvidenceDrawer({ item, onClose }: {item: Evidence | null; onClose: () => void}) {
  if (!item) return null;
  const url = typeof item.metadata.url === "string" ? item.metadata.url : item.source_id;
  return <div className="drawer-backdrop" onClick={onClose}><aside className="evidence-drawer" onClick={(event) => event.stopPropagation()}>
    <button className="icon-button close" onClick={onClose} aria-label="关闭">×</button>
    <span className="eyebrow">[Web] · {item.provider}</span>
    <h2>{item.title || "证据详情"}</h2><p>{item.summary}</p>
    <dl><dt>Evidence ID</dt><dd>{item.evidence_id}</dd><dt>来源定位</dt><dd>{item.source_id}</dd><dt>相关度</dt><dd>{item.score.toFixed(2)}</dd></dl>
    {/^https?:\/\//i.test(url) && <a className="primary-link" href={url} target="_blank" rel="noopener noreferrer">打开原网页 ↗</a>}
  </aside></div>;
}
