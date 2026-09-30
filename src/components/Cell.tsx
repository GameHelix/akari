"use client";

import { memo } from "react";
import { type CellValue, type Mark, clueOf, isWhite } from "@/lib/game";
import { type ClueStatus } from "@/lib/game/validation";

export interface CellProps {
  index: number;
  value: CellValue;
  mark: Mark;
  lit: boolean;
  conflict: boolean;
  clueStatus: ClueStatus | null;
  isCursor: boolean;
  showCursor: boolean;
  isHint: boolean;
  onSelect: (index: number) => void;
  onCross: (index: number) => void;
}

function CellInner(props: CellProps) {
  const { index, value, mark, lit, conflict, clueStatus, isCursor, showCursor, isHint, onSelect, onCross } = props;

  if (!isWhite(value)) {
    const clue = clueOf(value);
    const statusClass = clueStatus ? ` clue-${clueStatus}` : "";
    return (
      <div className={`akari-cell akari-wall${statusClass}`} aria-hidden={clue === null}>
        {clue === null ? "" : clue}
      </div>
    );
  }

  const classes = ["akari-cell", "akari-white"];
  if (lit) classes.push("lit");
  else classes.push("unlit-flag");
  if (isHint) classes.push("akari-hint");

  const label =
    mark === "bulb" ? "bulb" : mark === "cross" ? "marked, cannot be a bulb" : lit ? "lit cell" : "unlit cell";

  return (
    <div
      className={classes.join(" ")}
      role="button"
      tabIndex={-1}
      aria-label={`row ${Math.floor(index)} cell, ${label}`}
      onClick={() => onSelect(index)}
      onContextMenu={(e) => {
        e.preventDefault();
        onCross(index);
      }}
    >
      {mark === "bulb" && <span className={`akari-bulb${conflict ? " conflict" : ""}`} />}
      {mark === "cross" && <span className="akari-cross">×</span>}
      {isCursor && showCursor && <span className="akari-caret" />}
    </div>
  );
}

export const Cell = memo(CellInner);
