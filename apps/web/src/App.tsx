import { distance, vec2 } from '@board-studio/kernel';
import {
  Button,
  Panel,
  PanelBody,
  PanelHeader,
  PanelTitle,
  Toolbar,
  ToolbarSeparator,
} from '@board-studio/ui';

/**
 * App shell using the design system. The QuadView (outline / rocker /
 * cross-section / 3D) + spec sidebar replace the placeholder body next.
 */
export function App() {
  const length = distance(vec2(0, 0), vec2(72, 0)); // 6'0" in inches

  return (
    <div className="flex h-full flex-col">
      <Toolbar>
        <span className="px-2 font-semibold">Board Studio</span>
        <ToolbarSeparator />
        <Button size="sm" variant="ghost">
          Outline
        </Button>
        <Button size="sm" variant="ghost">
          Rocker
        </Button>
        <Button size="sm" variant="ghost">
          Cross-section
        </Button>
        <Button size="sm" variant="ghost">
          3D
        </Button>
        <div className="flex-1" />
        <Button size="sm">New board</Button>
      </Toolbar>

      <div className="flex flex-1 gap-3 p-3">
        <Panel className="flex-1">
          <PanelHeader>
            <PanelTitle>Editor</PanelTitle>
          </PanelHeader>
          <PanelBody className="grid place-items-center text-muted-foreground">
            QuadView goes here
          </PanelBody>
        </Panel>

        <Panel className="w-72">
          <PanelHeader>
            <PanelTitle>Specs</PanelTitle>
          </PanelHeader>
          <PanelBody className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Length</span>
              <span>
                {length}&quot; ({length / 12}&#39;)
              </span>
            </div>
            <p className="pt-2 text-xs text-muted-foreground">
              Live measurements (volume, width, rocker…) wire up with the store next.
            </p>
          </PanelBody>
        </Panel>
      </div>
    </div>
  );
}
