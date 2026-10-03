"""Plan-Execute-Report 阶段编排器。

HarnessRuntime 负责 Run 生命周期、检查点、恢复和验证；本类只保留三个
可检查点化的阶段入口，以及报告一致性复核入口。
"""

from typing import Any, List, Optional, Sequence

from deepresearch_agent.agents.multi_agent.core.execution_record import ExecutionRecord
from deepresearch_agent.agents.multi_agent.core.state import PlanExecuteState
from deepresearch_agent.agents.multi_agent.executor.worker_coordinator import WorkerCoordinator
from deepresearch_agent.agents.multi_agent.planner.base_planner import BasePlanner, PlannerResult
from deepresearch_agent.agents.multi_agent.reporter.base_reporter import BaseReporter, ReportResult


class MultiAgentOrchestrator:
    """暴露 :class:`HarnessRuntime` 使用的各阶段边界。"""

    def __init__(
        self,
        *,
        planner: BasePlanner,
        worker_coordinator: WorkerCoordinator,
        reporter: BaseReporter,
    ) -> None:
        self._planner = planner
        self._worker = worker_coordinator
        self._reporter = reporter

    def plan(
        self,
        state: PlanExecuteState,
        *,
        assumptions: Optional[Sequence[str]] = None,
    ) -> PlannerResult:
        """执行规划阶段，并为 Harness 写入检查点。"""
        return self._planner.generate_plan(
            state,
            assumptions=list(assumptions) if assumptions else None,
        )

    def execute(
        self,
        state: PlanExecuteState,
        planner_result: PlannerResult,
        *,
        stop_predicate=None,
        progress_callback=None,
    ) -> List[ExecutionRecord]:
        """根据 Planner 的执行信号执行 Worker 阶段。"""
        signal = planner_result.executor_signal
        if signal is None:
            raise ValueError("Planner未提供执行信号，无法继续执行")
        return self._worker.execute_plan(
            state,
            signal,
            stop_predicate=stop_predicate,
            progress_callback=progress_callback,
        )

    def report(
        self,
        state: PlanExecuteState,
        *,
        report_type: Optional[str] = None,
    ) -> ReportResult:
        """执行 Reporter 及其一致性检查器。"""
        return self._reporter.generate_report(state, report_type=report_type)

    def recheck_report_consistency(
        self,
        report_content: str,
        evidence: Sequence[Any],
    ):
        """在 Harness 完成针对性修复后重新执行一致性检查。"""
        return self._reporter.recheck_consistency(report_content, evidence)
