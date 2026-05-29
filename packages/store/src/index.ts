/** @board-studio/store — board document, command/undo, derived-spec selectors. */
export { createBoardStore, type BoardState, type Selection } from './board-store';
export {
  getTargetSpline,
  withSpline,
  moveKnotEnd,
  moveKnotTangent,
  type SplineTarget,
} from './edits';
export { selectSpecs, type BoardSpecs } from './selectors';
