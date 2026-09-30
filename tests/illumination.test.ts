import { describe, it, expect } from "vitest";
import { type CellValue, type Mark, type Puzzle, WALL, WHITE } from "../src/lib/game/types";
import { computeSegments } from "../src/lib/game/grid";
import { illuminate } from "../src/lib/game/illumination";

/** Build a puzzle from a compact string grid: '.' white, '#' wall, digits clues. */
function grid(rows: string[]): Puzzle {
  const r = rows.length;
  const c = rows[0].length;
  const cells: CellValue[] = [];
  for (const line of rows) {
    for (const ch of line) {
      if (ch === ".") cells.push(WHITE);
      else if (ch === "#") cells.push(WALL);
      else cells.push(Number(ch) as CellValue);
    }
  }
  return { rows: r, cols: c, cells };
}

function marks(p: Puzzle, bulbs: number[]): Mark[] {
  const m = new Array<Mark>(p.rows * p.cols).fill("empty");
  for (const i of bulbs) m[i] = "bulb";
  return m;
}

describe("illumination line-of-sight", () => {
  it("lights along the whole row and column of a bulb", () => {
    const p = grid([".....", ".....", ".....", ".....", "....."]);
    const seg = computeSegments(p);
    // bulb at centre (2,2) => index 12
    const ill = illuminate(p, marks(p, [12]), seg);
    // entire row 2 and column 2 lit
    for (let c = 0; c < 5; c++) expect(ill.lit[2 * 5 + c]).toBe(true);
    for (let r = 0; r < 5; r++) expect(ill.lit[r * 5 + 2]).toBe(true);
    // a cell off the row/column is dark
    expect(ill.lit[0]).toBe(false); // (0,0)
    expect(ill.lit[24]).toBe(false); // (4,4)
  });

  it("a wall blocks the beam — it does not shine through", () => {
    // row: . . # . .  (wall at col 2)
    const p = grid([".....", "..#..", ".....", ".....", "....."]);
    const seg = computeSegments(p);
    // bulb at (1,0) index 5 lights (1,0),(1,1) but NOT (1,3),(1,4) past the wall
    const ill = illuminate(p, marks(p, [5]), seg);
    expect(ill.lit[5]).toBe(true); // (1,0)
    expect(ill.lit[6]).toBe(true); // (1,1)
    expect(ill.lit[8]).toBe(false); // (1,3) beyond the wall
    expect(ill.lit[9]).toBe(false); // (1,4) beyond the wall
  });

  it("reports the exact set of unlit white cells", () => {
    const p = grid(["...", "...", "..."]);
    const seg = computeSegments(p);
    // bulb at (0,0): lights row 0 and column 0
    const ill = illuminate(p, marks(p, [0]), seg);
    // unlit: (1,1)=4,(1,2)=5,(2,1)=7,(2,2)=8
    expect(new Set(ill.unlit)).toEqual(new Set([4, 5, 7, 8]));
    expect(ill.litCount).toBe(5);
  });
});
