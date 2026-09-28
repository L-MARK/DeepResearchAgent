# Deep Research Agent Harness

这是一个基于 Python 的可恢复研究 Agent Harness。当前项目只使用 Web 信息源，通过 Tavily 获取网页证据，并完成：

`Context → Plan → Execute → Report → Verify → Recovery`

运行级别的来源、工具调用、证据、检查点和报告都会写入 SQLite，便于恢复、审计和评测。

## 当前运行边界

- 唯一信息源：Web。
- 唯一外部检索 provider：Tavily。
- 支持两种工作流：`deep_research`、`plan_execute_report`。
- 不包含本地文档导入、知识库构建或图数据库服务。
- 历史数据清理由 Alembic 迁移 `20260921_0004_remove_graph_source` 负责；它只删除旧来源对应的运行轨迹及其子记录。

## 目录

```text
backend/                         FastAPI API 与后台运行服务
frontend/                        React/Vite 前端
src/deepresearch_agent/
  harness/                       运行时、预算、检查点、恢复与来源策略
  retrieval/                     Web provider、路由和统一结果模型
  agents/multi_agent/            规划、执行、报告和验证
  persistence/                   SQLite 模型、仓储与 Alembic 迁移
  evolution/                     技能候选、评测与渐进式启用
scripts/                         本地启动、备份、恢复和评测脚本
tests/                           单元、集成和恢复测试
```

## 本地运行

建议使用 Python 3.10/3.11 和 Node.js 20。PowerShell 下：

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt

Set-Location frontend
npm install
Set-Location ..

Copy-Item .env.example .env
# 在 .env 中设置 TAVILY_API_KEY，以及模型服务所需配置
.\scripts\start-local.ps1
```

启动后：

- API：`http://127.0.0.1:8000`
- 健康检查：`http://127.0.0.1:8000/api/v1/health`
- 前端：`http://127.0.0.1:5173`

停止服务：

```powershell
.\scripts\stop-local.ps1
```

如果不使用启动脚本，也可以分别启动：

```powershell
python -m alembic upgrade head
uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
Set-Location frontend
npm run dev
```

## Docker

```powershell
docker compose up --build
```

Compose 只启动 backend 和 frontend，数据保存在 `data/`、`skills/` 和 `cache/`。

## 配置

从 `.env.example` 创建 `.env`，至少配置：

```dotenv
TAVILY_API_KEY=...
OPENAI_API_KEY=...
```

如果模型通过兼容 OpenAI 的服务提供，还需要设置对应的 base URL 和模型名。不要把真实密钥提交到 Git。

## 数据库迁移

```powershell
python -m alembic upgrade head
```

当前数据库数据不会被整体删除；迁移只按旧来源标识定位并清理对应运行记录，Web 运行记录和用户会话保持不变。

## 测试与静态检查

```powershell
python -m compileall -q backend src scripts tests search_without_stream.py
python -m pytest -q
Set-Location frontend
npm run build
```

外部模型和 Tavily 不可用时，优先运行不需要网络的单元测试和编译检查。

## 命令行入口

```powershell
python search_without_stream.py "请研究一个主题并生成带引用的报告" --workflow deep_research
```

该入口固定使用 Web 来源，不再接受来源切换参数。
