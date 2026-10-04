"""供上下文和精选 Memory 预算使用的轻量 Token 计数封装。"""

from __future__ import annotations

import re


def count_tokens(value: str) -> int:
    """返回确定性且偏保守的 Token 估算值。"""
    if not value:
        return 0
    try:
        import tiktoken

        return len(tiktoken.get_encoding("cl100k_base").encode(value))
    except Exception:
        cjk = len(re.findall(r"[\u3400-\u9fff]", value))
        remainder = re.sub(r"[\u3400-\u9fff]", "", value)
        latin = len(re.findall(r"[A-Za-z0-9_]+|[^\sA-Za-z0-9_]", remainder))
        return max(1, cjk + latin)
