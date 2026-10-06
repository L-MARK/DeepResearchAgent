"""由 LLM 辅助的轻量 Web 研究查询函数。"""

from __future__ import annotations

import ast
import re
from typing import Any, List

from deepresearch_agent.config.prompts import SEARCH_MULTI_HYPOTHESIS_PROMPT


def _response_text(response: Any) -> str:
    return str(getattr(response, "content", response) or "").strip()


def _parse_list(value: str) -> list[str]:
    match = re.search(r"\[[\s\S]*\]", value)
    if match:
        try:
            parsed = ast.literal_eval(match.group(0))
            if isinstance(parsed, list):
                return [str(item).strip() for item in parsed if str(item).strip()]
        except (SyntaxError, ValueError):
            pass
    return [line.strip(" -*\t") for line in value.splitlines() if len(line.strip()) > 8]


class QueryGenerator:
    """不依赖特定信息源，生成有界的后续问题。"""

    def __init__(self, llm, sub_query_prompt: str = "", followup_query_prompt: str = ""):
        self.llm = llm
        self.sub_query_prompt = sub_query_prompt
        self.followup_query_prompt = followup_query_prompt

    def generate_sub_queries(self, original_query: str) -> List[str]:
        if not self.sub_query_prompt:
            return [original_query]
        try:
            return _parse_list(_response_text(self.llm.invoke(self.sub_query_prompt.format(original_query=original_query))))[:3] or [original_query]
        except Exception:
            return [original_query]

    @staticmethod
    def generate_multiple_hypotheses(query: str, llm) -> List[str]:
        try:
            content = _response_text(llm.invoke(SEARCH_MULTI_HYPOTHESIS_PROMPT.format(query=query)))
            return _parse_list(content)[:3]
        except Exception:
            return []

    def generate_followup_queries(self, original_query: str, retrieved_info: List[str]) -> List[str]:
        if not retrieved_info or not self.followup_query_prompt:
            return []
        try:
            content = _response_text(self.llm.invoke(self.followup_query_prompt.format(
                original_query=original_query,
                retrieved_info="\n\n".join(retrieved_info[-3:])[:6000],
            )))
            return list(dict.fromkeys(_parse_list(content)))[:3]
        except Exception:
            return []


__all__ = ["QueryGenerator"]
