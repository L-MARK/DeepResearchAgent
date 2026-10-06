"""仅使用 Web 的迭代式研究工具。

本模块有意不持有文档索引、图连接或本地知识库回退路径。
每条证据都来自注入的 Web Provider，从而可以在 Run 层统一执行来源追踪和信息源策略。
"""

from __future__ import annotations

import asyncio
import inspect
import re
import time
import uuid
from typing import Any, AsyncGenerator, Dict, List, Optional

from langchain_core.tools import BaseTool

from deepresearch_agent.config.settings import TAVILY_MAX_RESULTS
from deepresearch_agent.harness.contracts import SourceMode
from deepresearch_agent.retrieval.base import (
    RetrievalProvider,
    SearchFilters,
    ToolCallContext,
    run_async_from_sync,
)
from deepresearch_agent.search.tool.base import BaseSearchTool


class DeepResearchTool(BaseSearchTool):
    """通过 Web Provider 执行有界的多查询研究。"""

    def __init__(
        self,
        provider: Optional[RetrievalProvider] = None,
        run_id: Optional[str] = None,
        *,
        max_iterations: int = 2,
        progress_callback=None,
    ) -> None:
        self.retrieval_provider = provider
        self.run_id = run_id or f"run_{uuid.uuid4().hex}"
        self.max_iterations = max(1, int(max_iterations))
        self.progress_callback = progress_callback
        self.provider_results: list[Any] = []
        self.provider_calls: list[dict[str, Any]] = []
        self.execution_logs: list[str] = []
        self.all_retrieved_info: list[str] = []
        super().__init__(cache_dir="./cache/web_research", enable_vector_cache=False)

    def _setup_chains(self) -> None:
        # 答案合成有意放在 _synthesize_answer 中执行，
        # 这样 Provider 结果账本仍可供 Harness 使用。
        pass

    @staticmethod
    def extract_keywords(query: str) -> Dict[str, List[str]]:
        tokens = [
            token.strip()
            for token in re.findall(r"[A-Za-z0-9_\u4e00-\u9fff]{2,}", str(query or ""))
            if token.strip()
        ]
        deduped = list(dict.fromkeys(tokens))
        return {"high_level": deduped[:5], "low_level": deduped[5:12] or deduped[:5]}

    async def _progress(self, kind: str, **payload: Any) -> None:
        callback = self.progress_callback
        if callback is None:
            return
        message = {"kind": kind, **payload}
        result = callback(message)
        if inspect.isawaitable(result):
            await result

    @staticmethod
    def _result_text(result: Any) -> str:
        evidence = getattr(result, "evidence", None)
        if isinstance(evidence, dict):
            return str(evidence.get("text") or evidence.get("content") or evidence)
        return str(evidence or "")

    def _provider_results_to_legacy(self, results: list[Any]) -> dict[str, Any]:
        chunks: list[dict[str, Any]] = []
        documents: list[dict[str, Any]] = []
        for index, result in enumerate(results):
            metadata = getattr(result, "metadata", None)
            source_id = str(getattr(metadata, "source_id", "") or f"result-{index}")
            text = self._result_text(result)
            chunks.append({
                "chunk_id": getattr(result, "result_id", None) or f"chunk-{index}",
                "doc_id": source_id,
                "text": text,
                "content_with_weight": text,
                "title": getattr(metadata, "title", None),
                "url": getattr(metadata, "url", None),
                "source_id": source_id,
                "source_mode": "web",
                "score": float(getattr(result, "score", 0.5) or 0.5),
            })
            documents.append({
                "doc_id": source_id,
                "title": getattr(metadata, "title", None) or source_id,
                "url": getattr(metadata, "url", None),
            })
        return {
            "chunks": chunks,
            "doc_aggs": documents,
            "entities": [],
            "relationships": [],
        }

    async def _async_search(self, query: str) -> dict[str, Any]:
        provider = self.retrieval_provider
        if provider is None:
            from deepresearch_agent.retrieval.router import create_default_router

            provider = create_default_router().for_mode(SourceMode.WEB)
            self.retrieval_provider = provider
        if provider.mode != SourceMode.WEB:
            raise ValueError("DeepResearchTool 仅支持 Web 信息源")

        tool_call_id = f"call_{uuid.uuid4().hex[:12]}"
        results = await provider.search(
            str(query),
            top_k=TAVILY_MAX_RESULTS,
            search_depth="advanced",
            filters=SearchFilters(),
            call_context=ToolCallContext(
                run_id=self.run_id,
                source_mode=SourceMode.WEB,
                tool_call_id=tool_call_id,
            ),
        )
        self.provider_results.extend(results)
        self.provider_calls.append({
            "tool_call_id": tool_call_id,
            "query": str(query),
            "results": list(results),
        })
        return self._provider_results_to_legacy(results)

    def _search_current_provider(self, query: str) -> dict[str, Any]:
        return run_async_from_sync(lambda: self._async_search(query))

    async def _generate_followup(self, query: str, evidence: list[str]) -> Optional[str]:
        if not evidence or self.max_iterations < 2:
            return None
        prompt = (
            "根据用户问题和已有网页证据，生成一个用于补充验证的简短搜索问题。"
            "只输出问题本身；如果不需要补充检索，输出 NONE。\n"
            f"用户问题：{query}\n已有证据：{' '.join(evidence[-2:])[:5000]}"
        )
        try:
            response = await asyncio.to_thread(self.llm.invoke, prompt)
            text = getattr(response, "content", response)
            text = str(text).strip()
            if not text or text.upper() == "NONE":
                return None
            return text.splitlines()[0][:500]
        except Exception:
            return None

    def _synthesize_answer(self, query: str, results: list[Any]) -> str:
        if not results:
            return f"未从 Web 检索到足以回答“{query}”的证据。"
        evidence_lines = []
        for item in results[:10]:
            text = re.sub(r"\s+", " ", self._result_text(item)).strip()
            if not text:
                continue
            evidence_lines.append(f"- {text[:1800]} [{item.result_id}]")
        context = "\n".join(evidence_lines)
        prompt = (
            "你是严谨的 Web 研究助手。请仅根据下面的网页证据回答用户问题，"
            "不要补造证据；每个事实性要点在句末保留对应的 [result_id] 引用。"
            "如果证据不足，请明确说明。\n\n"
            f"用户问题：{query}\n\n网页证据：\n{context}"
        )
        try:
            response = self.llm.invoke(prompt)
            answer = getattr(response, "content", response)
            answer = str(answer).strip()
            if answer:
                return answer
        except Exception:
            pass
        return "\n".join(evidence_lines) or f"未找到与“{query}”相关的有效网页证据。"

    async def _run_research(self, query: str) -> dict[str, Any]:
        self.execution_logs = []
        self.provider_results = []
        self.provider_calls = []
        self.all_retrieved_info = []
        started = time.time()
        queries = [str(query).strip()]
        seen_queries: set[str] = set()

        for iteration in range(self.max_iterations):
            await self._progress("iteration", iteration_index=iteration)
            if not queries:
                break
            current = queries.pop(0)
            if not current or current in seen_queries:
                continue
            seen_queries.add(current)
            await self._progress("search", iteration_index=iteration, query=current)
            legacy = await self._async_search(current)
            results = [
                item for call in self.provider_calls if call["query"] == current
                for item in call["results"]
            ]
            useful = [self._result_text(item) for item in results if self._result_text(item).strip()]
            self.all_retrieved_info.extend(useful)
            self.execution_logs.append(f"Web 搜索：{current}（{len(results)} 条结果）")
            await self._progress(
                "search",
                iteration_index=iteration,
                query=current,
                result_count=len(results),
                found_useful=bool(useful),
                useful_info_preview=(useful[0][:200] if useful else None),
            )
            await self._progress("iteration_done", iteration_index=iteration)
            if iteration + 1 < self.max_iterations:
                followup = await self._generate_followup(str(query), self.all_retrieved_info)
                if followup and followup not in seen_queries:
                    queries.append(followup)

        answer = self._synthesize_answer(str(query), self.provider_results)
        await self._progress(
            "answer",
            iteration_index=max(0, self.max_iterations - 1),
            answer_char_count=len(answer),
        )
        self.performance_metrics["total_time"] = time.time() - started
        return {
            "thinking_process": "已完成 Web 检索并根据可追溯证据生成回答。",
            "thinking": "已完成 Web 检索并根据可追溯证据生成回答。",
            "answer": answer,
            "reference": self._provider_results_to_legacy(self.provider_results),
            "retrieved_info": list(self.all_retrieved_info),
            "execution_logs": list(self.execution_logs),
        }

    def thinking(self, query: str) -> dict[str, Any]:
        return run_async_from_sync(lambda: self._run_research(str(query)))

    def search(self, query_input: Any) -> str:
        query = query_input.get("query", "") if isinstance(query_input, dict) else str(query_input)
        return str(self.thinking(query).get("answer", ""))

    async def thinking_stream(self, query: str) -> AsyncGenerator[Any, None]:
        yield "正在分析问题并检索 Web 来源……"
        result = await self._run_research(str(query))
        yield result

    async def search_stream(self, query_input: Any) -> AsyncGenerator[Any, None]:
        query = query_input.get("query", "") if isinstance(query_input, dict) else str(query_input)
        result = await self._run_research(query)
        yield result.get("answer", "")

    def get_tool(self) -> BaseTool:
        outer = self

        class WebResearchTool(BaseTool):
            name: str = "deep_research"
            description: str = "Web 深度研究：执行有限轮次的联网检索并生成带证据引用的回答。"

            def _run(self_tool, query: Any) -> str:
                return outer.search(query)

            def _arun(self_tool, query: Any) -> str:
                raise NotImplementedError("异步执行未实现")

        return WebResearchTool()

    def get_thinking_tool(self) -> BaseTool:
        outer = self

        class WebThinkingTool(BaseTool):
            name: str = "deep_thinking"
            description: str = "Web 深度研究（返回研究过程和最终答案）。"

            def _run(self_tool, query: Any) -> dict[str, Any]:
                value = query.get("query", "") if isinstance(query, dict) else str(query)
                return outer.thinking(value)

            def _arun(self_tool, query: Any) -> dict[str, Any]:
                raise NotImplementedError("异步执行未实现")

        return WebThinkingTool()

    def get_thinking_stream_tool(self) -> BaseTool:
        outer = self

        class WebThinkingStreamTool(BaseTool):
            name: str = "deep_thinking_stream"
            description: str = "Web 深度研究流式工具。"

            def _run(self_tool, query: Any) -> dict[str, Any]:
                value = query.get("query", "") if isinstance(query, dict) else str(query)
                return outer.thinking(value)

            async def _arun(self_tool, query: Any) -> dict[str, Any]:
                value = query.get("query", "") if isinstance(query, dict) else str(query)
                return await outer._run_research(value)

        return WebThinkingStreamTool()


__all__ = ["DeepResearchTool"]
