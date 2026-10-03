"""仅使用 Web 的执行图所需的 Planner 提示词。"""

TASK_DECOMPOSE_PROMPT = """
你是研究任务规划器。把用户问题拆成最多 {max_tasks} 个可执行任务。
本系统只允许 Web 来源：检索任务只能使用 web_search、deep_research 或
deeper_research；可以使用 reflection 做结果校验。避免重复任务，保留必要依赖。
请只输出 JSON 对象，字段为 nodes 和 execution_mode；每个节点包含 task_id、
task_type、description、priority、estimated_tokens、depends_on、parameters、status。
priority 必须是数字 1、2 或 3（1=高，2=中，3=低），不要输出 high/medium/low 字符串。
execution_mode 必须是 "sequential" 或 "parallel"。"dag" 只表示任务依赖图的结构，
不是本系统支持的执行模式；即使任务图存在依赖，也只能填写上述两个值。

用户问题：{query}
""".strip()
CLARIFY_PROMPT = """
你是查询澄清助手。判断用户问题是否缺少完成研究所需的关键信息。
如果不需要澄清，返回 needs_clarification=false 和空 questions；否则给出最多两个
具体问题。只输出 JSON：needs_clarification、questions、ambiguity_types。

领域背景：{domain}
用户问题：{query}
""".strip()

PLAN_REVIEW_PROMPT = """
你是 Web 研究计划审校器。检查给定任务图是否覆盖用户问题、依赖是否合理、是否有
冗余任务。只能保留 Web 任务类型（web_search、deep_research、deeper_research、reflection）。
task_graph.execution_mode 只能是 "sequential" 或 "parallel"，不要输出 "dag"；DAG 是任务图
结构，不是执行模式。
请只输出 JSON，包含 problem_statement、task_graph、acceptance_criteria、validation_results。

原始问题：{query}
澄清后的问题：{refined_query}
候选任务图：{task_graph}
用户确认的前提：{assumptions}
""".strip()
