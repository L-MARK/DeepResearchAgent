"""带有延迟公开导出的 Web 搜索工具包。"""

from importlib import import_module


_EXPORTS = {
    "BaseSearchTool": ("deepresearch_agent.search.tool.base", "BaseSearchTool"),
    "DeepResearchTool": ("deepresearch_agent.search.tool.deep_research_tool", "DeepResearchTool"),
    "HypothesisGeneratorTool": ("deepresearch_agent.search.tool.hypothesis_tool", "HypothesisGeneratorTool"),
    "AnswerValidationTool": ("deepresearch_agent.search.tool.validation_tool", "AnswerValidationTool"),
}

__all__ = list(_EXPORTS)


def __getattr__(name: str):
    target = _EXPORTS.get(name)
    if target is None:
        raise AttributeError(name)
    module_name, attribute = target
    value = getattr(import_module(module_name), attribute)
    globals()[name] = value
    return value
