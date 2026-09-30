"use client";

import { type CSSProperties } from "react";
import { formatTime } from "@/lib/format";
import { NeonButton } from "./ui";

const GLOW: CSSProperties = {
  textShadow: "0 0 20px rgba(74, 222, 128, 0.55), 0 0 46px rgba(34, 211, 238, 0.28)",
};

export interface WinPanelProps {
  open: boolean;
  timeMs: number;
  best: number | null;
  isNewBest: boolean;
  onNew: () => void;
  onMenu: () => void;
}

export function WinPanel({ open, timeMs, best, isNewBest, onNew, onMenu }: WinPanelProps) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Puzzle solved"
    >
      <div className="win-sweep w-full max-w-sm rounded-xl border border-emerald-400/40 bg-slate-950/95 p-8 text-center shadow-[0_0_60px_rgba(74,222,128,0.18)]">
        <h2 className="text-3xl tracking-[0.2em] text-emerald-200" style={GLOW}>
          ALL LIT
        </h2>
        <p className="mt-1 text-sm uppercase tracking-[0.3em] text-slate-500">Puzzle solved</p>

        <div className="mt-6 flex items-center justify-center gap-8">
          <div className="flex flex-col">
            <span className="text-[0.6rem] uppercase tracking-[0.2em] text-slate-500">Time</span>
            <span className="text-2xl tabular-nums text-amber-100">{formatTime(timeMs)}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[0.6rem] uppercase tracking-[0.2em] text-slate-500">Best</span>
            <span className="text-2xl tabular-nums text-cyan-200">{best === null ? "—" : formatTime(best)}</span>
          </div>
        </div>

        {isNewBest && (
          <p className="mt-4 text-sm uppercase tracking-[0.25em] text-amber-300">★ New best time ★</p>
        )}

        <div className="mt-8 flex justify-center gap-2">
          <NeonButton variant="primary" onClick={onNew}>
            Play again
          </NeonButton>
          <NeonButton onClick={onMenu}>Menu</NeonButton>
        </div>
      </div>
    </div>
  );
}
