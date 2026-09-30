"use client";

import { NeonButton } from "./ui";

export interface RulesPanelProps {
  open: boolean;
  onClose: () => void;
}

export function RulesPanel({ open, onClose }: RulesPanelProps) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="How to play Akari"
      onClick={onClose}
    >
      <div
        className="my-auto w-full max-w-lg rounded-xl border border-cyan-400/30 bg-slate-950/95 p-6 shadow-[0_0_60px_rgba(34,211,238,0.12)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-2xl tracking-[0.15em] text-amber-100">How to play</h2>

        <ol className="mb-5 flex list-decimal flex-col gap-3 pl-5 text-sm leading-relaxed text-slate-300">
          <li>
            <span className="text-cyan-200">Light every white cell.</span> A bulb lights its own cell and
            shines up, down, left and right until a wall or the grid edge stops the beam.
          </li>
          <li>
            <span className="text-cyan-200">Bulbs must not see each other.</span> Two bulbs in the same row
            or column with nothing between them is illegal — the offending bulbs flash red.
          </li>
          <li>
            <span className="text-cyan-200">Satisfy every number.</span> A numbered wall must touch exactly
            that many bulbs in the four cells sharing an edge. Numbers glow green when exact, red when over.
          </li>
        </ol>

        <h3 className="mb-2 text-xs uppercase tracking-[0.25em] text-slate-500">Controls</h3>
        <ul className="mb-6 flex flex-col gap-1.5 text-sm text-slate-300">
          <li>
            <span className="text-slate-100">Click / tap</span> a cell to cycle empty → bulb → cross → empty.
          </li>
          <li>
            <span className="text-slate-100">Right-click</span> to toggle a cross (marks &ldquo;cannot be a
            bulb&rdquo;).
          </li>
          <li>
            <span className="text-slate-100">Arrow keys</span> move the cursor, <span className="text-slate-100">Enter</span>{" "}
            places or removes a bulb, <span className="text-slate-100">X</span> toggles a cross.
          </li>
          <li>
            <span className="text-slate-100">Hint</span> reveals one bulb or cross you can deduce.
          </li>
        </ul>

        <div className="flex justify-end">
          <NeonButton variant="primary" onClick={onClose}>
            Got it
          </NeonButton>
        </div>
      </div>
    </div>
  );
}
