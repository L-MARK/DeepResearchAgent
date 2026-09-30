import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { ErrorState } from "../components/ErrorState";

export function SystemStatus() {
  const query = useQuery({queryKey: ["health"], queryFn: api.health, refetchInterval: 15_000});
  const checkLabels: Record<string, string> = {functional: "功能检查", read_write: "读写检查", tcp_only: "仅连接检查", configuration_only: "仅配置检查"};
  return <main className="management-page"><header><span className="eyebrow">LOCAL RUNTIME</span><h1>系统状态</h1><p>状态只显示服务可用性和检查深度，不返回任何密钥。连接正常不代表完整研究链路已经通过。</p>{query.data?.checked_at && <small>最近检查：{new Date(query.data.checked_at).toLocaleString()}</small>}</header><ErrorState error={query.error} /><div className="status-grid">{Object.entries(query.data?.components ?? {}).map(([name, value]) => <div className="status-card" key={name}><span className={`health-dot ${value.status}`} /> <strong>{name}</strong><small>{value.status} · {checkLabels[value.check_level ?? ""] ?? "基础检查"}</small>{value.reason && <small>{value.reason}</small>}</div>)}</div></main>;
}
