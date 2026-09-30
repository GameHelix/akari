"use client";

import { formatTime } from "@/lib/format";
import { NeonButton, StatTile } from "./ui";

export interface HudStatusProps {
  timeMs: number;
  best: number | null;
  sizeLabel: string;
  unlit: number;
  conflicts: number;
}

export function HudStatus({ timeMs, best, sizeLabel, unlit, conflicts }: HudStatusProps) {
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <div className="flex items-center gap-2">
        <StatTile label="Time" value={formatTime(timeMs)} />
        <StatTile label="Best" value={best === null ? "—" : formatTime(best)} tone="amber" />
        <StatTile label="Unlit" value={String(unlit)} tone={unlit === 0 ? "amber" : "cyan"} />
      </div>
      <div className="flex h-4 items-center gap-3 text-[0.65rem] uppercase tracking-[0.2em]">
        <span className="text-slate-500">{sizeLabel}</span>
        {conflicts > 0 && (
          <span className="text-rose-400">{conflicts} conflict{conflicts > 1 ? "s" : ""}</span>
        )}
      </div>
    </div>
  );
}

export interface HudControlsProps {
  onHint: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onNew: () => void;
  onMenu: () => void;
  onRules: () => void;
  soundOn: boolean;
  onToggleSound: () => void;
}

export function HudControls(props: HudControlsProps) {
  return (
    <div className="flex w-full max-w-md flex-wrap items-center justify-center gap-2">
      <NeonButton variant="primary" onClick={props.onHint}>
        Hint
      </NeonButton>
      <NeonButton onClick={props.onUndo} disabled={!props.canUndo} aria-label="Undo">
        Undo
      </NeonButton>
      <NeonButton onClick={props.onRedo} disabled={!props.canRedo} aria-label="Redo">
        Redo
      </NeonButton>
      <NeonButton onClick={props.onNew}>New</NeonButton>
      <NeonButton onClick={props.onRules}>Rules</NeonButton>
      <NeonButton variant="ghost" onClick={props.onToggleSound} aria-pressed={props.soundOn}>
        {props.soundOn ? "Sound on" : "Sound off"}
      </NeonButton>
      <NeonButton variant="ghost" onClick={props.onMenu}>
        Menu
      </NeonButton>
    </div>
  );
}
