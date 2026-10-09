---
name: web-narrative-character-arc-research
description: 针对 source_mode=web、workflow_mode=plan_execute_report 的"分析虚构角色心路/心理变化过程"任务，规定分阶段检索词设计、失败查询处理、按心路阶段成节、逐段就近引用当前
  Run evidence_id、来源多样性与缺口披露的边界。
version: 0.1.0
status: candidate
source_modes:
- web
created_from_runs:
- run_8c5095d98d3f45209646c63584bed812
---

## 触发条件

1. 用户请求包含"分析某虚构角色的心路/心理变化过程"
2. source_mode 为 web 且 workflow_mode 为 plan_execute_report
3. 需要按时间或阶段组织报告并给出引用

## 输入要求

1. user_goal 中的角色名与作品名
2. source_mode=web 约束
3. 角色关键情节阶段关键词（如童年创伤、自我封闭、加冕失控、释放、姐妹关系、自我接纳、续集）
4. 当前 Run 的 Evidence Ledger 中可用 evidence_id

## 步骤

1. 首个 web_search 返回 TOOL_FAILED 且 evidence 为空时，不得原样重放同一 query；改为按情节阶段拆分为新的 query 重新检索。
2. 每次检索使用"角色实体 + 该阶段专属情节关键词"组合，使不同 query 命中不同叙事阶段，避免同一阶段重复检索。
3. 报告按心路阶段分节（如创伤自责与压抑封闭、加冕失控与释放、因爱回归与自我接纳、续集延续），每个阶段的实质性主张就近引用当前 Run 的 evidence_id。
4. 引用前确认 evidence_id 属于当前 Run 的 Evidence Ledger；正文可只引用支撑结论的卡片，但不得新增未出现在台账中的来源或 ID。
5. 来源多样性只能按实际返回来源统计；若独立来源不足或均为同类二级来源，必须在报告中披露该局限，不得伪造或补写未出现的平台。

## 允许工具

1. web_search

## 失败回退

1. 若阶段检索持续失败或证据不足，则仅基于已成功返回的证据输出报告，显式标注未覆盖阶段与来源局限；不得引入非 web 来源、不得扩大检索工具权限。

## 反模式

1. 首个 TOOL_FAILED 后原样重放同一 query 或同一实体关键词集合。
2. 把某一条百科摘要整段抄入报告充当结论，而非按阶段归纳并就近引用。
3. 在正文中声明"多平台一致证实"，但实际返回来源并未包含这些平台。
4. 为凑齐阶段数而编造情节或使用未出现在当前 Run 台账中的 evidence_id。
5. 把本技能类推到非 web 来源模式或需要一手影片文本的考据任务。

## 停止与降级条件

1. 同一 query 连续失败达到 2 次时停止重试，改为披露证据缺口并降级断言强度。
2. 阶段覆盖与最小证据要求已满足（当前 Run 判定 min_evidence 通过）时停止新增检索。
3. 剩余可用检索次数不足以覆盖缺失阶段时停止，并在报告中标注未覆盖阶段。
4. 无法确认某 evidence_id 属于当前 Run 台账时停止引用该 ID。

## 验证方式

1. 核对 citation_integrity 的 missing 与 uncited_claims 均为空。
2. 核对 evidence_card_coverage 的 ledger/card/annex/processed/routed 计数与 ID 集合一致。
3. 核对报告每个非空阶段标题下均有就近引用，且引用 ID 可在当前 Run 台账中检索到。
4. 核对报告列出的来源与工具实际返回来源一致，差异处需有局限说明。

## 已知限制

1. 仅覆盖 ReviewPack 中实际出现的 plan_execute_report + web 组合，不适用于其他来源模式或工作流。
2. 证据来源以百科、影评与转载类二级网页为主，未包含一手剧本或影片文本校验。
3. 技能只约束检索与引用流程，不提供角色心理分析结论本身。

## Machine Policy

```yaml
max_web_search_calls: 4
max_retries_per_query: 1
stop_on_consecutive_query_failures: 2
min_evidence_records: 1
require_evidence_id_in_current_run: true
require_citation_per_claim: true
allow_new_query_after_failure: true
allow_tool_expansion: false
allow_non_web_sources: false
disclose_limitation_if_independent_sources_below: 2
```
