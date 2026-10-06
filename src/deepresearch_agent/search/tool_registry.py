"""Web 运行时保留的信息源无关工具注册表。"""

from typing import Any, Dict, Type

from deepresearch_agent.search.tool.base import BaseSearchTool
from deepresearch_agent.search.tool.deep_research_tool import DeepResearchTool
from deepresearch_agent.search.tool.hypothesis_tool import HypothesisGeneratorTool
from deepresearch_agent.search.tool.validation_tool import AnswerValidationTool

TOOL_REGISTRY: Dict[str, Type[BaseSearchTool]] = {
    "deep_research": DeepResearchTool,
    # 为兼容已持久化的计划而保留的别名；它使用同一个 Web-only 实现，
    # 不存在独立的图执行路径。
    "deeper_research": DeepResearchTool,
}

EXTRA_TOOL_FACTORIES: Dict[str, Any] = {
    "hypothesis_generator": HypothesisGeneratorTool,
    "answer_validator": AnswerValidationTool,
}

__all__ = ["TOOL_REGISTRY", "EXTRA_TOOL_FACTORIES"]
