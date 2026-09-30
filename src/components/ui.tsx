"use client";

import { type ButtonHTMLAttributes, type ReactNode } from "react";

type Variant = "default" | "primary" | "ghost";

const VARIANTS: Record<Variant, string> = {
  default:
    "border-cyan-400/30 bg-slate-950/60 text-slate-200 hover:border-cyan-300/70 hover:text-white hover:bg-slate-900/70",
  primary:
    "border-amber-300/50 bg-amber-400/10 text-amber-100 hover:border-amber-200 hover:bg-amber-400/20 hover:text-white",
  ghost: "border-transparent bg-transparent text-slate-400 hover:text-cyan-200",
};

interface NeonButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  children: ReactNode;
}

export function NeonButton({ variant = "default", className = "", children, ...rest }: NeonButtonProps) {
  return (
    <button
      {...rest}
      className={
        "rounded-md border px-3 py-2 text-xs uppercase tracking-[0.15em] transition-colors " +
        "disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-cyan-400/30 " +
        VARIANTS[variant] +
        " " +
        className
      }
    >
      {children}
    </button>
  );
}

export function StatTile({ label, value, tone = "cyan" }: { label: string; value: string; tone?: "cyan" | "amber" | "rose" }) {
  const toneClass =
    tone === "amber" ? "text-amber-200" : tone === "rose" ? "text-rose-300" : "text-cyan-200";
  return (
    <div className="flex min-w-[4.5rem] flex-col items-center rounded-md border border-slate-700/60 bg-slate-950/50 px-3 py-1.5">
      <span className="text-[0.6rem] uppercase tracking-[0.2em] text-slate-500">{label}</span>
      <span className={`text-lg leading-tight tabular-nums ${toneClass}`}>{value}</span>
    </div>
  );
}
