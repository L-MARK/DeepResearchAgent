"""两个研究工作流共用的、与信息源无关的检索契约。"""

from __future__ import annotations

from dataclasses import dataclass, field
import asyncio
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Literal, Optional, Protocol

from deepresearch_agent.agents.multi_agent.core.retrieval_result import RetrievalResult
from deepresearch_agent.harness.contracts import SourceMode
from deepresearch_agent.harness.errors import AppError, ErrorCode


SearchDepth = Literal["basic", "advanced"]


@dataclass(frozen=True)
class SearchFilters:
    """可移植的过滤条件；Provider 会忽略不支持的可选字段。"""

    strategy: Optional[str] = None
    include_domains: tuple[str, ...] = ()
    exclude_domains: tuple[str, ...] = ()
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    topic: Optional[Literal["general", "news", "finance"]] = None
    extra: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class ToolCallContext:
    run_id: str
    source_mode: SourceMode
    task_id: Optional[str] = None
    tool_call_id: Optional[str] = None


class RetrievalProvider(Protocol):
    mode: SourceMode
    provider_name: str

    async def search(
        self,
        query: str,
        *,
        top_k: int,
        search_depth: SearchDepth,
        filters: SearchFilters,
        call_context: ToolCallContext,
    ) -> list[RetrievalResult]: ...


class TimeoutBoundProvider:
    """将每个 Run 不可变的工具超时应用到选定的 Provider。"""

    def __init__(self, provider: RetrievalProvider, *, timeout_seconds: int):
        if timeout_seconds < 1:
            raise ValueError("timeout_seconds 必须大于等于 1")
        self._provider = provider
        self._timeout_seconds = timeout_seconds
        self.mode = provider.mode
        self.provider_name = provider.provider_name

    async def search(
        self,
        query: str,
        *,
        top_k: int,
        search_depth: SearchDepth,
        filters: SearchFilters,
        call_context: ToolCallContext,
    ) -> list[RetrievalResult]:
        try:
            return await asyncio.wait_for(
                self._provider.search(
                    query, top_k=top_k, search_depth=search_depth,
                    filters=filters, call_context=call_context,
                ),
                timeout=self._timeout_seconds,
            )
        except TimeoutError as exc:
            raise AppError(
                ErrorCode.RETRIEVAL_TIMEOUT,
                f"{self.provider_name} 检索超过 Run 工具超时限制",
                retryable=True,
                details={"timeout_seconds": self._timeout_seconds},
            ) from exc


def run_async_from_sync(awaitable_factory):
    """让旧版同步入口能够执行 Provider 协程。"""
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(awaitable_factory())
    with ThreadPoolExecutor(max_workers=1) as pool:
        return pool.submit(lambda: asyncio.run(awaitable_factory())).result()


__all__ = [
    "RetrievalProvider",
    "TimeoutBoundProvider",
    "SearchDepth",
    "SearchFilters",
    "SourceMode",
    "ToolCallContext",
    "run_async_from_sync",
]
