"""Web-only Deep Research agent facade."""

from __future__ import annotations

from typing import Any, AsyncGenerator, Dict, List, Optional

from langchain_core.messages import AIMessage

from deepresearch_agent.agents.base import BaseAgent
from deepresearch_agent.harness.contracts import SourceMode
from deepresearch_agent.retrieval.base import RetrievalProvider
from deepresearch_agent.search.tool.deep_research_tool import DeepResearchTool


class DeepResearchAgent(BaseAgent):
    """Expose the legacy agent API while using only the Web retrieval path."""

    def __init__(
        self,
        *,
        retrieval_provider: Optional[RetrievalProvider] = None,
        run_id: Optional[str] = None,
    ) -> None:
        if retrieval_provider is not None and retrieval_provider.mode != SourceMode.WEB:
            raise ValueError("DeepResearchAgent 仅支持 Web 信息源")
        self.retrieval_provider = retrieval_provider
        self.run_id = run_id
        self.show_thinking = False
        self.research_tool = DeepResearchTool(provider=retrieval_provider, run_id=run_id)
        self.stream_tool = self.research_tool.get_thinking_stream_tool()
        self.session_context: dict[str, Any] = {}
        self.cache_dir = "./cache/web_research_agent"
        super().__init__(cache_dir=self.cache_dir, enable_vector_cache=False)

    def _setup_chains(self) -> None:
        # 由 Provider 驱动的研究工具负责检索和答案合成。
        pass

    def _setup_tools(self) -> List:
        return [self.research_tool.get_tool(), self.stream_tool]

    def _add_retrieval_edges(self, workflow) -> None:
        workflow.add_edge("retrieve", "generate")

    def _extract_keywords(self, query: str) -> Dict[str, List[str]]:
        return self.research_tool.extract_keywords(query)

    @staticmethod
    def _answer_from_result(result: Any) -> str:
        if isinstance(result, dict):
            return str(result.get("answer") or result.get("final_answer") or result.get("response") or "")
        return str(result or "")

    def _generate_node(self, state):
        messages = state.get("messages", [])
        question = str(messages[0].content if messages else "")
        raw = messages[-1].content if messages else ""
        answer = self._answer_from_result(raw)
        if not answer:
            answer = self.research_tool.search(question)
        return {"messages": [AIMessage(content=answer)]}

    def ask(
        self,
        query: str,
        thread_id: str = "default",
        recursion_limit: Optional[int] = None,
        show_thinking: bool = False,
        *,
        bypass_cache: bool = False,
    ) -> Any:
        safe_query = str(query).strip()
        if not bypass_cache:
            cached = self.cache_manager.get(safe_query, thread_id=thread_id)
            if cached:
                return cached
        result = self.research_tool.thinking(safe_query) if show_thinking else self.research_tool.search(safe_query)
        answer = self._answer_from_result(result)
        if answer and not bypass_cache:
            self.cache_manager.set(safe_query, answer, thread_id=thread_id)
        return result if show_thinking else answer

    def ask_with_thinking(
        self,
        query: str,
        thread_id: str = "default",
    ) -> dict[str, Any]:
        result = self.research_tool.thinking(str(query))
        if isinstance(result, dict):
            result.setdefault("execution_logs", [])
            return result

        # 即使注入的或旧版研究工具只返回答案文本，而不是结构化结果，
        # 也要保持旧 API 的返回结构稳定。
        return {
            "answer": str(result or ""),
            "thinking": "",
            "execution_logs": [],
        }

    async def ask_stream(
        self,
        query: str,
        thread_id: str = "default",
        recursion_limit: Optional[int] = None,
        show_thinking: bool = False,
    ) -> AsyncGenerator[Any, None]:
        stream = self.research_tool.thinking_stream(query) if show_thinking else self.research_tool.search_stream(query)
        async for chunk in stream:
            if isinstance(chunk, dict):
                answer = self._answer_from_result(chunk)
                if answer:
                    yield answer
            elif chunk:
                yield chunk

    def close(self) -> None:
        super().close()
        self.research_tool.close()


__all__ = ["DeepResearchAgent"]
