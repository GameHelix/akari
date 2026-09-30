import { type Mark, type Puzzle, isWhite } from "./types";
import { type Segments } from "./grid";

export interface Illumination {
  /** Per cell: is this white cell lit by some bulb? (walls are always false) */
  readonly lit: boolean[];
  /** White cells that are not yet lit. */
  readonly unlit: number[];
  readonly litCount: number;
  /** Per cell: is this a bulb that shares a run with another bulb (a conflict)? */
  readonly bulbConflicts: boolean[];
  /** Bulbs currently in each segment. */
  readonly segBulbs: Int32Array;
}

/**
 * Compute the lit map and bulb conflicts from the player's marks.
 *
 * A white cell is lit when its horizontal run or its vertical run contains a
 * bulb. Two bulbs conflict ("see each other") when they lie in the same run —
 * i.e. a run holds more than one bulb.
 */
export function illuminate(p: Puzzle, marks: readonly Mark[], seg: Segments): Illumination {
  const n = p.rows * p.cols;
  const segBulbs = new Int32Array(seg.count);
  for (let i = 0; i < n; i++) {
    if (marks[i] === "bulb" && isWhite(p.cells[i])) {
      segBulbs[seg.hSeg[i]]++;
      segBulbs[seg.vSeg[i]]++;
    }
  }

  const lit = new Array<boolean>(n).fill(false);
  const bulbConflicts = new Array<boolean>(n).fill(false);
  const unlit: number[] = [];
  let litCount = 0;

  for (let i = 0; i < n; i++) {
    if (!isWhite(p.cells[i])) continue;
    const h = seg.hSeg[i];
    const v = seg.vSeg[i];
    const isLit = segBulbs[h] > 0 || segBulbs[v] > 0;
    lit[i] = isLit;
    if (isLit) litCount++;
    else unlit.push(i);
    if (marks[i] === "bulb" && (segBulbs[h] > 1 || segBulbs[v] > 1)) {
      bulbConflicts[i] = true;
    }
  }

  return { lit, unlit, litCount, bulbConflicts, segBulbs };
}
