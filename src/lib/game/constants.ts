/**
 * Board size presets. Difficulty scales with three levers: the grid size, the
 * wall density, and `clueFraction` — the share of removable clue numbers that
 * are restored after minimisation. A higher fraction leaves more numbers on the
 * board and makes the puzzle easier; a lower fraction hides them and makes it
 * harder.
 */
export interface SizePreset {
  readonly id: string;
  readonly label: string;
  readonly rows: number;
  readonly cols: number;
  /** Fraction of cells that become walls. */
  readonly wallDensity: number;
  /** Fraction of removable clues restored after minimisation (higher = easier). */
  readonly clueFraction: number;
}

export const SIZES: readonly SizePreset[] = [
  { id: "7", label: "7 × 7", rows: 7, cols: 7, wallDensity: 0.2, clueFraction: 0.55 },
  { id: "10", label: "10 × 10", rows: 10, cols: 10, wallDensity: 0.22, clueFraction: 0.4 },
  { id: "14", label: "14 × 14", rows: 14, cols: 14, wallDensity: 0.24, clueFraction: 0.28 },
];

export const DEFAULT_SIZE_ID = "7";

export function sizeById(id: string): SizePreset {
  return SIZES.find((s) => s.id === id) ?? SIZES[0];
}
