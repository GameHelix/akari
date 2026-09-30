"use client";

import { type CSSProperties, type KeyboardEvent, memo, useMemo } from "react";
import { type Mark, type Puzzle } from "@/lib/game";
import { type Segments } from "@/lib/game/grid";
import { type Evaluation } from "@/lib/game/validation";
import { Cell } from "./Cell";

interface Beam {
  key: string;
  style: CSSProperties;
  kind: "h" | "v";
}

export interface BoardProps {
  puzzle: Puzzle;
  segments: Segments;
  marks: Mark[];
  evaluation: Evaluation;
  cursor: number;
  hintCell: number | null;
  focused: boolean;
  onSelect: (index: number) => void;
  onCross: (index: number) => void;
  onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => void;
  onFocusChange: (focused: boolean) => void;
}

/** Light beams: one bar per run (horizontal + vertical) that holds a bulb. */
function useBeams(puzzle: Puzzle, segments: Segments, marks: Mark[]): Beam[] {
  const cols = puzzle.cols;
  return useMemo(() => {
    const seenH = new Set<number>();
    const seenV = new Set<number>();
    const out: Beam[] = [];
    for (let i = 0; i < marks.length; i++) {
      if (marks[i] !== "bulb") continue;

      const hs = segments.hSeg[i];
      if (hs >= 0 && !seenH.has(hs)) {
        seenH.add(hs);
        const mem = segments.members[hs];
        if (mem.length > 1) {
          const r = Math.floor(mem[0] / cols);
          let c1 = Infinity;
          let c2 = -Infinity;
          for (const m of mem) {
            const c = m % cols;
            if (c < c1) c1 = c;
            if (c > c2) c2 = c;
          }
          out.push({ key: `h${hs}`, kind: "h", style: { gridRow: r + 1, gridColumn: `${c1 + 1} / ${c2 + 2}` } });
        }
      }

      const vs = segments.vSeg[i];
      if (vs >= 0 && !seenV.has(vs)) {
        seenV.add(vs);
        const mem = segments.members[vs];
        if (mem.length > 1) {
          const c = mem[0] % cols;
          let r1 = Infinity;
          let r2 = -Infinity;
          for (const m of mem) {
            const r = Math.floor(m / cols);
            if (r < r1) r1 = r;
            if (r > r2) r2 = r;
          }
          out.push({ key: `v${vs}`, kind: "v", style: { gridColumn: c + 1, gridRow: `${r1 + 1} / ${r2 + 2}` } });
        }
      }
    }
    return out;
  }, [cols, segments, marks]);
}

function BoardInner(props: BoardProps) {
  const { puzzle, segments, marks, evaluation, cursor, hintCell, focused } = props;
  const beams = useBeams(puzzle, segments, marks);

  const shellStyle = {
    "--cols": puzzle.cols,
    "--rows": puzzle.rows,
  } as CSSProperties;

  return (
    <div
      className="akari-shell"
      style={shellStyle}
      tabIndex={0}
      role="grid"
      aria-label={`Akari board, ${puzzle.rows} by ${puzzle.cols}`}
      onKeyDown={props.onKeyDown}
      onFocus={() => props.onFocusChange(true)}
      onBlur={() => props.onFocusChange(false)}
    >
      <div className="akari-beams" aria-hidden>
        {beams.map((b) => (
          <div key={b.key} className={b.kind === "h" ? "akari-beam-h" : "akari-beam-v"} style={b.style} />
        ))}
      </div>

      <div className="akari-grid">
        {puzzle.cells.map((value, i) => (
          <Cell
            key={i}
            index={i}
            value={value}
            mark={marks[i]}
            lit={evaluation.lit[i]}
            conflict={evaluation.bulbConflicts[i]}
            clueStatus={evaluation.clueStatus.get(i) ?? null}
            isCursor={i === cursor}
            showCursor={focused}
            isHint={i === hintCell}
            onSelect={props.onSelect}
            onCross={props.onCross}
          />
        ))}
      </div>
    </div>
  );
}

export const Board = memo(BoardInner);
