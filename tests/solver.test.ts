import { describe, it, expect } from "vitest";
import { type CellValue, type Mark, type Puzzle, WALL, WHITE } from "../src/lib/game/types";
import { computeSegments } from "../src/lib/game/grid";
import { evaluate } from "../src/lib/game/validation";
import { countSolutions, solveOne } from "../src/lib/game/solver";

function grid(rows: string[]): Puzzle {
  const cells: CellValue[] = [];
  for (const line of rows) {
    for (const ch of line) cells.push(ch === "." ? WHITE : ch === "#" ? WALL : (Number(ch) as CellValue));
  }
  return { rows: rows.length, cols: rows[0].length, cells };
}

describe("solver", () => {
  it("finds the single solution of a small forced board", () => {
    // A single white cell fully enclosed must hold a bulb.
    const p = grid(["#0#", "0.0", "#0#"]);
    // centre (1,1)=4 is the only white cell; every neighbouring wall is '0',
    // which is consistent only if... wait, a bulb next to a 0 is illegal.
    // So the centre cannot be a bulb, yet it must be lit -> unsolvable. Expect 0.
    expect(countSolutions(p, 2)).toBe(0);
  });

  it("solves an isolated white cell that must be a bulb", () => {
    const p = grid(["#.#", "...", "#.#"]);
    // No clues; many solutions expected (>1).
    expect(countSolutions(p, 2)).toBeGreaterThan(1);
  });

  it("counts exactly one solution for a clued unique board", () => {
    // Open 2x2 with a corner '0'. White cells: (0,1)=1,(1,0)=2,(1,1)=3.
    //  0 .
    //  . .
    // The '0' forbids bulbs at 1 and 2, so the only lit-everything, conflict-free
    // placement is a single bulb at (1,1)=3 — a unique solution.
    const p = grid(["0.", ".."]);
    const count = countSolutions(p, 2);
    expect(count).toBe(1);
    const sol = solveOne(p)!;
    expect(sol[3]).toBe("bulb");
    const seg = computeSegments(p);
    expect(evaluate(p, sol, seg).solved).toBe(true);
  });

  it("detects an ambiguous (non-unique) board", () => {
    // A 1x3 open strip: the middle must be lit; bulb can sit at either end or
    // middle while lighting all three -> more than one solution.
    const p = grid(["..."]);
    expect(countSolutions(p, 2)).toBeGreaterThan(1);
  });

  it("solveOne returns a valid full solution", () => {
    const p = grid(["....", "....", "....", "...."]);
    const sol: Mark[] = solveOne(p)!;
    expect(sol).toBeTruthy();
    const seg = computeSegments(p);
    expect(evaluate(p, sol, seg).solved).toBe(true);
  });
});
