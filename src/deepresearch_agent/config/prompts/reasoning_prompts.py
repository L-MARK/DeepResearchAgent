"""用于生成有界 Web 后续查询的提示词。"""

SUB_QUERY_PROMPT = """
将下面的研究问题拆分为最多三个互不重复、可直接用于 Web 搜索的子问题。
只输出 Python 列表，例如：["问题一", "问题二"]。
研究问题：{original_query}
""".strip()
FOLLOWUP_QUERY_PROMPT = """
根据原始问题和已收集的网页证据，生成最多两个用于补充验证的 Web 搜索问题。
如果没有必要补充检索，输出空列表。只输出 Python 列表。
原始问题：{original_query}
已收集证据：{retrieved_info}
""".strip()

SEARCH_MULTI_HYPOTHESIS_PROMPT = """
针对下面的问题提出最多三个可验证的搜索方向。每行一个方向，不要编造结论。
问题：{query}
""".strip()
