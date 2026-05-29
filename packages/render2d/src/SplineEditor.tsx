import { type BezierBoard } from '@board-studio/kernel';
import { type BoardState, type SplineTarget, getTargetSpline } from '@board-studio/store';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { StoreApi } from 'zustand/vanilla';
import { clear, defaultStyle, drawControlPoints, drawSpline } from './draw';
import { hitTest, type Hit } from './hit';
import { boundsOf, sampleSpline } from './sample';
import { fitToBounds, pan, screenToWorld, zoomAt, type Viewport } from './viewport';

export interface SplineEditorProps {
  store: StoreApi<BoardState>;
  target: SplineTarget;
  /** Mirror the curve across y=0 (used for the outline, which is a half-width). */
  mirrorY?: boolean;
  className?: string;
}

type DragState =
  | { mode: 'edit'; hit: Hit }
  | { mode: 'pan'; lastX: number; lastY: number }
  | null;

const useBoard = (store: StoreApi<BoardState>): BezierBoard | null =>
  useSyncExternalStore(store.subscribe, () => store.getState().board);

/** A canvas editor for one spline of the board (outline / deck / bottom). */
export function SplineEditor({ store, target, mirrorY = false, className }: SplineEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const board = useBoard(store);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [vp, setVp] = useState<Viewport | null>(null);
  const drag = useRef<DragState>(null);
  const selection = useSyncExternalStore(store.subscribe, () => store.getState().selection);

  // Track container size.
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // Fit the view once we have a board + a size and no viewport yet.
  useEffect(() => {
    if (vp || !board || size.w === 0) return;
    const pts = sampleSpline(getTargetSpline(board, target));
    if (pts.length === 0) return;
    const b = boundsOf(mirrorY ? pts.flatMap((p) => [p, { x: p.x, y: -p.y }]) : pts);
    setVp(fitToBounds(b, size.w, size.h));
  }, [vp, board, size, target, mirrorY]);

  // Redraw whenever board / viewport / size / selection changes.
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
    const spline = getTargetSpline(board, target);
    drawSpline(ctx, spline, vp, defaultStyle, mirrorY);
    const sel = selection && selectionMatches(selection.target, target) ? selection.index : null;
    drawControlPoints(ctx, spline, vp, defaultStyle, sel);
  }, [board, vp, size, selection, target, mirrorY]);

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
      const hit = hitTest(getTargetSpline(board, target), vp, p);
      if (hit) {
        store.getState().select({ target, index: hit.index });
        store.getState().beginEdit();
        drag.current = { mode: 'edit', hit };
      } else {
        store.getState().select(null);
        drag.current = { mode: 'pan', lastX: p.x, lastY: p.y };
      }
    },
    [vp, board, store, target],
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
      if (d.hit.kind === 'end') store.getState().moveControlPoint(target, d.hit.index, world);
      else store.getState().moveTangent(target, d.hit.index, d.hit.kind, world);
    },
    [vp, store, target],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const d = drag.current;
      if (d?.mode === 'edit') store.getState().endEdit();
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

function selectionMatches(a: SplineTarget, b: SplineTarget): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'crossSection' && b.kind === 'crossSection') return a.index === b.index;
  return true;
}
