"""针对已清理的成对评估摘要的可选独立裁判。"""

from __future__ import annotations

from typing import Protocol

from pydantic import BaseModel, Field


class SemanticJudgement(BaseModel):
    control_score: float = Field(ge=0, le=1)
    treatment_score: float = Field(ge=0, le=1)
    treatment_regressed: bool
    reasons: list[str] = Field(default_factory=list)


class SemanticJudge(Protocol):
    """实现类接收清理后的摘要，绝不会接收私有报告原文。"""

    async def judge(self, *, case: dict, control: dict, treatment: dict) -> SemanticJudgement: ...
