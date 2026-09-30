"use client";

import { useCallback, useRef } from "react";

export type Voice = "place" | "remove" | "mark" | "reject" | "hint" | "win";

/**
 * Procedural Web Audio effects — no asset files, so nothing to load or 404.
 * The context is created lazily on the first sound because browsers refuse to
 * start one before a user gesture.
 */
export function useSound(enabled: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);

  const context = useCallback((): AudioContext | null => {
    if (typeof window === "undefined") return null;
    if (!ctxRef.current) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      ctxRef.current = new Ctor();
    }
    if (ctxRef.current.state === "suspended") void ctxRef.current.resume();
    return ctxRef.current;
  }, []);

  const blip = useCallback(
    (
      ctx: AudioContext,
      freq: number,
      duration: number,
      type: OscillatorType,
      gain: number,
      slideTo?: number,
      delay = 0
    ) => {
      const start = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const amp = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, start);
      if (slideTo !== undefined) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(slideTo, 1), start + duration);
      }
      amp.gain.setValueAtTime(gain, start);
      amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.connect(amp).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration);
      // Release the nodes as soon as they are silent so nothing accumulates
      // over a long session.
      osc.onended = () => {
        osc.disconnect();
        amp.disconnect();
      };
    },
    []
  );

  const play = useCallback(
    (voice: Voice) => {
      if (!enabled) return;
      const ctx = context();
      if (!ctx) return;

      switch (voice) {
        case "place":
          // A bulb springs on — a warm two-note bloom, like a filament catching.
          blip(ctx, 523, 0.08, "sine", 0.05);
          blip(ctx, 784, 0.14, "sine", 0.045, undefined, 0.05);
          break;
        case "remove":
          // The light goes out: a short downward glide.
          blip(ctx, 520, 0.12, "triangle", 0.04, 240);
          break;
        case "mark":
          // A dry tick for placing or clearing a cross.
          blip(ctx, 340, 0.04, "square", 0.02);
          break;
        case "reject":
          // Two bulbs blind each other — a harsh low buzz.
          blip(ctx, 180, 0.22, "sawtooth", 0.04, 90);
          break;
        case "hint":
          // A rising sparkle that points somewhere on the board.
          [740, 988, 1245].forEach((f, i) => blip(ctx, f, 0.12, "triangle", 0.04, undefined, i * 0.06));
          break;
        case "win":
          // Everything lights up at once — an ascending fanfare.
          [523, 659, 784, 1046, 1318].forEach((f, i) =>
            blip(ctx, f, 0.24, "triangle", 0.055, undefined, i * 0.1)
          );
          break;
      }
    },
    [blip, context, enabled]
  );

  return play;
}
