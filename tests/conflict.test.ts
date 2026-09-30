import { describe, it, expect } from "vitest";
import { type CellValue, type Mark, type Puzzle, WALL, WHITE } from "../src/lib/game/types";
import { computeSegments } from "../src/lib/game/grid";
import { illuminate } from "../src/lib/game/illumination";

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

describe("mutual-illumination conflict detection", () => {
  it("two bulbs in the same open row see each other", () => {
    const p = grid([".....", ".....", ".....", ".....", "....."]);
    const seg = computeSegments(p);
    // (0,0)=0 and (0,3)=3 share row 0 with nothing between them
    const ill = illuminate(p, marks(p, [0, 3]), seg);
    expect(ill.bulbConflicts[0]).toBe(true);
    expect(ill.bulbConflicts[3]).toBe(true);
  });

  it("a wall between two bulbs removes the conflict", () => {
    // row 0: . . # . .  -> bulbs at (0,0) and (0,4) are in different runs
    const p = grid(["..#..", ".....", ".....", ".....", "....."]);
    const seg = computeSegments(p);
    const ill = illuminate(p, marks(p, [0, 4]), seg);
    expect(ill.bulbConflicts[0]).toBe(false);
    expect(ill.bulbConflicts[4]).toBe(false);
  });

  it("bulbs sharing a column conflict; a wall in the column clears it", () => {
    const open = grid([".", ".", ".", ".", "."]); // 5x1 column
    const segOpen = computeSegments(open);
    const illOpen = illuminate(open, marks(open, [0, 4]), segOpen);
    expect(illOpen.bulbConflicts[0]).toBe(true);
    expect(illOpen.bulbConflicts[4]).toBe(true);

    const split = grid([".", ".", "#", ".", "."]); // wall at row 2
    const segSplit = computeSegments(split);
    const illSplit = illuminate(split, marks(split, [0, 4]), segSplit);
    expect(illSplit.bulbConflicts[0]).toBe(false);
    expect(illSplit.bulbConflicts[4]).toBe(false);
  });
});
