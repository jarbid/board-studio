import { type BezierBoard } from '@board-studio/kernel';
import { type BoardState, type SplineTarget, getTargetSpline } from '@board-studio/store';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { StoreApi } from 'zustand/vanilla';
import { clear, defaultStyle, drawControlPoints, drawSpline, type DrawStyle } from './draw';
import { hitTest, type Hit } from './hit';
import { boundsOf, sampleSpline } from './sample';
import { fitToBounds, pan, screenToWorld, zoomAt, type Viewport } from './viewport';

export interface SplineEditorProps {
  store: StoreApi<BoardState>;
  /** One or more splines to draw + edit in this view (e.g. [deck, bottom]). */
  targets: SplineTarget[];
  /** Mirror across y=0 (for the outline, a half-width). */
  mirrorY?: boolean;
  /** Mirror across x=0 (for cross-sections, drawn on the +x half). */
  mirrorX?: boolean;
  /** Per-target curve colors (cycled if shorter than targets). */
  colors?: string[];
  className?: string;
}

type DragState =
  | { mode: 'edit'; target: SplineTarget; hit: Hit }
  | { mode: 'pan'; lastX: number; lastY: number }
  | null;

const PALETTE = ['#cc785c', '#6ca0cc', '#8fbf73', '#c08fcf'];

const useBoard = (store: StoreApi<BoardState>): BezierBoard | null =>
  useSyncExternalStore(store.subscribe, () => store.getState().board);

const sameTarget = (a: SplineTarget, b: SplineTarget): boolean =>
  a.kind === b.kind &&
  (a.kind !== 'crossSection' || (b as { index: number }).index === a.index);

/** A canvas editor for one or more board splines (outline / deck+bottom / cross-section). */
export function SplineEditor({
  store,
  targets,
  mirrorY = false,
  mirrorX = false,
  colors,
  className,
}: SplineEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const board = useBoard(store);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [vp, setVp] = useState<Viewport | null>(null);
  const drag = useRef<DragState>(null);
  const selection = useSyncExternalStore(store.subscribe, () => store.getState().selection);
  const key = JSON.stringify(targets);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // Re-fit when the target set changes, or we first get a board + a size.
  useEffect(() => {
    if (!board || size.w === 0) return;
    const all = targets.flatMap((t) => sampleSpline(getTargetSpline(board, t)));
    if (all.length === 0) return;
    let pts = all;
    if (mirrorY) pts = pts.flatMap((p) => [p, { x: p.x, y: -p.y }]);
    if (mirrorX) pts = pts.flatMap((p) => [p, { x: -p.x, y: p.y }]);
    setVp(fitToBounds(boundsOf(pts), size.w, size.h));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, board === null, size.w, size.h]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !vp || !board || size.w === 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size.w * dpr;
    canvas.height = size.h * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    clear(ctx, size.w, size.h);
    const palette = colors ?? PALETTE;
    targets.forEach((t, i) => {
      const spline = getTargetSpline(board, t);
      const style: DrawStyle = { ...defaultStyle, curve: palette[i % palette.length]! };
      drawSpline(ctx, spline, vp, style, { mirrorX, mirrorY });
      const sel = selection && sameTarget(selection.target, t) ? selection.index : null;
      drawControlPoints(ctx, spline, vp, style, sel);
    });
  }, [board, vp, size, selection, key, mirrorX, mirrorY, colors, targets]);

  const localPoint = (e: React.PointerEvent): { x: number; y: number } => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!vp || !board) return;
      canvasRef.current!.setPointerCapture(e.pointerId);
      const p = localPoint(e);
      if (e.button === 1) {
        drag.current = { mode: 'pan', lastX: p.x, lastY: p.y };
        return;
      }
      for (const t of targets) {
        const hit = hitTest(getTargetSpline(board, t), vp, p);
        if (hit) {
          store.getState().select({ target: t, index: hit.index });
          store.getState().beginEdit();
          drag.current = { mode: 'edit', target: t, hit };
          return;
        }
      }
      store.getState().select(null);
      drag.current = { mode: 'pan', lastX: p.x, lastY: p.y };
    },
    [vp, board, store, targets],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const d = drag.current;
      if (!d || !vp) return;
      const p = localPoint(e);
      if (d.mode === 'pan') {
        setVp((cur) => (cur ? pan(cur, p.x - d.lastX, p.y - d.lastY) : cur));
        d.lastX = p.x;
        d.lastY = p.y;
        return;
      }
      const world = screenToWorld(vp, p);
      if (d.hit.kind === 'end') store.getState().moveControlPoint(d.target, d.hit.index, world);
      else store.getState().moveTangent(d.target, d.hit.index, d.hit.kind, world);
    },
    [vp, store],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (drag.current?.mode === 'edit') store.getState().endEdit();
      drag.current = null;
      canvasRef.current?.releasePointerCapture(e.pointerId);
    },
    [store],
  );

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!vp) return;
      const p = localPoint(e as unknown as React.PointerEvent);
      setVp(zoomAt(vp, p, e.deltaY < 0 ? 1.1 : 1 / 1.1));
    },
    [vp],
  );

  return (
    <div ref={containerRef} className={className} style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none', cursor: 'crosshair' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onWheel={onWheel}
      />
    </div>
  );
}
