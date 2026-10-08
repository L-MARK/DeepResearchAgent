import asyncio
import json
from pathlib import Path

import pytest

from deepresearch_agent.agents.multi_agent.core.plan_spec import PlanExecutionSignal, TaskGraph, TaskNode
from deepresearch_agent.agents.multi_agent.core.retrieval_result import RetrievalMetadata, RetrievalResult
from deepresearch_agent.agents.multi_agent.core.state import PlanExecuteState
from deepresearch_agent.agents.multi_agent.executor.retrieval_executor import RetrievalExecutor
from deepresearch_agent.agents.multi_agent.planner.plan_reviewer import PlanReviewer
from deepresearch_agent.agents.multi_agent.planner.task_decomposer import TaskDecomposer
from deepresearch_agent.agents.multi_agent.reporter.formatter import CitationFormatter
from deepresearch_agent.harness.contracts import SourceMode
from deepresearch_agent.harness.errors import AppError, ErrorCode
from deepresearch_agent.harness.policies import SourcePolicy
from deepresearch_agent.retrieval.base import SearchFilters, TimeoutBoundProvider, ToolCallContext
from deepresearch_agent.retrieval.router import RetrievalRouter
from deepresearch_agent.retrieval.tavily_provider import TavilyProvider
from deepresearch_agent.search.tool.deep_research_tool import DeepResearchTool


class FakeWebProvider:
    mode = SourceMode.WEB
    provider_name = "fake_web"

    def __init__(self):
        self.calls = []

    async def search(self, query, *, top_k, search_depth, filters, call_context):
        self.calls.append((query, filters, call_context))
        return [
            RetrievalResult(
                granularity="DO",
                evidence=f"evidence:{query}",
                source="tavily_search",
                source_mode="web",
                score=0.9,
                metadata=RetrievalMetadata(
                    source_id="https://example.com/article",
                    source_type="webpage",
                    confidence=0.9,
                    url="https://example.com/article",
                    title="Example article",
                ),
            )
        ]


def context() -> ToolCallContext:
    return ToolCallContext(
        run_id="run_test",
        task_id="task_1",
        tool_call_id="call_1",
        source_mode=SourceMode.WEB,
    )


def test_web_provider_contract_is_typed_and_traceable():
    provider = FakeWebProvider()
    results = asyncio.run(
        provider.search(
            "query",
            top_k=3,
            search_depth="basic",
            filters=SearchFilters(),
            call_context=context(),
        )
    )
    assert results[0].source_mode == "web"
    assert results[0].metadata.source_type == "webpage"
    assert results[0].metadata.url == "https://example.com/article"


@pytest.mark.asyncio
async def test_run_timeout_wrapper_returns_typed_timeout():
    provider = FakeWebProvider()
    bounded = TimeoutBoundProvider(provider, timeout_seconds=7)
    observed = {}

    async def force_timeout(awaitable, timeout):
        observed["timeout"] = timeout
        awaitable.close()
        raise TimeoutError("forced")

    original = asyncio.wait_for
    asyncio.wait_for = force_timeout
    try:
        with pytest.raises(AppError) as caught:
            await bounded.search(
                "query",
                top_k=3,
                search_depth="basic",
                filters=SearchFilters(),
                call_context=context(),
            )
    finally:
        asyncio.wait_for = original
    assert observed["timeout"] == 7
    assert caught.value.code is ErrorCode.RETRIEVAL_TIMEOUT
    assert caught.value.retryable is True


def test_router_exposes_only_web_provider():
    provider = FakeWebProvider()
    router = RetrievalRouter({SourceMode.WEB: provider})
    assert router.for_mode("web") is provider
    with pytest.raises(AppError) as invalid:
        router.for_mode("unsupported")
    assert invalid.value.code is ErrorCode.INVALID_SOURCE_MODE
    with pytest.raises(AppError) as unavailable:
        RetrievalRouter({}).for_mode(SourceMode.WEB)
    assert unavailable.value.code is ErrorCode.SOURCE_UNAVAILABLE


def test_web_policy_rejects_unknown_tools_and_fields():
    policy = SourcePolicy()
    policy.assert_tool_allowed(SourceMode.WEB, "tavily_search")
    with pytest.raises(AppError):
        policy.assert_tool_allowed(SourceMode.WEB, "unsupported_tool")
    with pytest.raises(AppError) as private:
        policy.sanitize_web_arguments({"query": "safe", "private_context": "forbidden"})
    assert private.value.details["rejected_fields"] == ["private_context"]


def test_task_decomposer_accepts_only_web_tasks():
    decomposer = object.__new__(TaskDecomposer)
    graph = decomposer._build_task_graph(
        {
            "nodes": [{"task_id": "task_1", "task_type": "web_search", "description": "q", "priority": "high"}],
            "execution_mode": "dag",
        },
        source_mode="web",
    )
    assert graph.nodes[0].task_type == "web_search"
    assert graph.nodes[0].source_mode == "web"
    assert graph.nodes[0].priority == 1
    assert graph.execution_mode == "sequential"
    with pytest.raises(ValueError):
        decomposer._build_task_graph(
            {"nodes": [{"task_id": "task_2", "task_type": "unsupported_search", "description": "q"}]},
            source_mode="web",
        )


def test_plan_reviewer_normalizes_string_problem_statement():
    reviewer = object.__new__(PlanReviewer)
    reviewer._invoke_llm = lambda _prompt: json.dumps({
        "problem_statement": "陈永是一位需要核实出生地的人物。",
        "task_graph": {
            "nodes": [{
                "task_id": "task_1",
                "task_type": "web_search",
                "source_mode": "web",
                "description": "核实陈永的出生地",
            }],
            "execution_mode": "sequential",
        },
        "acceptance_criteria": "使用默认验收标准",
        "validation_results": "通过",
    })
    graph = TaskGraph(nodes=[TaskNode(task_id="task_1", task_type="web_search", description="核实陈永的出生地")])

    outcome = reviewer.review(
        original_query="陈永的出生地在哪？",
        refined_query="陈永的出生地在哪？",
        task_graph=graph,
        assumptions=[],
        source_mode="web",
    )

    assert outcome.plan_spec.problem_statement.original_query == "陈永的出生地在哪？"
    assert outcome.plan_spec.problem_statement.background_info == "陈永是一位需要核实出生地的人物。"


@pytest.mark.asyncio
async def test_tavily_maps_deduplicated_web_results_without_exposing_key(tmp_path: Path):
    class Client:
        def search(self, **kwargs):
            return {
                "results": [
                    {"title": "A", "url": "HTTPS://Example.COM/a/?utm_source=x", "content": " same body ", "score": 0.7},
                    {"title": "A2", "url": "https://example.com/a", "raw_content": "same body", "score": 0.9},
                ]
            }

    secret = "tvly-test-secret"
    provider = TavilyProvider(api_key=secret, client=Client(), cache_dir=tmp_path)
    results = await provider.search(
        "query",
        top_k=5,
        search_depth="advanced",
        filters=SearchFilters(),
        call_context=context(),
    )
    assert len(results) == 1
    assert results[0].metadata.url == "https://example.com/a"
    assert results[0].metadata.domain == "example.com"
    assert results[0].metadata.extra["untrusted_external_content"] is True
    assert secret not in json.dumps([item.to_dict() for item in results], default=str)


@pytest.mark.asyncio
async def test_tavily_auth_failure_does_not_retry(tmp_path: Path):
    class Unauthorized(Exception):
        status_code = 401

    class Client:
        calls = 0

        def search(self, **kwargs):
            self.calls += 1
            raise Unauthorized()

    client = Client()
    provider = TavilyProvider(api_key="secret", client=client, cache_dir=tmp_path)
    with pytest.raises(AppError) as caught:
        await provider.search("q", top_k=1, search_depth="basic", filters=SearchFilters(), call_context=context())
    assert caught.value.code is ErrorCode.TAVILY_AUTH_FAILED
    assert client.calls == 1


def test_retrieval_executor_uses_injected_web_provider():
    provider = FakeWebProvider()
    task = TaskNode(task_id="task_1", task_type="web_search", source_mode="web", description="research q")
    state = PlanExecuteState(input="research q", source_mode="web")
    signal = PlanExecutionSignal(
        plan_id="plan_1",
        version=1,
        source_mode="web",
        execution_mode="sequential",
        tasks=[task.model_dump()],
        execution_sequence=[task.task_id],
        assumptions=[],
        acceptance_criteria={},
    )
    result = RetrievalExecutor(provider=provider).execute_task(task, state, signal)
    assert result.success is True
    assert result.record.tool_calls[0].source_mode == "web"
    assert result.record.evidence[0].source_mode == "web"
    assert result.record.evidence[0].metadata.extra["tool_call_id"] == result.record.tool_calls[0].tool_call_id
    assert len(provider.calls) == 1


@pytest.mark.asyncio
async def test_deep_research_uses_only_injected_web_provider():
    provider = FakeWebProvider()
    tool = object.__new__(DeepResearchTool)
    tool.retrieval_provider = provider
    tool.run_id = "run_deep"
    tool.provider_results = []
    tool.provider_calls = []
    legacy = await tool._async_search("iterative query")
    assert legacy["chunks"][0]["source_mode"] == "web"
    assert len(provider.calls) == 1


def test_report_references_include_web_source_label():
    class Message:
        content = "formatted references"

    class LLM:
        def invoke(self, _prompt):
            return Message()

    web_result = asyncio.run(
        FakeWebProvider().search(
            "q",
            top_k=1,
            search_depth="basic",
            filters=SearchFilters(),
            call_context=context(),
        )
    )[0]
    rendered = CitationFormatter(llm=LLM()).format_references([web_result])
    assert "[Web]" in rendered
    assert web_result.result_id in rendered
