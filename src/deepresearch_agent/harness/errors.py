"""类型化的公开错误；错误消息可安全展示，绝不包含密钥。"""

from enum import Enum
from typing import Any, Dict, Optional


class ErrorCode(str, Enum):
    CONFIGURATION_INVALID = "CONFIGURATION_INVALID"
    DATABASE_UNAVAILABLE = "DATABASE_UNAVAILABLE"
    PERSISTENCE_FAILED = "PERSISTENCE_FAILED"
    NOT_FOUND = "NOT_FOUND"
    CONFLICT = "CONFLICT"
    INVALID_SOURCE_MODE = "INVALID_SOURCE_MODE"
    IDEMPOTENCY_CONFLICT = "IDEMPOTENCY_CONFLICT"
    LEASE_UNAVAILABLE = "LEASE_UNAVAILABLE"
    ARTIFACT_PATH_INVALID = "ARTIFACT_PATH_INVALID"
    ARTIFACT_INTEGRITY_FAILED = "ARTIFACT_INTEGRITY_FAILED"
    SOURCE_POLICY_VIOLATION = "SOURCE_POLICY_VIOLATION"
    SOURCE_UNAVAILABLE = "SOURCE_UNAVAILABLE"
    TAVILY_API_KEY_MISSING = "TAVILY_API_KEY_MISSING"
    TAVILY_AUTH_FAILED = "TAVILY_AUTH_FAILED"
    TAVILY_RATE_LIMITED = "TAVILY_RATE_LIMITED"
    RETRIEVAL_TIMEOUT = "RETRIEVAL_TIMEOUT"
    RETRIEVAL_FAILED = "RETRIEVAL_FAILED"


class AppError(RuntimeError):
    def __init__(self, code: ErrorCode, message: str, *, retryable: bool = False, details: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.retryable = retryable
        self.details = details or {}

    def as_dict(self) -> Dict[str, Any]:
        return {"code": self.code.value, "message": self.message, "retryable": self.retryable, "details": self.details}


class RunCancelled(RuntimeError):
    """内部协作式取消信号；不会作为失败错误暴露给用户。"""
