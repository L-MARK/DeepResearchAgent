import { motion } from "motion/react";

/** 输入框隐藏后的右下角悬浮球：点击恢复输入框，呼吸阴影强调 */
export function FloatingComposer({ onClick }: {onClick: () => void}) {
  return <motion.button
    type="button"
    className="fab"
    onClick={onClick}
    aria-label="展开输入框"
    initial={{ opacity: 0, y: 24, scale: 0.85 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    exit={{ opacity: 0, y: 24, scale: 0.85 }}
    transition={{ type: "spring", stiffness: 320, damping: 24 }}
    whileHover={{ scale: 1.08 }}
    whileTap={{ scale: 0.94 }}
  >
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  </motion.button>;
}
