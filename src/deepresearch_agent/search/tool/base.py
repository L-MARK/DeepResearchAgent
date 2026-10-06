"""Web 搜索工具共用的基类。"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Dict, List
import time

from langchain_core.tools import BaseTool

from deepresearch_agent.cache_manager.manager import (
    CacheManager,
    ContextAndKeywordAwareCacheKeyStrategy,
    MemoryCacheBackend,
)
from deepresearch_agent.config.settings import BASE_SEARCH_CONFIG
from deepresearch_agent.models.get_models import get_llm_model


class BaseSearchTool(ABC):
    """Web 研究运行时使用的轻量信息源无关基类。"""

    def __init__(
        self,
        cache_dir: str = "./cache/search",
        *,
        enable_vector_cache: bool | None = None,
    ) -> None:
        self.llm = get_llm_model()
        self.cache_manager = CacheManager(
            key_strategy=ContextAndKeywordAwareCacheKeyStrategy(),
            storage_backend=MemoryCacheBackend(
                max_size=BASE_SEARCH_CONFIG["cache_max_size"]
            ),
            cache_dir=cache_dir,
            enable_vector_similarity=enable_vector_cache,
        )
        self.performance_metrics: Dict[str, float] = {}
        self._setup_chains()

    @abstractmethod
    def _setup_chains(self) -> None:
        """初始化可选的模型链。"""

    @abstractmethod
    def extract_keywords(self, query: str) -> Dict[str, List[str]]:
        """提取轻量查询关键词，供规划和验证使用。"""

    @abstractmethod
    def search(self, query: Any) -> str:
        """执行工具并返回面向用户的可读答案。"""

    def get_tool(self) -> BaseTool:
        outer = self

        class DynamicSearchTool(BaseTool):
            name: str = "web_search"
            description: str = "联网搜索工具：从 Web 来源检索与问题相关的证据。"

            def _run(self_tool, query: Any) -> str:
                return outer.search(query)

            def _arun(self_tool, query: Any) -> str:
                raise NotImplementedError("异步执行未实现")

        return DynamicSearchTool()

    def _log_performance(self, operation: str, start_time: float) -> None:
        self.performance_metrics[operation] = time.time() - start_time

    def close(self) -> None:
        """释放本地资源；HTTP 客户端由 Web Provider 自己管理。"""

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()
