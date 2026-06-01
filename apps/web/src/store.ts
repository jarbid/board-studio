import { createBoardStore } from '@board-studio/store';

/** App-wide board document store (single instance for the session). */
export const boardStore = createBoardStore();
