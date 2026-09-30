import { ReactNode, useCallback, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "motion/react";
import { CARD_H, CARD_W, StagePositions } from "../hooks/useStagePositions";
import { STAGES, StageMeta, StageState } from "./stageMeta";
import { StageCard } from "./StageCard";

interface CanvasBoardProps {
  runId: string | null;
  arrived: string[];
  positions: StagePositions;
  onPositionChange: (id: string, x: number, y: number) => void;
  stageState: (id: string) => StageState;
  /** 每张卡片的内容区渲染（由页面按阶段分发） */
  cardContent: (stage: StageMeta) => ReactNode;
  onSelectCard: (stageId: string) => void;
  /** 拖动后是否拦截点击（避免拖完误开抽屉） */
  dragMovedRef: { current: boolean };
}

const CANVAS_MIN_H = 560;

/** 阶段画板：绝对定位卡片 + SVG 贝塞尔连线层（拖动中连线实时跟随） */
export function CanvasBoard({ runId, arrived, positions, onPositionChange, stageState, cardContent, onSelectCard, dragMovedRef }: CanvasBoardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pathsRef = useRef<(SVGPathElement | null)[]>([]);
  const livePositions = useRef<StagePositions>(positions);
  const drawPending = useRef(false);
  const lastDraw = useRef(0);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  livePositions.current = positions;

  // 相邻已渲染卡片的中心点贝塞尔连线（拖动中用 rAF 节流直改 DOM，避免每帧 setState）
  const drawPaths = useCallback(() => {
    if (drawPending.current) return;
    drawPending.current = true;
    requestAnimationFrame(() => {
      drawPending.current = false;
      const now = performance.now();
      if (now - lastDraw.current < 24) return; // ~40fps 上限
      lastDraw.current = now;
      const live = livePositions.current;
      for (let i = 0; i < arrived.length - 1; i++) {
        const el = pathsRef.current[i];
        if (!el) continue;
        const a = live[arrived[i]];
        const b = live[arrived[i + 1]];
        if (!a || !b) continue;
        const x1 = a.x + CARD_W / 2, y1 = a.y + CARD_H / 2;
        const x2 = b.x + CARD_W / 2, y2 = b.y + CARD_H / 2;
        const dx = x2 - x1;
        el.setAttribute("d", `M ${x1} ${y1} C ${x1 + dx / 2} ${y1}, ${x2 - dx / 2} ${y2}, ${x2} ${y2}`);
      }
    });
  }, [arrived]);

  const handleDrag = useCallback((id: string, x: number, y: number) => {
    livePositions.current[id] = { x, y };
    drawPaths();
  }, [drawPaths]);

  const handleDragEnd = useCallback((id: string, x: number, y: number) => {
    // 拖拽结束：落点夹紧到画布内，同步状态并立即重绘连线
    setDraggingId((prev) => (prev === id ? null : prev));
    const el = containerRef.current;
    const maxX = el ? Math.max(0, el.clientWidth - CARD_W) : x;
    const maxY = el ? Math.max(0, el.scrollHeight - CARD_H) : y;
    const clamped = { x: Math.min(Math.max(0, x), maxX), y: Math.min(Math.max(0, y), maxY) };
    livePositions.current[id] = clamped;
    onPositionChange(id, clamped.x, clamped.y);
    lastDraw.current = 0;
    drawPaths();
    dragMovedRef.current = false;
  }, [drawPaths, onPositionChange, dragMovedRef]);

  const canvasHeight = useMemo(() => {
    let bottom = CANVAS_MIN_H;
    arrived.forEach((id) => {
      const p = positions[id];
      if (p) bottom = Math.max(bottom, p.y + CARD_H + 32);
    });
    return bottom;
  }, [arrived, positions]);

  const edges = useMemo(() => arrived.slice(0, -1).map((id, i) => ({ key: id, from: arrived[i], to: arrived[i + 1] })), [arrived]);

  return <div className="board-scroll" style={{ minWidth: 0 }}>
    <div className="canvas-board" ref={containerRef} style={{ height: canvasHeight }} data-run={runId ?? ""}>
      <svg className="canvas-svg" width="100%" height={canvasHeight} aria-hidden>
        <defs>
          <linearGradient id="edge-gradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--accent-border)" />
            <stop offset="100%" stopColor="var(--accent)" />
          </linearGradient>
        </defs>
        {edges.map((edge, index) => {
          const a = positions[edge.from];
          const b = positions[edge.to];
          if (!a || !b) return null;
          const x1 = a.x + CARD_W / 2, y1 = a.y + CARD_H / 2;
          const x2 = b.x + CARD_W / 2, y2 = b.y + CARD_H / 2;
          const dx = x2 - x1;
          return <path
            key={edge.key}
            ref={(el) => { pathsRef.current[index] = el; }}
            className="canvas-edge"
            d={`M ${x1} ${y1} C ${x1 + dx / 2} ${y1}, ${x2 - dx / 2} ${y2}, ${x2} ${y2}`}
            fill="none"
            stroke="url(#edge-gradient)"
            strokeWidth="2"
            strokeLinecap="round"
          />;
        })}
      </svg>

      <AnimatePresence>
        {arrived.map((id) => {
          const stage = STAGES.find((s) => s.id === id);
          if (!stage) return null;
          const position = positions[id] ?? { x: 0, y: 0 };
          return <StageCard
            key={stage.id}
            stage={stage}
            position={position}
            state={stageState(id)}
            dragging={draggingId === id}
            constraintsRef={containerRef}
            onDragStart={(sid) => { setDraggingId(sid); dragMovedRef.current = false; }}
            onDrag={(sid, x, y) => { if (Math.abs(x - positions[sid].x) > 3 || Math.abs(y - positions[sid].y) > 3) dragMovedRef.current = true; handleDrag(sid, x, y); }}
            onDragEnd={handleDragEnd}
            onClick={() => { if (dragMovedRef.current) return; onSelectCard(stage.id); }}
          >{cardContent(stage)}</StageCard>;
        })}
      </AnimatePresence>

      {arrived.length === 0 && <div className="canvas-empty">运行开始后，各阶段将以卡片形式呈现在此画板上，可自由拖拽排列。</div>}
    </div>
  </div>;
}
