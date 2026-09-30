import { describe, it, expect } from "vitest";
import { generate } from "../src/lib/game/generator";
import { countSolutions, solveOne } from "../src/lib/game/solver";
import { computeSegments } from "../src/lib/game/grid";
import { evaluate } from "../src/lib/game/validation";
import { clueOf, isWall, isWhite } from "../src/lib/game/types";

const CONFIGS = [
  { rows: 7, cols: 7, wallDensity: 0.2, clueFraction: 0.55 },
  { rows: 10, cols: 10, wallDensity: 0.22, clueFraction: 0.4 },
  { rows: 14, cols: 14, wallDensity: 0.24, clueFraction: 0.28 },
];

describe("generator", () => {
  for (const cfg of CONFIGS) {
    it(`${cfg.rows}x${cfg.cols} produces unique-solution boards`, () => {
      for (let seed = 1; seed <= 6; seed++) {
        const g = generate({ ...cfg, seed });
        // the solver counts exactly one solution
        expect(countSolutions(g.puzzle, 2)).toBe(1);
        // the reported solution is that solution and it is valid
        const seg = computeSegments(g.puzzle);
        expect(evaluate(g.puzzle, g.solution, seg).solved).toBe(true);
        expect(solveOne(g.puzzle)).toEqual(g.solution);
      }
    });
  }

  it("is deterministic for a given seed", () => {
    const a = generate({ rows: 10, cols: 10, wallDensity: 0.22, clueFraction: 0.4, seed: 99 });
    const b = generate({ rows: 10, cols: 10, wallDensity: 0.22, clueFraction: 0.4, seed: 99 });
    expect(b.puzzle.cells).toEqual(a.puzzle.cells);
    expect(b.solution).toEqual(a.solution);
  });

  it("harder settings expose fewer clue numbers than easier ones", () => {
    const numbered = (frac: number) => {
      let easy = 0;
      let seeds = 0;
      for (let seed = 1; seed <= 6; seed++) {
        const g = generate({ rows: 10, cols: 10, wallDensity: 0.22, clueFraction: frac, seed });
        easy += g.puzzle.cells.filter((v) => clueOf(v) !== null).length;
        seeds++;
      }
      return easy / seeds;
    };
    expect(numbered(0.6)).toBeGreaterThan(numbered(0.1));
  });

  it("every clue matches the solution's adjacent-bulb count", () => {
    const g = generate({ rows: 10, cols: 10, wallDensity: 0.22, clueFraction: 0.4, seed: 7 });
    const { rows, cols, cells } = g.puzzle;
    for (let i = 0; i < cells.length; i++) {
      const k = clueOf(cells[i]);
      if (k === null) continue;
      const r = Math.floor(i / cols);
      const c = i % cols;
      let adj = 0;
      if (r > 0 && g.solution[i - cols] === "bulb") adj++;
      if (r < rows - 1 && g.solution[i + cols] === "bulb") adj++;
      if (c > 0 && g.solution[i - 1] === "bulb") adj++;
      if (c < cols - 1 && g.solution[i + 1] === "bulb") adj++;
      expect(adj).toBe(k);
    }
    // bulbs only ever sit on white cells
    for (let i = 0; i < cells.length; i++) {
      if (g.solution[i] === "bulb") expect(isWhite(cells[i])).toBe(true);
      if (isWall(cells[i])) expect(g.solution[i]).not.toBe("bulb");
    }
  });
});
