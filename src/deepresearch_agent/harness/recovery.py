"""类型化的重试/重新规划决策，以及启动时的恢复扫描。"""

from __future__ import annotations

from dataclasses import dataclass

from deepresearch_agent.harness.errors import AppError, ErrorCode
from deepresearch_agent.persistence.repositories import RunRepository


@dataclass(frozen=True)
class RecoveryDecision:
    action: str
    reason: str


def classify_verification_failures(failures: list[str]) -> RecoveryDecision:
    kinds = set(failures)
    # 证据/信息源失败无法通过改写文字修复，必须先回到规划和检索阶段，
    # 再生成新的报告。
    if kinds & {"min_evidence", "claim_support", "source_match"}:
        return RecoveryDecision("replan", ",".join(sorted(kinds)))
    if kinds and kinds.issubset({"citation_integrity", "required_section", "report_consistency", "source_diversity", "evidence_card_coverage"}):
        return RecoveryDecision("repair_report", ",".join(sorted(kinds)))
    return RecoveryDecision("fail", ",".join(sorted(kinds)) or "unknown")


def classify_exception(exc: Exception) -> RecoveryDecision:
    """区分传输重试、认证失败，以及计划/契约恢复。"""
    if isinstance(exc, AppError):
        if exc.code in {ErrorCode.TAVILY_AUTH_FAILED, ErrorCode.TAVILY_API_KEY_MISSING, ErrorCode.SOURCE_POLICY_VIOLATION}:
            return RecoveryDecision("fail", exc.code.value)
        if exc.retryable or exc.code in {ErrorCode.TAVILY_RATE_LIMITED, ErrorCode.RETRIEVAL_TIMEOUT}:
            return RecoveryDecision("retry_same", exc.code.value)
    if isinstance(exc, (TimeoutError, ConnectionError)):
        return RecoveryDecision("retry_same", type(exc).__name__)
    return RecoveryDecision("fail", type(exc).__name__)


class RecoveryManager:
    def __init__(self, run_repository: RunRepository):
        self.run_repository = run_repository

    async def scan(self, *, auto_resume: bool = True) -> list[str]:
        interrupted = await self.run_repository.mark_expired_leases_interrupted()
        if not auto_resume:
            return interrupted
        recoverable = await self.run_repository.list_recoverable()
        return [run.run_id for run in recoverable if run.status == "interrupted"]
