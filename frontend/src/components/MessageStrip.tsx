import { motion } from "motion/react";
import { Message, Run } from "../types/api";

interface MessageStripProps {
  collapsed: boolean;
  onToggle: () => void;
  messages: Message[];
  runs: Map<string, Run>;
  onOpenReport?: (runId: string) => void;
}

/** 可折叠会话消息条：默认单行摘要，展开后最多 240px 高度滚动列表 */
export function MessageStrip({ collapsed, onToggle, messages, runs, onOpenReport }: MessageStripProps) {
  return <section className="msg-strip">
    <button type="button" className="msg-strip-toggle" onClick={onToggle} aria-expanded={!collapsed}>
      <span className="msg-strip-icon">{collapsed ? "☰" : "▾"}</span>
      <span>会话消息 {messages.length} 条</span>
      <span className="msg-strip-hint">{collapsed ? "点击展开" : "点击收起"}</span>
    </button>
    <motion.div
      className="msg-strip-list"
      initial={false}
      animate={{ height: collapsed ? 0 : 240 }}
      transition={{ type: "spring", stiffness: 260, damping: 30 }}
    >
      <div className="msg-strip-inner">
        {messages.length === 0 && <div className="msg-strip-empty">暂无消息</div>}
        {messages.map((message) => {
          const linked = message.run_id ? runs.get(message.run_id) : undefined;
          const isReport = message.role === "assistant" && Boolean(linked) && message.content.length > 1200;
          const preview = isReport ? reportPreview(message.content) : message.content;
          return <div key={message.message_id} className={`message ${message.role} is-strip${isReport ? " is-report-summary" : ""}`}>
            <div className="message-meta">
              <span>{message.role === "user" ? "你" : "Research Agent"}</span>
              {linked && <span className="source-badge web">Web</span>}
            </div>
              <div className="message-body">{preview}</div>
              {isReport && linked && <div className="message-report-meta"><span>{message.content.length.toLocaleString()} 字符 · 完整内容已收纳到报告工作区</span><button type="button" onClick={() => onOpenReport?.(linked.run_id)}>查看完整报告 →</button></div>}
          </div>;
        })}
      </div>
    </motion.div>
  </section>;
}

function reportPreview(content: string): string {
  return content
    .replace(/^##\s+全量证据索引\s*[\s\S]*$/m, "")
    .replace(/^#{1,4}\s+/gm, "")
    .replace(/\[(?:\^)?ev_[\w-]+\]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 260) + "…";
}
