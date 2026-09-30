import { type Mark, type Puzzle, clueOf } from "./types";
import { adjacentWhite, type Segments } from "./grid";
import { illuminate } from "./illumination";

export type ClueStatus = "under" | "exact" | "over";

/** Bulbs orthogonally adjacent to the wall at `i`. */
export function adjacentBulbs(p: Puzzle, marks: readonly Mark[], i: number): number {
  let n = 0;
  for (const j of adjacentWhite(p, i)) if (marks[j] === "bulb") n++;
  return n;
}

export interface Evaluation {
  readonly lit: boolean[];
  readonly bulbConflicts: boolean[];
  readonly unlitCount: number;
  readonly conflictCount: number;
  /** Numbered wall index → satisfied state. */
  readonly clueStatus: Map<number, ClueStatus>;
  /** Numbered wall index → current adjacent-bulb count. */
  readonly clueCurrent: Map<number, number>;
  readonly bulbCount: number;
  readonly solved: boolean;
}

/**
 * Full live evaluation of a board for feedback and win detection.
 *
 * The board is solved when every white cell is lit, no two bulbs see each
 * other, and every numbered wall has exactly its clue many adjacent bulbs.
 */
export function evaluate(p: Puzzle, marks: readonly Mark[], seg: Segments): Evaluation {
  const ill = illuminate(p, marks, seg);
  const clueStatus = new Map<number, ClueStatus>();
  const clueCurrent = new Map<number, number>();
  let cluesOk = true;

  for (let i = 0; i < p.cells.length; i++) {
    const k = clueOf(p.cells[i]);
    if (k === null) continue;
    const cur = adjacentBulbs(p, marks, i);
    clueCurrent.set(i, cur);
    const status: ClueStatus = cur < k ? "under" : cur > k ? "over" : "exact";
    clueStatus.set(i, status);
    if (status !== "exact") cluesOk = false;
  }

  let conflictCount = 0;
  let bulbCount = 0;
  for (let i = 0; i < marks.length; i++) {
    if (marks[i] === "bulb") {
      bulbCount++;
      if (ill.bulbConflicts[i]) conflictCount++;
    }
  }

  const solved = ill.unlit.length === 0 && conflictCount === 0 && cluesOk;

  return {
    lit: ill.lit,
    bulbConflicts: ill.bulbConflicts,
    unlitCount: ill.unlit.length,
    conflictCount,
    clueStatus,
    clueCurrent,
    bulbCount,
    solved,
  };
}
