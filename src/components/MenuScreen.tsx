"use client";

import { type CSSProperties } from "react";
import { type SizePreset } from "@/lib/game";
import { formatTime } from "@/lib/format";
import { NeonButton } from "./ui";

const TITLE_GLOW: CSSProperties = {
  textShadow: "0 0 18px rgba(253, 224, 71, 0.55), 0 0 42px rgba(251, 191, 36, 0.3)",
};

export interface MenuScreenProps {
  sizes: readonly SizePreset[];
  bestBySize: Record<string, number | null>;
  onStart: (sizeId: string) => void;
  onRules: () => void;
  soundOn: boolean;
  onToggleSound: () => void;
}

export function MenuScreen({ sizes, bestBySize, onStart, onRules, soundOn, onToggleSound }: MenuScreenProps) {
  return (
    <div className="flex w-full max-w-md flex-col items-center gap-8 px-4 text-center">
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-5xl tracking-[0.2em] text-amber-100 sm:text-6xl" style={TITLE_GLOW}>
          💡 AKARI
        </h1>
        <p className="text-sm uppercase tracking-[0.35em] text-cyan-300/80">Light Up</p>
        <p className="max-w-sm text-sm leading-relaxed text-slate-400">
          Place bulbs so every white cell is lit, no two bulbs shine on each other, and each numbered
          wall touches exactly its number of bulbs.
        </p>
      </div>

      <div className="flex w-full flex-col gap-3">
        <span className="text-[0.65rem] uppercase tracking-[0.3em] text-slate-500">Choose a size</span>
        {sizes.map((s) => {
          const best = bestBySize[s.id] ?? null;
          return (
            <button
              key={s.id}
              onClick={() => onStart(s.id)}
              className="group flex items-center justify-between rounded-lg border border-cyan-400/25 bg-slate-950/50 px-5 py-4 text-left transition-colors hover:border-cyan-300/70 hover:bg-slate-900/70"
            >
              <span className="flex flex-col">
                <span className="text-lg text-slate-100">{s.label}</span>
                <span className="text-[0.65rem] uppercase tracking-[0.2em] text-slate-500">
                  {s.id === "7" ? "Gentle" : s.id === "10" ? "Tricky" : "Fiendish"}
                </span>
              </span>
              <span className="flex flex-col items-end text-xs text-slate-500">
                <span className="uppercase tracking-[0.2em]">Best</span>
                <span className="text-base tabular-nums text-amber-200">
                  {best === null ? "—" : formatTime(best)}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <NeonButton onClick={onRules}>How to play</NeonButton>
        <NeonButton variant="ghost" onClick={onToggleSound} aria-pressed={soundOn}>
          {soundOn ? "Sound on" : "Sound off"}
        </NeonButton>
      </div>
    </div>
  );
}
