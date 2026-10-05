from .strategies import (
    CacheKeyStrategy,
    SimpleCacheKeyStrategy,
    ContextAwareCacheKeyStrategy,
    ContextAndKeywordAwareCacheKeyStrategy
)

from .backends import (
    CacheStorageBackend,
    MemoryCacheBackend,
    DiskCacheBackend,
    HybridCacheBackend,
    ThreadSafeCacheBackend
)

from .models import CacheItem
from .manager import CacheManager
from .vector_similarity import VectorSimilarityMatcher
from .model_cache import initialize_model_cache, ensure_model_cache_dir

__all__ = [
    # 缓存键策略
    'CacheKeyStrategy',
    'SimpleCacheKeyStrategy',
    'ContextAwareCacheKeyStrategy',
    'ContextAndKeywordAwareCacheKeyStrategy',

    # 存储后端
    'CacheStorageBackend',
    'MemoryCacheBackend',
    'DiskCacheBackend',
    'HybridCacheBackend',
    'ThreadSafeCacheBackend',

    # 数据模型
    'CacheItem',

    # 主缓存管理器
    'CacheManager',

    # 向量相似度
    'VectorSimilarityMatcher',

    # 模型缓存
    'initialize_model_cache',
    'ensure_model_cache_dir'
]
