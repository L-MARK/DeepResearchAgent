import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { STAGES } from "../components/stageMeta";

export interface StagePosition { x: number; y: number }
export type StagePositions = Record<string, StagePosition>;

export const CARD_W = 300;
export const CARD_H = 188;
const CARD_GAP = 44;
const ROW_GAP = 48;
const PAD = 32;
const PER_ROW = 5;
const STORAGE_PREFIX = "board.positions";

/** 默认流水布局：横向 5 张一列，第 6 张起折行 */
export function defaultPositions(count: number): StagePositions {
  const positions: StagePositions = {};
  STAGES.slice(0, count).forEach((stage, index) => {
    const row = Math.floor(index / PER_ROW);
    positions[stage.id] = {
      x: PAD + (index % PER_ROW) * (CARD_W + CARD_GAP),
      y: PAD + row * (CARD_H + ROW_GAP),
    };
  });
  return positions;
}

function loadPositions(runId: string): StagePositions | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}.${runId}`);
    return raw ? (JSON.parse(raw) as StagePositions) : null;
  } catch {
    return null;
  }
}

function savePositions(runId: string, positions: StagePositions): void {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}.${runId}`, JSON.stringify(positions));
  } catch {
    /* 存储不可用时忽略 */
  }
}

/**
 * 画板卡片位置：惰性初始化（localStorage 优先），新到达卡片追加默认位，
 * 不重置用户已拖拽的位置。
 */
export function useStagePositions(runId: string | null, arrived: string[]) {
  const [compact, setCompact] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 760px)").matches);
  const [positions, setPositions] = useState<StagePositions>(() =>
    runId ? (loadPositions(runId) ?? {}) : {}
  );
  const positionsRef = useRef<StagePositions>(positions);
  positionsRef.current = positions;

  // 切换 run 时重载该 run 的已保存位置（避免残留上一 run 的拖拽布局）
  useEffect(() => {
    setPositions(runId ? (loadPositions(runId) ?? {}) : {});
  }, [runId]);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 760px)");
    const onChange = () => setCompact(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const effective = useMemo(() => {
    if (compact) {
      return Object.fromEntries(arrived.map((id, index) => [id, { x: 0, y: 20 + index * (CARD_H + 28) }]));
    }
    const result: StagePositions = { ...positions };
    const defaults = defaultPositions(arrived.length);
    arrived.forEach((id) => {
      if (!result[id]) result[id] = defaults[id] ?? { x: PAD, y: PAD };
    });
    return result;
  }, [arrived, compact, positions]);

  const update = useCallback(
    (id: string, x: number, y: number) => {
      setPositions((prev) => ({ ...prev, [id]: { x, y } }));
      if (runId) savePositions(runId, { ...positionsRef.current, [id]: { x, y } });
    },
    [runId]
  );

  return { positions: effective, update };
}
