import { ReactNode, RefObject } from "react";
import { motion, PanInfo } from "motion/react";
import { CARD_H, CARD_W, StagePosition } from "../hooks/useStagePositions";
import { StageMeta, StageState } from "./stageMeta";

const STATE_LABELS: Record<StageState, string> = {
  pending: "未开始",
  busy: "进行中",
  paused: "已暂停",
  done: "已完成",
  cancelled: "已取消",
  error: "异常",
};

interface StageCardProps {
  stage: StageMeta;
  position: StagePosition;
  state: StageState;
  dragging: boolean;
  constraintsRef: RefObject<HTMLElement | null>;
  onDragStart: (id: string) => void;
  onDrag: (id: string, x: number, y: number) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onClick: () => void;
  children: ReactNode;
}

/** 可自由拖动的阶段卡片（motion.div 绝对定位，拖动实时上报位置供连线层跟随） */
export function StageCard({ stage, position, state, dragging, constraintsRef, onDragStart, onDrag, onDragEnd, onClick, children }: StageCardProps) {
  const base = position;
  const reportOffset = (_: unknown, info: PanInfo) => ({ x: base.x + info.offset.x, y: base.y + info.offset.y });
  return <motion.div
    className={`stage-card is-${state}`}
    style={{ width: CARD_W, height: CARD_H, position: "absolute", top: 0, left: 0 }}
    animate={{ x: base.x, y: base.y, scale: dragging ? 1.03 : 1, zIndex: dragging ? 30 : 10 }}
    transition={{ type: "spring", stiffness: 380, damping: 34 }}
    drag
    dragMomentum={false}
    dragElastic={0.06}
    dragConstraints={constraintsRef}
    onDragStart={() => onDragStart(stage.id)}
    onDrag={(_, info) => { const p = reportOffset(_, info); onDrag(stage.id, p.x, p.y); }}
    onDragEnd={(_, info) => { const p = reportOffset(_, info); onDragEnd(stage.id, p.x, p.y); }}
    onClick={onClick}
    whileTap={{ cursor: "grabbing" }}
  >
    <header className="stage-card-head">
      <span className="stage-icon">{stage.icon}</span>
      <span className="stage-name">{stage.label}</span>
      <span className="stage-state">{STATE_LABELS[state]}</span>
    </header>
    <div className="stage-card-body">{children}</div>
  </motion.div>;
}
