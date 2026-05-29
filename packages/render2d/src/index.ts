/** @board-studio/render2d — canvas viewport + 2D editor draw layer. */
export {
  worldToScreen,
  screenToWorld,
  fitToBounds,
  zoomAt,
  pan,
  type Viewport,
  type Bounds,
  type ScreenPoint,
} from './viewport';
export { sampleSpline, boundsOf } from './sample';
export { hitTest, type Hit, type HandleKind } from './hit';
export { drawSpline, drawControlPoints, clear, defaultStyle, type DrawStyle } from './draw';
export { SplineEditor, type SplineEditorProps } from './SplineEditor';
