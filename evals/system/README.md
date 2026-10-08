# System evaluation

评测模块直接读取持久化的 Run、Event、Contract、Evidence、Checkpoint、Task 和 ToolCall，历史运行无需重新执行即可统计。

## 指标

- 端到端：Verified Completion Rate、First-pass Completion Rate、Required Contract Pass Rate；
- 证据：Citation Validity、Evidence Redundancy、Source Leakage；
- 可靠性：Recovery Success、Replan Recovery、Checkpoint Integrity、Duplicate Side-effect Rate；
- 效率：P50/P95 Latency、Tokens per Verified Run、Tool Calls per Run、Prefix Cache Hit Rate；
- 有 Gold Evidence 时：Precision@K、Recall@K、MRR、nDCG@K；
- 有人工标签时：Semantic Claim Support、Report Quality、Honest Failure Rate。

`claim_support_proxy` 只是现有确定性 Contract 的代理值，不等同于语义事实支持率。只有在标签文件中提供人工或独立 Judge 结果后，才会输出 `semantic_claim_support_rate`。

## 使用

评测全部历史 Run：

```powershell
python scripts/evaluate_runs.py --output output/evaluation/summary.json
```

带人工/Gold 标签评测：

```powershell
python scripts/evaluate_runs.py --labels evals/system/cases.json --retrieval-k 10 --output output/evaluation/labeled.json
```

API：

```text
GET /api/v1/evaluations/runs/{run_id}
GET /api/v1/evaluations/summary
GET /api/v1/evaluations/summary?run_id=run_a&run_id=run_b&include_runs=false
```

建议固定模型、温度、预算和数据版本，每个非确定性案例至少运行 3 次，并将开发集和隐藏回归集分离。
