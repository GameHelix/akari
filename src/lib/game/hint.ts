import { type Mark, type Puzzle, isWhite } from "./types";
import { computeSegments } from "./grid";
import { evaluate } from "./validation";
import { forcedFromLogic, solveOne } from "./solver";

export interface Hint {
  readonly cell: number;
  readonly action: "bulb" | "cross";
}

/**
 * One deducible next step the player has not yet made.
 *
 * Prefer steps that pure logic forces from the current clues (a genuine, single
 * deduction): a forced bulb the player is missing, then a forced empty they have
 * not crossed off. If propagation alone reveals nothing new, fall back to the
 * unique solution so a correcting hint is always available until the board is
 * solved: a solution bulb they lack, or a cross over a wrongly placed bulb.
 */
export function getHint(p: Puzzle, marks: readonly Mark[]): Hint | null {
  // Nothing to hint once the board already satisfies every rule.
  if (evaluate(p, marks, computeSegments(p)).solved) return null;

  const forced = forcedFromLogic(p);

  for (const cell of forced.bulbs) {
    if (marks[cell] !== "bulb") return { cell, action: "bulb" };
  }
  for (const cell of forced.empties) {
    if (marks[cell] !== "cross") return { cell, action: "cross" };
  }

  const solution = solveOne(p);
  if (!solution) return null;

  for (let i = 0; i < p.cells.length; i++) {
    if (!isWhite(p.cells[i])) continue;
    if (solution[i] === "bulb" && marks[i] !== "bulb") return { cell: i, action: "bulb" };
  }
  for (let i = 0; i < p.cells.length; i++) {
    if (!isWhite(p.cells[i])) continue;
    if (solution[i] !== "bulb" && marks[i] === "bulb") return { cell: i, action: "cross" };
  }
  return null;
}
