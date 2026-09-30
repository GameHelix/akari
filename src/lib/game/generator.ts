import { type CellValue, type Mark, type Puzzle, WALL, WHITE, isWhite } from "./types";
import { makeRng, type Rng } from "./rng";
import { computeSegments, type Segments } from "./grid";
import { countSolutions } from "./solver";

export interface GeneratedPuzzle {
  readonly puzzle: Puzzle;
  /** The unique solution's bulb placement, for hints and verification. */
  readonly solution: Mark[];
  readonly seed: number;
}

export interface GenerateOptions {
  readonly rows: number;
  readonly cols: number;
  readonly wallDensity: number;
  readonly clueFraction: number;
  readonly seed: number;
}

function range(n: number): number[] {
  const out = new Array<number>(n);
  for (let i = 0; i < n; i++) out[i] = i;
  return out;
}

/** Cells a bulb at `i` would newly light, given the current lit map. */
function newlyLit(i: number, seg: Segments, lit: Uint8Array): number {
  let gain = 0;
  for (const j of seg.members[seg.hSeg[i]]) if (!lit[j]) gain++;
  for (const j of seg.members[seg.vSeg[i]]) if (!lit[j]) gain++;
  if (!lit[i]) gain -= 1; // counted once per run
  return gain;
}

/**
 * A valid lighting of every white cell with no two bulbs in the same run.
 *
 * Any unlit cell can always take a bulb on itself without conflict (its runs
 * hold no bulb yet, else it would be lit), so this greedy loop always finishes.
 * Preferring the placement that lights the most fresh cells keeps bulb counts
 * modest and boards interesting.
 */
function lightAll(p: Puzzle, seg: Segments, rng: Rng): Uint8Array {
  const n = p.rows * p.cols;
  const bulb = new Uint8Array(n);
  const lit = new Uint8Array(n);
  const segBulbs = new Int32Array(seg.count);
  const whites: number[] = [];
  for (let i = 0; i < n; i++) if (isWhite(p.cells[i])) whites.push(i);

  const isLit = (i: number) => segBulbs[seg.hSeg[i]] > 0 || segBulbs[seg.vSeg[i]] > 0;

  for (;;) {
    let anyUnlit = false;
    for (const i of whites) {
      if (!isLit(i)) {
        anyUnlit = true;
        break;
      }
    }
    if (!anyUnlit) break;

    let best = -1;
    let bestGain = -1;
    for (const i of rng.shuffle(whites)) {
      if (segBulbs[seg.hSeg[i]] !== 0 || segBulbs[seg.vSeg[i]] !== 0) continue; // would conflict
      const gain = newlyLit(i, seg, lit);
      if (gain > bestGain) {
        bestGain = gain;
        best = i;
      }
    }
    if (best === -1) break; // unreachable: an unlit cell is always conflict-free

    bulb[best] = 1;
    segBulbs[seg.hSeg[best]]++;
    segBulbs[seg.vSeg[best]]++;
    for (const j of seg.members[seg.hSeg[best]]) lit[j] = 1;
    for (const j of seg.members[seg.vSeg[best]]) lit[j] = 1;
  }
  return bulb;
}

function countAdjBulbs(rows: number, cols: number, i: number, bulb: Uint8Array): number {
  const r = Math.floor(i / cols);
  const c = i % cols;
  let n = 0;
  if (r > 0 && bulb[i - cols]) n++;
  if (r < rows - 1 && bulb[i + cols]) n++;
  if (c > 0 && bulb[i - 1]) n++;
  if (c < cols - 1 && bulb[i + 1]) n++;
  return n;
}

function marksFromMask(n: number, bulb: Uint8Array): Mark[] {
  const out = new Array<Mark>(n).fill("empty");
  for (let i = 0; i < n; i++) if (bulb[i]) out[i] = "bulb";
  return out;
}

/**
 * Generate a unique-solution Akari board.
 *
 * Sketch a wall layout, build a real lighting, number every wall with its
 * adjacent-bulb count, and keep only layouts whose fully-numbered board already
 * has a single solution. Then greedily strip clue numbers as long as the board
 * stays unique, and finally restore a `clueFraction` share of the removed ones
 * to hit the target difficulty (more numbers shown = easier).
 */
export function generate(opts: GenerateOptions): GeneratedPuzzle {
  const { rows, cols } = opts;
  const n = rows * cols;
  const maxAttempts = 120;
  let lastFull: CellValue[] | null = null;
  let lastMask: Uint8Array | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const seed = (opts.seed >>> 0) ^ Math.imul(attempt + 1, 0x9e3779b1);
    const rng = makeRng(seed);

    const density = Math.min(0.34, opts.wallDensity + (attempt > 40 ? (attempt - 40) * 0.004 : 0));
    const cells: CellValue[] = new Array<CellValue>(n).fill(WHITE);
    const order = rng.shuffle(range(n));
    const wallCount = Math.round(n * density);
    for (let k = 0; k < wallCount; k++) cells[order[k]] = WALL;
    if (!cells.some(isWhite)) continue;

    const layout: Puzzle = { rows, cols, cells };
    const seg = computeSegments(layout);
    const mask = lightAll(layout, seg, rng);

    const full = cells.slice();
    for (let i = 0; i < n; i++) {
      if (!isWhite(cells[i])) full[i] = countAdjBulbs(rows, cols, i, mask);
    }
    lastFull = full;
    lastMask = mask;

    if (countSolutions({ rows, cols, cells: full }, 2) !== 1) continue;

    // Strip clue numbers while the board stays uniquely solvable.
    const work = full.slice();
    const walls = rng.shuffle(range(n).filter((i) => !isWhite(cells[i])));
    const removed: number[] = [];
    for (const w of walls) {
      if (work[w] === WALL) continue;
      const saved = work[w];
      work[w] = WALL;
      if (countSolutions({ rows, cols, cells: work }, 2) === 1) removed.push(w);
      else work[w] = saved;
    }

    // Restore some numbers to ease the puzzle toward the target difficulty.
    const restore = Math.round(removed.length * opts.clueFraction);
    for (let k = 0; k < restore; k++) {
      const w = removed[k];
      work[w] = countAdjBulbs(rows, cols, w, mask);
    }

    const puzzle: Puzzle = { rows, cols, cells: work };
    if (countSolutions(puzzle, 2) !== 1) continue;
    return { puzzle, solution: marksFromMask(n, mask), seed };
  }

  // Extremely unlikely fallback: the last fully-numbered board we built.
  if (lastFull && lastMask) {
    return {
      puzzle: { rows, cols, cells: lastFull },
      solution: marksFromMask(n, lastMask),
      seed: opts.seed >>> 0,
    };
  }
  const cells: CellValue[] = new Array<CellValue>(n).fill(WHITE);
  return { puzzle: { rows, cols, cells }, solution: new Array<Mark>(n).fill("empty"), seed: opts.seed >>> 0 };
}
