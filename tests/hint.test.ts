import { describe, it, expect } from "vitest";
import { type CellValue, type Mark, type Puzzle, WALL, WHITE, emptyMarks } from "../src/lib/game/types";
import { generate } from "../src/lib/game/generator";
import { getHint } from "../src/lib/game/hint";
import { solveOne } from "../src/lib/game/solver";

function grid(rows: string[]): Puzzle {
  const cells: CellValue[] = [];
  for (const line of rows) {
    for (const ch of line) cells.push(ch === "." ? WHITE : ch === "#" ? WALL : (Number(ch) as CellValue));
  }
  return { rows: rows.length, cols: rows[0].length, cells };
}

describe("hint", () => {
  it("returns a forced bulb on a board that demands one", () => {
    // The '0' pins bulbs off 1 and 2; the only lit-everything placement is a
    // bulb at (1,1)=3, which propagation forces directly.
    const p = grid(["0.", ".."]);
    const h = getHint(p, emptyMarks(p))!;
    expect(h).toBeTruthy();
    expect(h.action).toBe("bulb");
    expect(h.cell).toBe(3);
  });

  it("suggests a cross where a bulb is forbidden by a 0 clue", () => {
    // The '0' at (0,0) forbids bulbs on its neighbours (0,1)=1 and (1,0)=3.
    // No bulb is forced yet on this roomy board, so the deduction on offer is a
    // cross over one of those forbidden cells.
    const p = grid(["0..", "...", "..."]);
    const h = getHint(p, emptyMarks(p))!;
    expect(h.action).toBe("cross");
    expect([1, 3]).toContain(h.cell);
  });

  it("every hint on a generated board agrees with its unique solution", () => {
    for (let seed = 1; seed <= 6; seed++) {
      const g = generate({ rows: 10, cols: 10, wallDensity: 0.22, clueFraction: 0.4, seed });
      const marks: Mark[] = emptyMarks(g.puzzle);
      const h = getHint(g.puzzle, marks)!;
      expect(h).toBeTruthy();
      if (h.action === "bulb") expect(g.solution[h.cell]).toBe("bulb");
      else expect(g.solution[h.cell]).not.toBe("bulb");
    }
  });

  it("returns null once the board is fully and correctly solved", () => {
    const g = generate({ rows: 7, cols: 7, wallDensity: 0.2, clueFraction: 0.55, seed: 3 });
    const solution = solveOne(g.puzzle)!;
    expect(getHint(g.puzzle, solution)).toBeNull();
  });
});
