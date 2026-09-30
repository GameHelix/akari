import { describe, it, expect } from "vitest";
import { type CellValue, type Mark, type Puzzle, WALL, WHITE } from "../src/lib/game/types";
import { computeSegments } from "../src/lib/game/grid";
import { evaluate } from "../src/lib/game/validation";

function grid(rows: string[]): Puzzle {
  const cells: CellValue[] = [];
  for (const line of rows) {
    for (const ch of line) cells.push(ch === "." ? WHITE : ch === "#" ? WALL : (Number(ch) as CellValue));
  }
  return { rows: rows.length, cols: rows[0].length, cells };
}

function marks(p: Puzzle, bulbs: number[]): Mark[] {
  const m = new Array<Mark>(p.rows * p.cols).fill("empty");
  for (const i of bulbs) m[i] = "bulb";
  return m;
}

describe("full-solution detection", () => {
  it("accepts a board that is fully lit, conflict-free and clue-exact", () => {
    // 3x3 with a central clue.
    //  . 1 .
    //  . # .   -> the '1' at (0,1); wall at (1,1)
    //  . . .
    const p = grid([".1.", ".#.", "..."]);
    const seg = computeSegments(p);
    // Solution: bulbs at (0,0)=0 and (2,2)=8.
    // Lighting: 0 lights row0 {0,1?no 1 is wall}. Row 0 run is just {0} (col1 is wall).
    // Rework: choose bulbs that light every white cell.
    // White cells: 0,2,3,5,6,7,8 (index1 and 4 are walls).
    // Column runs: col0 {0,3,6}, col1 {} (all wall at 1,4? no (2,1)=7 white) -> col1 {7}, col2 {2,5,8}
    // Row runs: row0 {0} & {2}, row1 {3} & {5}, row2 {6,7,8}
    // Place bulb at 0 (lights col0:0,3,6 and row0:0), bulb at 2 (lights col2:2,5,8 and row0:2),
    // bulb at 7 (lights row2:6,7,8 and col1:7). Now check clue '1' at index1 neighbours: 0(up? no),
    // neighbours of (0,1): (0,0)=0 bulb, (0,2)=2 bulb, (1,1)=4 wall -> 2 adjacent bulbs => over.
    // Instead place bulbs at 0, 5, 7:
    //  0 lights col0{0,3,6}, row0{0}
    //  5 lights col2{2,5,8}, row1{5}
    //  7 lights row2{6,7,8}, col1{7}
    // white lit check: 0 y,2(by5)y,3(by0)y,5 y,6(by0/7)y,7 y,8(by5/7)y -> all lit
    // clue '1' neighbours (0,0)=0 bulb,(0,2)=2 empty,(1,1) wall => exactly 1 => exact
    const good = evaluate(p, marks(p, [0, 5, 7]), seg);
    expect(good.unlitCount).toBe(0);
    expect(good.conflictCount).toBe(0);
    expect(good.clueStatus.get(1)).toBe("exact");
    expect(good.solved).toBe(true);
  });

  it("rejects when a cell is left unlit", () => {
    const p = grid([".1.", ".#.", "..."]);
    const seg = computeSegments(p);
    const partial = evaluate(p, marks(p, [0]), seg);
    expect(partial.solved).toBe(false);
    expect(partial.unlitCount).toBeGreaterThan(0);
  });

  it("rejects when two bulbs conflict even if all lit", () => {
    const p = grid(["...", "...", "..."]);
    const seg = computeSegments(p);
    // bulbs (0,0)=0 and (0,2)=2 share row 0 -> conflict, though much is lit
    const bad = evaluate(p, marks(p, [0, 2, 8]), seg);
    expect(bad.conflictCount).toBeGreaterThan(0);
    expect(bad.solved).toBe(false);
  });

  it("rejects when a numbered wall is not exactly satisfied", () => {
    const p = grid(["1..", "...", "..."]);
    const seg = computeSegments(p);
    // clue '1' at index 0, neighbours (0,1)=1 and (1,0)=3.
    // Fully light with bulbs at 1,3 -> clue sees 2 => over => not solved.
    const bad = evaluate(p, marks(p, [1, 3, 8]), seg);
    expect(bad.clueStatus.get(0)).toBe("over");
    expect(bad.solved).toBe(false);
  });
});
