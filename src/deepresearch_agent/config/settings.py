"""仅使用 Web 的研究运行时应用配置。"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

load_dotenv()


def _get_env_int(key: str, default: Optional[int]) -> Optional[int]:
    raw = os.getenv(key)
    if raw is None or raw == "":
        return default
    try:
        return int(raw)
    except ValueError as exc:
        raise ValueError(f"环境变量 {key} 需要整数值，但当前为 {raw}") from exc


def _get_env_float(key: str, default: Optional[float]) -> Optional[float]:
    raw = os.getenv(key)
    if raw is None or raw == "":
        return default
    try:
        return float(raw)
    except ValueError as exc:
        raise ValueError(f"环境变量 {key} 需要浮点值，但当前为 {raw}") from exc


def _get_env_bool(key: str, default: bool) -> bool:
    raw = os.getenv(key)
    if raw is None or raw == "":
        return default
    return raw.lower() in {"1", "true", "yes", "y", "on"}


def _get_env_choice(key: str, choices: set[str], default: str) -> str:
    raw = os.getenv(key)
    if raw is None or not raw.strip():
        return default
    value = raw.strip().lower()
    if value not in choices:
        raise ValueError(f"环境变量 {key} 必须为 {', '.join(sorted(choices))} 之一")
    return value


def _positive(key: str, value: int) -> int:
    if value < 1:
        raise ValueError(f"环境变量 {key} 必须大于等于 1")
    return value


BASE_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BASE_DIR.parent.parent

APP_ENV = os.getenv("APP_ENV", "local")
APP_HOST = os.getenv("APP_HOST", "127.0.0.1")
APP_PORT = _positive("APP_PORT", _get_env_int("APP_PORT", 8000) or 8000)
FRONTEND_ORIGINS = tuple(
    item.strip()
    for item in os.getenv(
        "FRONTEND_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
    ).split(",")
    if item.strip()
)
APP_DATABASE_URL = os.getenv("APP_DATABASE_URL", "sqlite+aiosqlite:///./data/app.db").strip()
ARTIFACT_ROOT = Path(os.getenv("ARTIFACT_ROOT", str(PROJECT_ROOT / "data" / "artifacts"))).expanduser()
SKILLS_ROOT = Path(os.getenv("SKILLS_ROOT", str(PROJECT_ROOT / "skills"))).expanduser()
workers = _get_env_int("FASTAPI_WORKERS", 1) or 1
LOCAL_MVP_SINGLE_WORKER = workers == 1
AUTO_RESUME_RUNS = _get_env_bool("AUTO_RESUME_RUNS", True)

CONTEXT_MAX_CHARS = _positive("CONTEXT_MAX_CHARS", _get_env_int("CONTEXT_MAX_CHARS", 16000) or 16000)
CONTEXT_RECENT_TURNS = _positive("CONTEXT_RECENT_TURNS", _get_env_int("CONTEXT_RECENT_TURNS", 8) or 8)
CONTEXT_MAX_TOKENS = _positive("CONTEXT_MAX_TOKENS", _get_env_int("CONTEXT_MAX_TOKENS", 12000) or 12000)
CONTEXT_COMPRESSION_THRESHOLD_TOKENS = _positive(
    "CONTEXT_COMPRESSION_THRESHOLD_TOKENS", _get_env_int("CONTEXT_COMPRESSION_THRESHOLD_TOKENS", 8000) or 8000
)
CONTEXT_COMPRESSION_THRESHOLD_RATIO = _get_env_float("CONTEXT_COMPRESSION_THRESHOLD_RATIO", 0.50) or 0.50
CONTEXT_COMPRESSION_TARGET_TOKENS = _positive(
    "CONTEXT_COMPRESSION_TARGET_TOKENS", _get_env_int("CONTEXT_COMPRESSION_TARGET_TOKENS", 2000) or 2000
)
CONTEXT_PROTECT_RECENT_MESSAGES = _positive(
    "CONTEXT_PROTECT_RECENT_MESSAGES", _get_env_int("CONTEXT_PROTECT_RECENT_MESSAGES", 12) or 12
)
SESSION_SEARCH_TOP_K = _positive("SESSION_SEARCH_TOP_K", _get_env_int("SESSION_SEARCH_TOP_K", 3) or 3)
SESSION_SEARCH_WINDOW = _positive("SESSION_SEARCH_WINDOW", _get_env_int("SESSION_SEARCH_WINDOW", 5) or 5)

MEMORY_USER_MAX_TOKENS = _positive("MEMORY_USER_MAX_TOKENS", _get_env_int("MEMORY_USER_MAX_TOKENS", 500) or 500)
MEMORY_PROJECT_MAX_TOKENS = _positive("MEMORY_PROJECT_MAX_TOKENS", _get_env_int("MEMORY_PROJECT_MAX_TOKENS", 800) or 800)
MEMORY_USER_MAX_CHARS = _positive("MEMORY_USER_MAX_CHARS", _get_env_int("MEMORY_USER_MAX_CHARS", 1375) or 1375)
MEMORY_PROJECT_MAX_CHARS = _positive("MEMORY_PROJECT_MAX_CHARS", _get_env_int("MEMORY_PROJECT_MAX_CHARS", 2200) or 2200)
MEMORY_BACKGROUND_REVIEW_ENABLED = _get_env_bool("MEMORY_BACKGROUND_REVIEW_ENABLED", True)

TAVILY_API_KEY = os.getenv("TAVILY_API_KEY", "")
TAVILY_SEARCH_DEPTH = _get_env_choice("TAVILY_SEARCH_DEPTH", {"basic", "advanced"}, "advanced")
TAVILY_MAX_RESULTS = _positive("TAVILY_MAX_RESULTS", _get_env_int("TAVILY_MAX_RESULTS", 5) or 5)
TAVILY_TIMEOUT_SECONDS = _positive("TAVILY_TIMEOUT_SECONDS", _get_env_int("TAVILY_TIMEOUT_SECONDS", 45) or 45)
TAVILY_CACHE_TTL_SECONDS = _positive("TAVILY_CACHE_TTL_SECONDS", _get_env_int("TAVILY_CACHE_TTL_SECONDS", 86400) or 86400)

HARNESS_BUDGETS = {
    "wall_time_seconds": _positive("RUN_MAX_WALL_TIME_SECONDS", _get_env_int("RUN_MAX_WALL_TIME_SECONDS", 1800) or 1800),
    "max_plan_tasks": _positive("RUN_MAX_PLAN_TASKS", _get_env_int("RUN_MAX_PLAN_TASKS", 8) or 8),
    "max_tool_calls": _positive("RUN_MAX_TOOL_CALLS", _get_env_int("RUN_MAX_TOOL_CALLS", 30) or 30),
    "max_tavily_calls": _positive("RUN_MAX_TAVILY_CALLS", _get_env_int("RUN_MAX_TAVILY_CALLS", 20) or 20),
    "max_replans": _positive("RUN_MAX_REPLANS", _get_env_int("RUN_MAX_REPLANS", 2) or 2),
    "max_task_retries": _positive("RUN_MAX_TASK_RETRIES", _get_env_int("RUN_MAX_TASK_RETRIES", 2) or 2),
    "max_llm_tokens": _positive("RUN_MAX_LLM_TOKENS", _get_env_int("RUN_MAX_LLM_TOKENS", 200000) or 200000),
    "max_concurrency": _positive("RUN_MAX_CONCURRENCY", _get_env_int("RUN_MAX_CONCURRENCY", 4) or 4),
    "tool_timeout_seconds": _positive("RUN_TOOL_TIMEOUT_SECONDS", _get_env_int("RUN_TOOL_TIMEOUT_SECONDS", 60) or 60),
}

# 缓存配置与信息源无关；向量相似度只是重复 Web 研究请求的可选缓存优化。
similarity_threshold = _get_env_float("CACHE_SIMILARITY_THRESHOLD", 0.9) or 0.9
DEFAULT_CACHE_ROOT = Path(os.getenv("CACHE_ROOT", str(PROJECT_ROOT / "cache"))).expanduser()
MODEL_CACHE_ROOT = Path(os.getenv("MODEL_CACHE_ROOT", str(DEFAULT_CACHE_ROOT))).expanduser()
MODEL_CACHE_DIR = MODEL_CACHE_ROOT / "model"
CACHE_DIR = Path(os.getenv("CACHE_DIR", str(DEFAULT_CACHE_ROOT))).expanduser()
TIKTOKEN_CACHE_DIR = Path(os.getenv("TIKTOKEN_CACHE_DIR", str(DEFAULT_CACHE_ROOT / "tiktoken"))).expanduser()
os.environ.setdefault("TIKTOKEN_CACHE_DIR", str(TIKTOKEN_CACHE_DIR))
SENTENCE_TRANSFORMER_MODELS = [
    item.strip() for item in os.getenv("SENTENCE_TRANSFORMER_MODELS", "").split(",") if item.strip()
]
CACHE_EMBEDDING_PROVIDER = os.getenv("CACHE_EMBEDDING_PROVIDER", "sentence_transformer").lower()
CACHE_SENTENCE_TRANSFORMER_MODEL = os.getenv("CACHE_SENTENCE_TRANSFORMER_MODEL", "all-MiniLM-L6-v2")
CACHE_SETTINGS = {
    "dir": CACHE_DIR,
    "memory_only": _get_env_bool("CACHE_MEMORY_ONLY", False),
    "max_memory_size": _get_env_int("CACHE_MAX_MEMORY_SIZE", 100) or 100,
    "max_disk_size": _get_env_int("CACHE_MAX_DISK_SIZE", 1000) or 1000,
    "thread_safe": _get_env_bool("CACHE_THREAD_SAFE", True),
    "enable_vector_similarity": _get_env_bool("CACHE_ENABLE_VECTOR_SIMILARITY", True),
    "similarity_threshold": similarity_threshold,
    "max_vectors": _get_env_int("CACHE_MAX_VECTORS", 10000) or 10000,
}
BASE_SEARCH_CONFIG = {"cache_max_size": _get_env_int("SEARCH_CACHE_MEMORY_SIZE", 200) or 200}

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "")
OPENAI_EMBEDDINGS_MODEL = os.getenv("OPENAI_EMBEDDINGS_MODEL") or None
OPENAI_EMBEDDING_DIMENSIONS = _get_env_int("OPENAI_EMBEDDING_DIMENSIONS", None)
if OPENAI_EMBEDDING_DIMENSIONS is not None:
    OPENAI_EMBEDDING_DIMENSIONS = _positive("OPENAI_EMBEDDING_DIMENSIONS", OPENAI_EMBEDDING_DIMENSIONS)
OPENAI_EMBEDDING_BATCH_SIZE = _positive("OPENAI_EMBEDDING_BATCH_SIZE", _get_env_int("OPENAI_EMBEDDING_BATCH_SIZE", 10) or 10)
OPENAI_LLM_MODEL = os.getenv("OPENAI_LLM_MODEL") or None
MEMORY_LLM_MODEL = os.getenv("MEMORY_LLM_MODEL") or OPENAI_LLM_MODEL
MEMORY_LLM_MIN_CONFIDENCE = _get_env_float("MEMORY_LLM_MIN_CONFIDENCE", 0.75) or 0.75
MEMORY_LLM_MAX_CANDIDATES = _positive("MEMORY_LLM_MAX_CANDIDATES", _get_env_int("MEMORY_LLM_MAX_CANDIDATES", 3) or 3)
MEMORY_LLM_MAX_MESSAGE_CHARS = _positive("MEMORY_LLM_MAX_MESSAGE_CHARS", _get_env_int("MEMORY_LLM_MAX_MESSAGE_CHARS", 4000) or 4000)
MEMORY_LLM_MAX_OUTPUT_TOKENS = _positive("MEMORY_LLM_MAX_OUTPUT_TOKENS", _get_env_int("MEMORY_LLM_MAX_OUTPUT_TOKENS", 1200) or 1200)
LLM_TEMPERATURE = _get_env_float("TEMPERATURE", None)
LLM_MAX_TOKENS = _get_env_int("MAX_TOKENS", None)
LLM_REQUEST_TIMEOUT_SECONDS = _positive("LLM_REQUEST_TIMEOUT_SECONDS", _get_env_int("LLM_REQUEST_TIMEOUT_SECONDS", 90) or 90)
LLM_MAX_RETRIES = max(0, _get_env_int("LLM_MAX_RETRIES", 1) or 0)
OPENAI_EMBEDDING_CONFIG = {
    "model": OPENAI_EMBEDDINGS_MODEL,
    "api_key": OPENAI_API_KEY,
    "base_url": OPENAI_BASE_URL,
    "dimensions": OPENAI_EMBEDDING_DIMENSIONS,
    "chunk_size": OPENAI_EMBEDDING_BATCH_SIZE,
}
OPENAI_LLM_CONFIG = {
    "model": OPENAI_LLM_MODEL,
    "temperature": LLM_TEMPERATURE,
    "max_tokens": LLM_MAX_TOKENS,
    "api_key": OPENAI_API_KEY,
    "base_url": OPENAI_BASE_URL,
    "timeout": LLM_REQUEST_TIMEOUT_SECONDS,
    "max_retries": LLM_MAX_RETRIES,
}

AGENT_SETTINGS = {
    "default_recursion_limit": _get_env_int("AGENT_RECURSION_LIMIT", 5) or 5,
    "chunk_size": _get_env_int("AGENT_CHUNK_SIZE", 4) or 4,
    "stream_flush_threshold": _get_env_int("AGENT_STREAM_FLUSH_THRESHOLD", 40) or 40,
    "deep_stream_flush_threshold": _get_env_int("DEEP_AGENT_STREAM_FLUSH_THRESHOLD", 80) or 80,
}

MULTI_AGENT_PLANNER_MAX_TASKS = _get_env_int("MA_PLANNER_MAX_TASKS", 6) or 6
MULTI_AGENT_ALLOW_UNCLARIFIED_PLAN = _get_env_bool("MA_ALLOW_UNCLARIFIED_PLAN", True)
MULTI_AGENT_DEFAULT_DOMAIN = os.getenv("MA_DEFAULT_DOMAIN", "通用")
MULTI_AGENT_DEFAULT_REPORT_TYPE = os.getenv("MA_DEFAULT_REPORT_TYPE", "long_document")
MULTI_AGENT_ENABLE_CONSISTENCY_CHECK = _get_env_bool("MA_ENABLE_CONSISTENCY_CHECK", True)
MULTI_AGENT_ENABLE_MAPREDUCE = _get_env_bool("MA_ENABLE_MAPREDUCE", True)
MULTI_AGENT_MAPREDUCE_THRESHOLD = _get_env_int("MA_MAPREDUCE_THRESHOLD", 20) or 20
MULTI_AGENT_MAX_TOKENS_PER_REDUCE = _get_env_int("MA_MAX_TOKENS_PER_REDUCE", 4000) or 4000
MULTI_AGENT_ENABLE_PARALLEL_MAP = _get_env_bool("MA_ENABLE_PARALLEL_MAP", True)
MULTI_AGENT_SECTION_MAX_EVIDENCE = _get_env_int("MA_SECTION_MAX_EVIDENCE", 8) or 8
MULTI_AGENT_SECTION_MAX_CONTEXT_CHARS = _get_env_int("MA_SECTION_MAX_CONTEXT_CHARS", 800) or 800
MULTI_AGENT_REFLECTION_ALLOW_RETRY = _get_env_bool("MA_REFLECTION_ALLOW_RETRY", False)
MULTI_AGENT_REFLECTION_MAX_RETRIES = _get_env_int("MA_REFLECTION_MAX_RETRIES", 1) or 1
MULTI_AGENT_WORKER_EXECUTION_MODE = _get_env_choice("MA_WORKER_EXECUTION_MODE", {"sequential", "parallel"}, "sequential")
MULTI_AGENT_WORKER_MAX_CONCURRENCY = _positive("MA_WORKER_MAX_CONCURRENCY", _get_env_int("MA_WORKER_MAX_CONCURRENCY", 4) or 4)

LEARNING_REVIEW_ENABLED = _get_env_bool("LEARNING_REVIEW_ENABLED", True)
LEARNING_REVIEW_MODEL = os.getenv("LEARNING_REVIEW_MODEL") or OPENAI_LLM_MODEL
LEARNING_REVIEW_MAX_OUTPUT_TOKENS = _positive("LEARNING_REVIEW_MAX_OUTPUT_TOKENS", _get_env_int("LEARNING_REVIEW_MAX_OUTPUT_TOKENS", 4000) or 4000)
LEARNING_REVIEW_MAX_RETRIES = max(0, _get_env_int("LEARNING_REVIEW_MAX_RETRIES", 2) or 0)
SKILL_WRITE_APPROVAL_REQUIRED = _get_env_bool("SKILL_WRITE_APPROVAL_REQUIRED", True)
SKILL_CANARY_INITIAL_PERCENT = max(1, min(50, _get_env_int("SKILL_CANARY_INITIAL_PERCENT", 5) or 5))

EVIDENCE_CARD_MAX_TOKENS = _get_env_int("EVIDENCE_CARD_MAX_TOKENS", 200) or 200
EVIDENCE_CARD_BATCH_SIZE = _get_env_int("EVIDENCE_CARD_BATCH_SIZE", 10) or 10
REPORT_SECTION_EVIDENCE_BUDGET = _get_env_int("REPORT_SECTION_EVIDENCE_BUDGET", 12000) or 12000
REPORT_BATCH_BUDGET_RATIO = _get_env_float("REPORT_BATCH_BUDGET_RATIO", 0.70) or 0.70
REPORT_BATCH_DIGEST_MAX_TOKENS = _get_env_int("REPORT_BATCH_DIGEST_MAX_TOKENS", 600) or 600
REPORT_MAX_SECTIONS = _get_env_int("REPORT_MAX_SECTIONS", 6) or 6
REPORT_MAX_MODEL_CALLS = _get_env_int("REPORT_MAX_MODEL_CALLS", 15) or 15
REPORT_RESERVED_TOKENS = _get_env_int("REPORT_RESERVED_TOKENS", 60000) or 60000
VERIFICATION_RESERVED_TOKENS = _get_env_int("VERIFICATION_RESERVED_TOKENS", 15000) or 15000
