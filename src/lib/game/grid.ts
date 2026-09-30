import { type Puzzle, isWhite } from "./types";

export function idx(r: number, c: number, cols: number): number {
  return r * cols + c;
}
export function rowOf(i: number, cols: number): number {
  return Math.floor(i / cols);
}
export function colOf(i: number, cols: number): number {
  return i % cols;
}

/**
 * Maximal straight runs of white cells. A bulb lights its entire horizontal run
 * and its entire vertical run (nothing blocks a beam inside a run, by
 * definition), so runs are the natural unit for both illumination and the
 * "no two bulbs see each other" rule.
 *
 * Every white cell belongs to exactly one horizontal segment and one vertical
 * segment; `hSeg`/`vSeg` hold those ids (‑1 for walls) and `members[id]` lists a
 * segment's cells. Horizontal and vertical segments share one id space.
 */
export interface Segments {
  readonly hSeg: Int32Array;
  readonly vSeg: Int32Array;
  readonly members: readonly number[][];
  readonly count: number;
}

export function computeSegments(p: Puzzle): Segments {
  const { rows, cols, cells } = p;
  const n = rows * cols;
  const hSeg = new Int32Array(n).fill(-1);
  const vSeg = new Int32Array(n).fill(-1);
  const members: number[][] = [];

  for (let r = 0; r < rows; r++) {
    let run: number[] = [];
    const flush = () => {
      if (run.length > 0) {
        const id = members.length;
        members.push(run);
        for (const i of run) hSeg[i] = id;
        run = [];
      }
    };
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (isWhite(cells[i])) run.push(i);
      else flush();
    }
    flush();
  }

  for (let c = 0; c < cols; c++) {
    let run: number[] = [];
    const flush = () => {
      if (run.length > 0) {
        const id = members.length;
        members.push(run);
        for (const i of run) vSeg[i] = id;
        run = [];
      }
    };
    for (let r = 0; r < rows; r++) {
      const i = r * cols + c;
      if (isWhite(cells[i])) run.push(i);
      else flush();
    }
    flush();
  }

  return { hSeg, vSeg, members, count: members.length };
}

/** Orthogonally adjacent white-cell indices around cell `i`. */
export function adjacentWhite(p: Puzzle, i: number): number[] {
  const { rows, cols, cells } = p;
  const r = Math.floor(i / cols);
  const c = i % cols;
  const out: number[] = [];
  if (r > 0 && isWhite(cells[i - cols])) out.push(i - cols);
  if (r < rows - 1 && isWhite(cells[i + cols])) out.push(i + cols);
  if (c > 0 && isWhite(cells[i - 1])) out.push(i - 1);
  if (c < cols - 1 && isWhite(cells[i + 1])) out.push(i + 1);
  return out;
}
