import { describe, it, expect } from "vitest";
import { type CellValue, type Mark, type Puzzle, WALL, WHITE } from "../src/lib/game/types";
import { computeSegments } from "../src/lib/game/grid";
import { adjacentBulbs, evaluate } from "../src/lib/game/validation";

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

describe("numbered-wall adjacency constraint (exactly N)", () => {
  it("counts only orthogonally adjacent bulbs", () => {
    // clue '2' at (0,1)=index 1; orthogonal neighbours: (0,0)=0, (0,2)=2, (1,1)=4
    const p = grid([".2.", "...", "..."]);
    expect(adjacentBulbs(p, marks(p, [0, 2]), 1)).toBe(2);
    expect(adjacentBulbs(p, marks(p, [0, 4]), 1)).toBe(2);
    expect(adjacentBulbs(p, marks(p, [0]), 1)).toBe(1);
    // a diagonal bulb (1,0)=3 does not count
    expect(adjacentBulbs(p, marks(p, [3]), 1)).toBe(0);
  });

  it("reports under / exact per clue", () => {
    const p = grid(["2..", "...", "..."]);
    const seg = computeSegments(p);
    // clue '2' at index 0, neighbours (0,1)=1 and (1,0)=3
    expect(evaluate(p, marks(p, [1]), seg).clueStatus.get(0)).toBe("under");
    expect(evaluate(p, marks(p, [1, 3]), seg).clueStatus.get(0)).toBe("exact");
  });

  it("a clue larger than its available neighbours can never be exact", () => {
    const p = grid(["3..", "...", "..."]);
    const seg = computeSegments(p);
    // only 2 neighbours exist, so even both bulbs leave it under
    expect(evaluate(p, marks(p, [1, 3]), seg).clueStatus.get(0)).toBe("under");
  });

  it("flags an over-filled clue", () => {
    const p = grid([".1.", "...", "..."]);
    const seg = computeSegments(p);
    // clue '1' at index 1, neighbours 0,2,4 — two bulbs is over
    expect(evaluate(p, marks(p, [0, 2]), seg).clueStatus.get(1)).toBe("over");
  });
});
