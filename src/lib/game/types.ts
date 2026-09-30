/**
 * Core types for AKARI (Light Up), the Nikoli logic puzzle.
 *
 * The puzzle grid is a fixed layout of white cells and black walls; some walls
 * carry a clue 0–4. The player's placements (bulbs and crosses) live in a
 * separate parallel array so the immutable puzzle is never mutated during play.
 */

/** A playable white cell. */
export const WHITE = -1;
/** A black wall with no clue number. */
export const WALL = -2;

/**
 * A cell's fixed value: {@link WHITE}, {@link WALL}, or a clue in 0–4 which is
 * itself a wall that requires exactly that many orthogonally adjacent bulbs.
 */
export type CellValue = number;

export interface Puzzle {
  readonly rows: number;
  readonly cols: number;
  /** Row-major cell values, length `rows * cols`. */
  readonly cells: readonly CellValue[];
}

/** What the player has placed on a white cell. */
export type Mark = "empty" | "bulb" | "cross";

export function isWhite(v: CellValue): boolean {
  return v === WHITE;
}

export function isWall(v: CellValue): boolean {
  return v === WALL || (v >= 0 && v <= 4);
}

/** The clue on a wall, or `null` when the cell is white or an unnumbered wall. */
export function clueOf(v: CellValue): number | null {
  return v >= 0 && v <= 4 ? v : null;
}

/** A fresh array of empty player marks sized to the puzzle. */
export function emptyMarks(p: Puzzle): Mark[] {
  return new Array<Mark>(p.rows * p.cols).fill("empty");
}
