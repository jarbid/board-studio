import { parseBrd } from '@board-studio/io';
import { SplineEditor } from '@board-studio/render2d';
import { selectSpecs } from '@board-studio/store';
import {
  Button,
  Panel,
  PanelBody,
  PanelHeader,
  PanelTitle,
  Toolbar,
  ToolbarSeparator,
} from '@board-studio/ui';
import { useEffect, useState, useSyncExternalStore } from 'react';
import type { SplineTarget } from '@board-studio/store';
import sampleBrd from './sample-board.brd?raw';
import { boardStore } from './store';

type View = 'outline' | 'rocker' | 'crossSection';

const cm = (v: number) => `${v.toFixed(2)} cm`;
const inches = (v: number) => `${(v / 2.54).toFixed(2)}"`;

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

export function App() {
  const board = useSyncExternalStore(boardStore.subscribe, () => boardStore.getState().board);
  // Re-render on history changes so the undo/redo buttons enable/disable.
  useSyncExternalStore(boardStore.subscribe, () => boardStore.getState().past.length);

  useEffect(() => {
    if (boardStore.getState().board) return;
    try {
      const { board } = parseBrd(sampleBrd);
      boardStore.getState().load(board);
    } catch (e) {
      console.error('Failed to load sample board', e);
    }
  }, []);

  const specs = board ? selectSpecs(board) : null;
  const s = boardStore.getState();
  const [view, setView] = useState<View>('outline');
  const [csIndex, setCsIndex] = useState(1);

  // Real cross-sections are indices 1..n-2 (0 and n-1 are nose/tail dummies).
  const sectionCount = board?.crossSections.length ?? 0;
  const firstReal = 1;
  const lastReal = Math.max(1, sectionCount - 2);
  const clampedCs = Math.min(Math.max(csIndex, firstReal), lastReal);

  const editorTargets: SplineTarget[] =
    view === 'outline'
      ? [{ kind: 'outline' }]
      : view === 'rocker'
        ? [{ kind: 'deck' }, { kind: 'bottom' }]
        : [{ kind: 'crossSection', index: clampedCs }];

  const editorTitle =
    view === 'outline'
      ? 'Outline'
      : view === 'rocker'
        ? 'Rocker (deck + bottom)'
        : `Cross-section ${clampedCs} / ${lastReal}`;

  return (
    <div className="flex h-full flex-col">
      <Toolbar>
        <span className="px-2 font-semibold">Board Studio</span>
        <ToolbarSeparator />
        <Button
          size="sm"
          variant={view === 'outline' ? 'secondary' : 'ghost'}
          onClick={() => setView('outline')}
        >
          Outline
        </Button>
        <Button
          size="sm"
          variant={view === 'rocker' ? 'secondary' : 'ghost'}
          onClick={() => setView('rocker')}
        >
          Rocker
        </Button>
        <Button
          size="sm"
          variant={view === 'crossSection' ? 'secondary' : 'ghost'}
          onClick={() => setView('crossSection')}
        >
          Cross-section
        </Button>
        <Button size="sm" variant="ghost" disabled>
          3D
        </Button>
        <ToolbarSeparator />
        <Button size="sm" variant="ghost" disabled={!s.canUndo()} onClick={() => s.undo()}>
          Undo
        </Button>
        <Button size="sm" variant="ghost" disabled={!s.canRedo()} onClick={() => s.redo()}>
          Redo
        </Button>
        <div className="flex-1" />
        <Button size="sm" disabled>
          New board
        </Button>
      </Toolbar>

      <div className="flex flex-1 gap-3 p-3">
        <Panel className="flex flex-1 flex-col">
          <PanelHeader>
            <PanelTitle>{editorTitle}</PanelTitle>
            <div className="flex items-center gap-2">
              {view === 'crossSection' && (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={clampedCs <= firstReal}
                    onClick={() => setCsIndex(clampedCs - 1)}
                  >
                    ‹ Prev
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={clampedCs >= lastReal}
                    onClick={() => setCsIndex(clampedCs + 1)}
                  >
                    Next ›
                  </Button>
                </>
              )}
              <span className="text-xs text-muted-foreground">
                drag points • scroll zoom • drag empty to pan
              </span>
            </div>
          </PanelHeader>
          <PanelBody className="flex-1 p-0">
            <SplineEditor
              key={view === 'crossSection' ? `cs-${clampedCs}` : view}
              store={boardStore}
              targets={editorTargets}
              mirrorY={view === 'outline'}
              mirrorX={view === 'crossSection'}
            />
          </PanelBody>
        </Panel>

        <Panel className="w-72">
          <PanelHeader>
            <PanelTitle>Specs</PanelTitle>
          </PanelHeader>
          <PanelBody className="space-y-1 text-sm">
            {specs ? (
              <>
                <SpecRow label="Length" value={`${inches(specs.length)} (${cm(specs.length)})`} />
                <SpecRow label="Width" value={`${inches(specs.maxWidth)} (${cm(specs.maxWidth)})`} />
                <SpecRow
                  label="Thickness"
                  value={`${inches(specs.thickness)} (${cm(specs.thickness)})`}
                />
                <SpecRow label="Max rocker" value={cm(specs.maxRocker)} />
                <SpecRow label="Volume" value={`${specs.volumeLiters.toFixed(1)} L`} />
                <p className="pt-2 text-xs text-muted-foreground">
                  Live from the kernel — edit the outline and watch width/volume update.
                </p>
              </>
            ) : (
              <p className="text-muted-foreground">Loading…</p>
            )}
          </PanelBody>
        </Panel>
      </div>
    </div>
  );
}
