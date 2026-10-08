import type { GameState, Level, Stack } from '../game/model.js';
import { createProjection } from './projection.js';

export const WHITE_TOWER_COLORS = Object.freeze({
  background: '#60C0FE',
  tileTop: '#F4F4F4',
  tileBevel: '#ECEEED',
  tileSideLight: '#DDDFDC',
  tileSideDark: '#C9CFCA',
  floor: '#FFDD28',
  floorSeam: '#EAC125',
  arrow: '#FF951C',
  chevron: '#FFFFFF',
  shadow: '#3D83D2',
});

export type RenderViewState = Readonly<{
  revision: number;
  level: Level;
  stacks: readonly Stack[];
}>;

export function createRenderView(level: Level, state: GameState, revision = state.moveCount): RenderViewState {
  return Object.freeze({ revision, level, stacks: state.stacks });
}

export function createLevelPreset(level: Level) {
  return Object.freeze({ projection: createProjection(level, level.totalTiles), levelId: level.id });
}
