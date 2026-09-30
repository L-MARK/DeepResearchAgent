export function ErrorState({ error, onRetry }: {error: unknown; onRetry?: () => void}) {
  if (!error) return null;
  const value = error as {code?: string; message?: string; retryable?: boolean};
  const advice: Record<string, string> = {TAVILY_API_KEY_MISSING: "请在后端 .env 配置 TAVILY_API_KEY。", SOURCE_UNAVAILABLE: "请检查 Web 搜索配置。", NO_SOURCE_EVIDENCE: "当前没有足够的 Web 证据，请稍后重试或缩小问题范围。", INSUFFICIENT_SOURCE_EVIDENCE: "当前 Web 证据不足以支撑所需报告深度，请缩小问题范围后重试。", NETWORK_ERROR: "请确认 FastAPI 后端正在运行。"};
  return <div className="error-state"><strong>{value.code ?? "请求失败"}</strong><span>{value.message ?? String(error)}</span>{advice[value.code ?? ""] && <small>{advice[value.code ?? ""]}</small>}{onRetry && <button onClick={onRetry}>重试</button>}</div>;
}
