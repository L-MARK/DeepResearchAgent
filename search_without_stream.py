import argparse
import asyncio
import sys
import time
from datetime import datetime
from pathlib import Path

# src 布局：脚本从项目根目录直接运行时，将 src 加入 sys.path 以定位 deepresearch_agent 包
_SRC = Path(__file__).resolve().parent / "src"
if str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))

from deepresearch_agent.harness.contracts import SourceMode
from deepresearch_agent.harness.contracts import WorkflowMode
from deepresearch_agent.harness.bootstrap import run_persistent_query


WORKFLOW_NAMES = ("deep_research", "plan_execute_report")


def main() -> None:
    parser = argparse.ArgumentParser(description="Run a Harness research workflow")
    parser.add_argument("query", nargs="?", default="急性脑⾎管病吃什么药？写一份研究报告")
    parser.add_argument("--workflow", choices=WORKFLOW_NAMES, default="deep_research")
    parser.add_argument("--thread-id", default=None)
    args = parser.parse_args()
    workflow_name = args.workflow
    query = args.query
    thread_id = args.thread_id or f"{workflow_name}_{int(time.time())}"
    print(f"Started at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    workflow = WorkflowMode.DEEP_RESEARCH if workflow_name == "deep_research" else WorkflowMode.PLAN_EXECUTE_REPORT
    result = asyncio.run(run_persistent_query(query, source_mode=SourceMode.WEB, workflow_mode=workflow, client_message_id=thread_id))
    print(f"\n[Harness] run_id={result.run_id} status={result.status}")
    print(result.report or "未生成报告")


if __name__ == "__main__":
    main()
