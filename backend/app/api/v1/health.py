"""Health and capability discovery for the Web-only runtime."""

import asyncio
from datetime import datetime, timezone
from urllib.parse import urlparse

from fastapi import APIRouter, Depends
from sqlalchemy import text

from backend.app.dependencies import get_database
from deepresearch_agent.config import settings

router = APIRouter(tags=["system"])


async def _tcp_status(uri: str, default_port: int) -> tuple[str, str | None]:
    parsed = urlparse(uri)
    host, port = parsed.hostname, parsed.port or default_port
    if not host:
        return "unavailable", "地址未配置"
    try:
        _reader, writer = await asyncio.wait_for(
            asyncio.open_connection(host, port), timeout=0.75
        )
        writer.close()
        await writer.wait_closed()
        return "healthy", None
    except Exception:
        return "degraded", f"无法连接 {host}:{port}"


@router.get("/health")
async def health(database=Depends(get_database)):
    sqlite_status = "healthy"
    try:
        async with database.engine.connect() as connection:
            await connection.execute(text("CREATE TEMP TABLE IF NOT EXISTS health_probe(value INTEGER)"))
            await connection.execute(text("DROP TABLE health_probe"))
    except Exception:
        sqlite_status = "unavailable"

    llm_configured = bool(settings.OPENAI_API_KEY and settings.OPENAI_LLM_MODEL)
    tavily_configured = bool(settings.TAVILY_API_KEY)
    llm_status, llm_reason = (
        await _tcp_status(settings.OPENAI_BASE_URL, 443)
        if llm_configured
        else ("unavailable", "LLM 未配置")
    )
    tavily_status, tavily_reason = (
        ("healthy", None)
        if tavily_configured
        else ("unavailable", "TAVILY_API_KEY 未配置")
    )
    overall = (
        "healthy"
        if sqlite_status == "healthy"
        and llm_status == "healthy"
        and tavily_status == "healthy"
        else "degraded"
    )
    return {
        "status": overall,
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "components": {
            "api": {"status": "healthy", "check_level": "functional"},
            "sqlite": {"status": sqlite_status, "check_level": "read_write"},
            "llm": {
                "status": llm_status,
                "configured": llm_configured,
                "reason": llm_reason,
                "check_level": "tcp_only",
            },
            "tavily": {
                "status": tavily_status,
                "configured": tavily_configured,
                "reason": tavily_reason,
                "check_level": "configuration_only",
            },
        },
    }


@router.get("/capabilities")
async def capabilities():
    web = bool(settings.TAVILY_API_KEY)
    return {
        "sources": {
            "web": {
                "available": web,
                "reason": None if web else "TAVILY_API_KEY 未配置",
            }
        },
        "workflows": ["deep_research", "plan_execute_report"],
        "default_source_mode": "web",
        "default_budget": settings.HARNESS_BUDGETS,
        "features": {"sse": True, "memory_management": True, "skill_management": True},
        "fastapi_workers": settings.workers,
    }
