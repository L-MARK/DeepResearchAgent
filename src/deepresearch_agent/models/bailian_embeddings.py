"""适配 OpenAI 风格 Embedding 接口的阿里百炼兼容适配器。"""

from __future__ import annotations

from typing import Any
from urllib.parse import urlparse

from langchain_openai import OpenAIEmbeddings


def is_bailian_compatible_url(base_url: str | None) -> bool:
    """判断 *base_url* 是否指向百炼的 OpenAI 兼容 API。"""

    if not base_url:
        return False
    hostname = (urlparse(base_url).hostname or "").lower()
    return (
        hostname in {"dashscope.aliyuncs.com", "dashscope-intl.aliyuncs.com"}
        or hostname.endswith(".maas.aliyuncs.com")
    )


class BailianOpenAIEmbeddings(OpenAIEmbeddings):
    """保持文本输入原样传递给百炼的 OpenAI 兼容端点。

    LangChain's length-safe path tokenizes strings locally and sends token-id
    arrays to the embeddings endpoint. Bailian accepts strings or lists of
    strings, so disabling that path preserves the documented request shape.
    """

    def __init__(self, **kwargs: Any) -> None:
        kwargs.setdefault("check_embedding_ctx_length", False)
        # 百炼 text-embedding-v4 每次请求最多接受 10 段文本。
        # 将限制放在适配器内部，这样现有调用方仍可保留更大的处理批次，行为无需改变。
        kwargs.setdefault("chunk_size", 10)
        super().__init__(**kwargs)


__all__ = ["BailianOpenAIEmbeddings", "is_bailian_compatible_url"]
