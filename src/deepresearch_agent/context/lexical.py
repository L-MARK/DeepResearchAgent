"""供 Memory 和 Skill 查找共用的轻量语言无关词法匹配器。"""

from __future__ import annotations

import re


def lexical_terms(value: str) -> set[str]:
    """返回有界的单词和中文双字词，用于确定性匹配。"""
    lowered = value.lower()
    words = set(re.findall(r"[a-z0-9_]{2,}", lowered))
    cjk = "".join(re.findall(r"[\u3400-\u9fff]", lowered))
    words.update(cjk[index:index + 2] for index in range(max(0, len(cjk) - 1)))
    return {item for item in words if item}
