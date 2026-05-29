import type { BezierBoard } from '@board-studio/kernel';
import type { BoardState } from '@board-studio/store';
import { OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import type { BufferGeometry } from 'three';
import type { StoreApi } from 'zustand/vanilla';
import { boardGeometry, boardSpan } from './geometry';

export interface Board3DViewProps {
  store: StoreApi<BoardState>;
  wireframe?: boolean;
  className?: string;
}

function BoardMesh({ board, wireframe }: { board: BezierBoard; wireframe: boolean }) {
  const geometry = useMemo<BufferGeometry | null>(() => {
    try {
      return boardGeometry(board);
    } catch {
      return null;
    }
  }, [board]);

  // Free the previous geometry when it changes / unmounts.
  useEffect(() => () => geometry?.dispose(), [geometry]);

  if (!geometry) return null;
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial color="#cc785c" roughness={0.55} metalness={0.05} wireframe={wireframe} />
    </mesh>
  );
}

/** Orbitable 3D view of the board, meshed from the kernel tessellation. */
export function Board3DView({ store, wireframe = false, className }: Board3DViewProps) {
  const board = useSyncExternalStore(store.subscribe, () => store.getState().board);
  const span = board ? boardSpan(board) : 200;
  const d = span * 1.1;

  return (
    <div className={className} style={{ width: '100%', height: '100%' }}>
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, -d, d * 0.45], up: [0, 0, 1], fov: 35, near: 1, far: span * 50 }}
      >
        <color attach="background" args={['#1b1b1f']} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[span, -span, span * 1.5]} intensity={1.1} />
        <directionalLight position={[-span, span, span]} intensity={0.4} />
        {board && <BoardMesh board={board} wireframe={wireframe} />}
        <OrbitControls enableDamping dampingFactor={0.1} />
      </Canvas>
    </div>
  );
}
