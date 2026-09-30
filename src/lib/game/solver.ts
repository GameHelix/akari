import { type Mark, type Puzzle, clueOf, isWhite } from "./types";
import { computeSegments } from "./grid";

/**
 * The solver: constraint propagation to a fixpoint, then single-variable
 * backtracking. It powers generation, the uniqueness guarantee, and hints.
 *
 * Cells are tracked as one of: UNKNOWN, BULB (definitely a bulb), EMPTY
 * (definitely not a bulb). Propagation applies three deductions until nothing
 * changes:
 *   1. a run that already holds a bulb forces its other cells EMPTY;
 *   2. a numbered wall forces its neighbours once the count is pinned;
 *   3. an unlit cell whose run(s) offer a single possible bulb forces it.
 * Backtracking then branches one UNKNOWN cell BULB vs EMPTY — a clean partition,
 * so solution counts are exact (never double-counted).
 */
const UNKNOWN = 0;
const BULB = 1;
const EMPTY = 2;
const WALLM = 3;

interface Clue {
  readonly wall: number;
  readonly k: number;
  readonly nb: readonly number[];
}

interface Model {
  readonly n: number;
  readonly rows: number;
  readonly cols: number;
  readonly hSeg: Int32Array;
  readonly vSeg: Int32Array;
  readonly members: readonly number[][];
  readonly whites: readonly number[];
  readonly base: Uint8Array;
  readonly clues: readonly Clue[];
}

function compile(p: Puzzle): Model {
  const seg = computeSegments(p);
  const n = p.rows * p.cols;
  const base = new Uint8Array(n);
  const whites: number[] = [];
  for (let i = 0; i < n; i++) {
    if (isWhite(p.cells[i])) {
      base[i] = UNKNOWN;
      whites.push(i);
    } else {
      base[i] = WALLM;
    }
  }
  const clues: Clue[] = [];
  for (let i = 0; i < n; i++) {
    const k = clueOf(p.cells[i]);
    if (k === null) continue;
    const r = Math.floor(i / p.cols);
    const c = i % p.cols;
    const nb: number[] = [];
    if (r > 0 && isWhite(p.cells[i - p.cols])) nb.push(i - p.cols);
    if (r < p.rows - 1 && isWhite(p.cells[i + p.cols])) nb.push(i + p.cols);
    if (c > 0 && isWhite(p.cells[i - 1])) nb.push(i - 1);
    if (c < p.cols - 1 && isWhite(p.cells[i + 1])) nb.push(i + 1);
    clues.push({ wall: i, k, nb });
  }
  return {
    n,
    rows: p.rows,
    cols: p.cols,
    hSeg: seg.hSeg,
    vSeg: seg.vSeg,
    members: seg.members,
    whites,
    base,
    clues,
  };
}

interface State {
  mark: Uint8Array;
  segBulbs: Int32Array;
  segUnknown: Int32Array;
  unknownCount: number;
}

function initState(m: Model): State {
  const mark = m.base.slice();
  const segBulbs = new Int32Array(m.members.length);
  const segUnknown = new Int32Array(m.members.length);
  let unknownCount = 0;
  for (const i of m.whites) {
    segUnknown[m.hSeg[i]]++;
    segUnknown[m.vSeg[i]]++;
    unknownCount++;
  }
  return { mark, segBulbs, segUnknown, unknownCount };
}

function cloneState(s: State): State {
  return {
    mark: s.mark.slice(),
    segBulbs: s.segBulbs.slice(),
    segUnknown: s.segUnknown.slice(),
    unknownCount: s.unknownCount,
  };
}

function setBulb(m: Model, s: State, i: number): boolean {
  if (s.mark[i] === BULB) return true;
  if (s.mark[i] === EMPTY) return false;
  s.mark[i] = BULB;
  s.unknownCount--;
  const h = m.hSeg[i];
  const v = m.vSeg[i];
  s.segUnknown[h]--;
  s.segUnknown[v]--;
  s.segBulbs[h]++;
  s.segBulbs[v]++;
  return s.segBulbs[h] <= 1 && s.segBulbs[v] <= 1;
}

function setEmpty(m: Model, s: State, i: number): boolean {
  if (s.mark[i] === EMPTY) return true;
  if (s.mark[i] === BULB) return false;
  s.mark[i] = EMPTY;
  s.unknownCount--;
  s.segUnknown[m.hSeg[i]]--;
  s.segUnknown[m.vSeg[i]]--;
  return true;
}

function propagate(m: Model, s: State): boolean {
  let changed = true;
  while (changed) {
    changed = false;

    for (let sg = 0; sg < m.members.length; sg++) {
      if (s.segBulbs[sg] > 1) return false;
      if (s.segBulbs[sg] === 1 && s.segUnknown[sg] > 0) {
        for (const i of m.members[sg]) {
          if (s.mark[i] === UNKNOWN) {
            if (!setEmpty(m, s, i)) return false;
            changed = true;
          }
        }
      }
    }

    for (const cl of m.clues) {
      let b = 0;
      let u = 0;
      for (const j of cl.nb) {
        const mk = s.mark[j];
        if (mk === BULB) b++;
        else if (mk === UNKNOWN) u++;
      }
      if (b > cl.k) return false;
      if (b + u < cl.k) return false;
      if (u > 0 && b === cl.k) {
        for (const j of cl.nb) {
          if (s.mark[j] === UNKNOWN) {
            if (!setEmpty(m, s, j)) return false;
            changed = true;
          }
        }
      } else if (u > 0 && b + u === cl.k) {
        for (const j of cl.nb) {
          if (s.mark[j] === UNKNOWN) {
            if (!setBulb(m, s, j)) return false;
            changed = true;
          }
        }
      }
    }

    for (const i of m.whites) {
      const h = m.hSeg[i];
      const v = m.vSeg[i];
      if (s.segBulbs[h] > 0 || s.segBulbs[v] > 0) continue; // already lit
      let cand = s.segUnknown[h] + s.segUnknown[v];
      if (s.mark[i] === UNKNOWN) cand -= 1; // `i` is in both runs
      if (cand === 0) return false;
      if (cand === 1) {
        let target = -1;
        for (const j of m.members[h]) {
          if (s.mark[j] === UNKNOWN) {
            target = j;
            break;
          }
        }
        if (target === -1) {
          for (const j of m.members[v]) {
            if (s.mark[j] === UNKNOWN) {
              target = j;
              break;
            }
          }
        }
        if (target !== -1) {
          if (!setBulb(m, s, target)) return false;
          changed = true;
        }
      }
    }
  }
  return true;
}

/** Pick an UNKNOWN cell to branch on: a candidate of the least-lit cell. */
function pickBranch(m: Model, s: State): number {
  let best = -1;
  let bestCand = Infinity;
  for (const i of m.whites) {
    const h = m.hSeg[i];
    const v = m.vSeg[i];
    if (s.segBulbs[h] > 0 || s.segBulbs[v] > 0) continue;
    let cand = s.segUnknown[h] + s.segUnknown[v];
    if (s.mark[i] === UNKNOWN) cand -= 1;
    if (cand < bestCand) {
      bestCand = cand;
      best = i;
      if (cand <= 2) break;
    }
  }
  if (best !== -1) {
    const h = m.hSeg[best];
    const v = m.vSeg[best];
    for (const j of m.members[h]) if (s.mark[j] === UNKNOWN) return j;
    for (const j of m.members[v]) if (s.mark[j] === UNKNOWN) return j;
  }
  for (const i of m.whites) if (s.mark[i] === UNKNOWN) return i;
  return -1;
}

function search(m: Model, s: State, cap: number, counter: { n: number }): void {
  if (counter.n >= cap) return;
  if (!propagate(m, s)) return;
  if (s.unknownCount === 0) {
    counter.n++;
    return;
  }
  const c = pickBranch(m, s);
  if (c === -1) {
    counter.n++;
    return;
  }
  const s1 = cloneState(s);
  if (setBulb(m, s1, c)) search(m, s1, cap, counter);
  if (counter.n >= cap) return;
  const s2 = cloneState(s);
  if (setEmpty(m, s2, c)) search(m, s2, cap, counter);
}

/** Number of solutions, counted up to `cap` (default 2 — enough for uniqueness). */
export function countSolutions(p: Puzzle, cap = 2): number {
  const m = compile(p);
  const s = initState(m);
  const counter = { n: 0 };
  search(m, s, cap, counter);
  return counter.n;
}

function searchFirst(m: Model, s: State): Uint8Array | null {
  if (!propagate(m, s)) return null;
  if (s.unknownCount === 0) return s.mark;
  const c = pickBranch(m, s);
  if (c === -1) return s.mark;
  const s1 = cloneState(s);
  if (setBulb(m, s1, c)) {
    const r = searchFirst(m, s1);
    if (r) return r;
  }
  const s2 = cloneState(s);
  if (setEmpty(m, s2, c)) {
    const r = searchFirst(m, s2);
    if (r) return r;
  }
  return null;
}

function maskToMarks(m: Model, mask: Uint8Array): Mark[] {
  const out = new Array<Mark>(m.n).fill("empty");
  for (let i = 0; i < m.n; i++) out[i] = mask[i] === BULB ? "bulb" : "empty";
  return out;
}

/** One solution's bulb placement, or `null` when the puzzle is unsolvable. */
export function solveOne(p: Puzzle): Mark[] | null {
  const m = compile(p);
  const res = searchFirst(m, initState(m));
  return res ? maskToMarks(m, res) : null;
}

export interface Forced {
  readonly bulbs: number[];
  readonly empties: number[];
}

/**
 * Cells that pure propagation (no guessing) pins from the empty board. Each is
 * an individually deducible step, which is exactly what a hint should offer.
 */
export function forcedFromLogic(p: Puzzle): Forced {
  const m = compile(p);
  const s = initState(m);
  const bulbs: number[] = [];
  const empties: number[] = [];
  if (!propagate(m, s)) return { bulbs, empties };
  for (const i of m.whites) {
    if (s.mark[i] === BULB) bulbs.push(i);
    else if (s.mark[i] === EMPTY) empties.push(i);
  }
  return { bulbs, empties };
}
