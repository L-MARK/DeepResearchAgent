"""执行或恢复一个研究 Run 所需的可序列化状态。"""

from __future__ import annotations

from typing import Any, Dict, Optional

from pydantic import BaseModel, Field

from .budgets import BudgetLimits, BudgetUsage
from .contracts import RunStatus, SourceMode, WorkflowMode


class RunContext(BaseModel):
    run_id: str
    session_id: str
    trigger_message_id: str
    source_mode: SourceMode
    workflow_mode: WorkflowMode
    status: RunStatus
    original_query: str
    resolved_query: Optional[str] = None
    plan_version: int = 0
    checkpoint_version: int = 0
    config_snapshot: Dict[str, Any] = Field(default_factory=dict)
    model_snapshot: Dict[str, Any] = Field(default_factory=dict)
    budget_limits: BudgetLimits = Field(default_factory=BudgetLimits)
    budget_usage: BudgetUsage = Field(default_factory=BudgetUsage)
    cancellation_requested: bool = False
    # 仅在加载被中断的 Run 时设置。
    # 它记录最新持久化检查点之后可以安全执行的第一个阶段。
    resume_from_status: Optional[RunStatus] = None
    context_snapshot: Dict[str, Any] = Field(default_factory=dict)
    used_message_ids: list[str] = Field(default_factory=list)
    model_input: Optional[str] = None
    workflow_state: Dict[str, Any] = Field(default_factory=dict)
    report: Optional[str] = None
