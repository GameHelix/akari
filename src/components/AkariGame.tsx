"use client";

import { type KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type GeneratedPuzzle,
  type Mark,
  type Puzzle,
  DEFAULT_SIZE_ID,
  SIZES,
  emptyMarks,
  evaluate,
  generate,
  getHint,
  isWhite,
  sizeById,
} from "@/lib/game";
import { computeSegments, type Segments } from "@/lib/game/grid";
import { useLocalStorage } from "@/lib/hooks/useLocalStorage";
import { useSound, type Voice } from "@/lib/hooks/useSound";
import { Board } from "./Board";
import { HudControls, HudStatus } from "./HUD";
import { MenuScreen } from "./MenuScreen";
import { RulesPanel } from "./RulesPanel";
import { WinPanel } from "./WinPanel";

interface Session {
  generated: GeneratedPuzzle;
  sizeId: string;
  marks: Mark[];
  past: Mark[][];
  future: Mark[][];
  cursor: number;
  startedAt: number;
  finishedMs: number | null;
  status: "playing" | "won";
  newBest: boolean;
}

type BestMap = Record<string, number | null>;

interface Latest {
  session: Session | null;
  puzzle: Puzzle | null;
  segments: Segments | null;
  bestBySize: BestMap;
  play: (v: Voice) => void;
  storeBest: (v: BestMap) => void;
}

/** Does the bulb at `i` share a run with another bulb, under `marks`? */
function bulbConflictAt(seg: Segments, marks: Mark[], i: number): boolean {
  let h = 0;
  let v = 0;
  for (const j of seg.members[seg.hSeg[i]]) if (marks[j] === "bulb") h++;
  for (const j of seg.members[seg.vSeg[i]]) if (marks[j] === "bulb") v++;
  return h > 1 || v > 1;
}

export function AkariGame() {
  const [view, setView] = useState<"menu" | "play">("menu");
  const [session, setSession] = useState<Session | null>(null);
  const [now, setNow] = useState(0);
  const [focused, setFocused] = useState(false);
  const [hintCell, setHintCell] = useState<number | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);

  const { value: soundOn, store: storeSound } = useLocalStorage<boolean>("akari:sound", true);
  const { value: bestBySize, store: storeBest } = useLocalStorage<BestMap>("akari:best", {});
  const play = useSound(soundOn);

  const puzzle = session?.generated.puzzle ?? null;
  const segments = useMemo<Segments | null>(() => (puzzle ? computeSegments(puzzle) : null), [puzzle]);
  const evaluation = useMemo(() => {
    if (!puzzle || !segments || !session) return null;
    return evaluate(puzzle, session.marks, segments);
  }, [puzzle, segments, session]);

  // A mutable snapshot the stable callbacks read from, so the board's handlers
  // never change identity and the memoised board skips timer-tick re-renders.
  const latest = useRef<Latest>({
    session: null,
    puzzle: null,
    segments: null,
    bestBySize: {},
    play,
    storeBest,
  });
  latest.current = { session, puzzle, segments, bestBySize, play, storeBest };

  const seedCounter = useRef(0);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Tick the clock while a puzzle is in progress. Depends only on the derived
  // primitives it reads, so it restarts on a new game — not on every move.
  const isPlaying = session?.status === "playing";
  const startedAt = session?.startedAt;
  useEffect(() => {
    if (!isPlaying || startedAt === undefined) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [isPlaying, startedAt]);

  useEffect(() => () => {
    if (hintTimer.current) clearTimeout(hintTimer.current);
  }, []);

  // A forward move: record history, detect the win, bank a new best time.
  const applyMove = useCallback((marks: Mark[], cursor: number) => {
    const L = latest.current;
    const s = L.session;
    if (!s || !L.puzzle || !L.segments) return;
    const ev = evaluate(L.puzzle, marks, L.segments);
    const justWon = s.status === "playing" && ev.solved;
    const finishedMs = justWon ? Date.now() - s.startedAt : s.finishedMs;
    const prevBest = L.bestBySize[s.sizeId] ?? null;
    const newBest = justWon ? prevBest === null || (finishedMs ?? Infinity) < prevBest : s.newBest;
    setSession({
      ...s,
      marks,
      cursor,
      past: [...s.past, s.marks],
      future: [],
      status: ev.solved ? "won" : "playing",
      finishedMs,
      newBest,
    });
    if (justWon) {
      L.play("win");
      if (newBest && finishedMs !== null) L.storeBest({ ...L.bestBySize, [s.sizeId]: finishedMs });
    }
  }, []);

  // Undo/redo restore explicit history stacks without re-firing the fanfare on
  // a state that was already solved.
  const restore = useCallback((marks: Mark[], past: Mark[][], future: Mark[][]) => {
    const L = latest.current;
    const s = L.session;
    if (!s || !L.puzzle || !L.segments) return;
    const ev = evaluate(L.puzzle, marks, L.segments);
    const justWon = s.status === "playing" && ev.solved;
    const finishedMs = justWon ? Date.now() - s.startedAt : ev.solved ? s.finishedMs : null;
    const prevBest = L.bestBySize[s.sizeId] ?? null;
    const newBest = justWon ? prevBest === null || (finishedMs ?? Infinity) < prevBest : ev.solved ? s.newBest : false;
    setSession({ ...s, marks, past, future, status: ev.solved ? "won" : "playing", finishedMs, newBest });
    if (justWon) {
      L.play("win");
      if (newBest && finishedMs !== null) L.storeBest({ ...L.bestBySize, [s.sizeId]: finishedMs });
    }
  }, []);

  const onSelect = useCallback(
    (i: number) => {
      const L = latest.current;
      const s = L.session;
      if (!s || s.status !== "playing" || !L.puzzle || !L.segments) return;
      if (!isWhite(L.puzzle.cells[i])) return;
      const cur = s.marks[i];
      const next: Mark = cur === "empty" ? "bulb" : cur === "bulb" ? "cross" : "empty";
      const nm = s.marks.slice();
      nm[i] = next;
      if (next === "bulb") L.play(bulbConflictAt(L.segments, nm, i) ? "reject" : "place");
      else if (cur === "bulb") L.play("remove");
      else L.play("mark");
      applyMove(nm, i);
    },
    [applyMove]
  );

  const onCross = useCallback(
    (i: number) => {
      const L = latest.current;
      const s = L.session;
      if (!s || s.status !== "playing" || !L.puzzle) return;
      if (!isWhite(L.puzzle.cells[i])) return;
      const cur = s.marks[i];
      const nm = s.marks.slice();
      nm[i] = cur === "cross" ? "empty" : "cross";
      L.play("mark");
      applyMove(nm, i);
    },
    [applyMove]
  );

  const doHint = useCallback(() => {
    const L = latest.current;
    const s = L.session;
    if (!s || s.status !== "playing" || !L.puzzle) return;
    const h = getHint(L.puzzle, s.marks);
    if (!h) return;
    const nm = s.marks.slice();
    nm[h.cell] = h.action === "bulb" ? "bulb" : "cross";
    L.play("hint");
    setHintCell(h.cell);
    if (hintTimer.current) clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setHintCell(null), 1500);
    applyMove(nm, h.cell);
  }, [applyMove]);

  const undo = useCallback(() => {
    const s = latest.current.session;
    if (!s || s.past.length === 0) return;
    latest.current.play("mark");
    restore(s.past[s.past.length - 1], s.past.slice(0, -1), [s.marks, ...s.future]);
  }, [restore]);

  const redo = useCallback(() => {
    const s = latest.current.session;
    if (!s || s.future.length === 0) return;
    latest.current.play("mark");
    restore(s.future[0], [...s.past, s.marks], s.future.slice(1));
  }, [restore]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      const L = latest.current;
      const s = L.session;
      if (!s || !L.puzzle) return;
      const p = L.puzzle;
      const { rows, cols } = p;

      const move = (dr: number, dc: number) => {
        e.preventDefault();
        let r = Math.floor(s.cursor / cols);
        let c = s.cursor % cols;
        for (;;) {
          r += dr;
          c += dc;
          if (r < 0 || r >= rows || c < 0 || c >= cols) return;
          const j = r * cols + c;
          if (isWhite(p.cells[j])) {
            setSession((prev) => (prev ? { ...prev, cursor: j } : prev));
            return;
          }
        }
      };

      switch (e.key) {
        case "ArrowUp":
          return move(-1, 0);
        case "ArrowDown":
          return move(1, 0);
        case "ArrowLeft":
          return move(0, -1);
        case "ArrowRight":
          return move(0, 1);
      }
      if (s.status !== "playing") return;

      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const i = s.cursor;
        if (!isWhite(p.cells[i]) || !L.segments) return;
        const cur = s.marks[i];
        const nm = s.marks.slice();
        nm[i] = cur === "bulb" ? "empty" : "bulb";
        if (nm[i] === "bulb") L.play(bulbConflictAt(L.segments, nm, i) ? "reject" : "place");
        else L.play("remove");
        applyMove(nm, i);
      } else if (e.key === "x" || e.key === "X") {
        e.preventDefault();
        const i = s.cursor;
        if (!isWhite(p.cells[i])) return;
        const cur = s.marks[i];
        const nm = s.marks.slice();
        nm[i] = cur === "cross" ? "empty" : "cross";
        L.play("mark");
        applyMove(nm, i);
      } else if (e.key === "h" || e.key === "H") {
        e.preventDefault();
        doHint();
      }
    },
    [applyMove, doHint]
  );

  const onFocusChange = useCallback((f: boolean) => setFocused(f), []);

  const startGame = useCallback((sizeId: string) => {
    const preset = sizeById(sizeId);
    const seed = (Date.now() ^ Math.imul(seedCounter.current++ + 1, 0x9e3779b1)) >>> 0;
    const g = generate({
      rows: preset.rows,
      cols: preset.cols,
      wallDensity: preset.wallDensity,
      clueFraction: preset.clueFraction,
      seed,
    });
    const firstWhite = g.puzzle.cells.findIndex(isWhite);
    setSession({
      generated: g,
      sizeId,
      marks: emptyMarks(g.puzzle),
      past: [],
      future: [],
      cursor: firstWhite < 0 ? 0 : firstWhite,
      startedAt: Date.now(),
      finishedMs: null,
      status: "playing",
      newBest: false,
    });
    setNow(Date.now());
    setHintCell(null);
    setView("play");
  }, []);

  const toMenu = useCallback(() => {
    setView("menu");
    setSession(null);
    setHintCell(null);
    if (hintTimer.current) clearTimeout(hintTimer.current);
  }, []);

  const toggleSound = useCallback(() => storeSound(!soundOn), [soundOn, storeSound]);

  const elapsed = session
    ? session.status === "won"
      ? session.finishedMs ?? 0
      : Math.max(0, now - session.startedAt)
    : 0;
  const currentBest = session ? bestBySize[session.sizeId] ?? null : null;

  return (
    <main className="relative flex min-h-[100svh] w-full flex-col items-center justify-center gap-4 px-4 py-6">
      {view === "menu" || !session || !evaluation ? (
        <MenuScreen
          sizes={SIZES}
          bestBySize={bestBySize}
          onStart={startGame}
          onRules={() => setRulesOpen(true)}
          soundOn={soundOn}
          onToggleSound={toggleSound}
        />
      ) : (
        <>
          <div
            className="text-lg tracking-[0.35em] text-amber-100"
            style={{ textShadow: "0 0 14px rgba(253, 224, 71, 0.45)" }}
          >
            💡 AKARI
          </div>
          <HudStatus
            timeMs={elapsed}
            best={currentBest}
            sizeLabel={sizeById(session.sizeId).label}
            unlit={evaluation.unlitCount}
            conflicts={evaluation.conflictCount}
          />
          <Board
            puzzle={session.generated.puzzle}
            segments={segments!}
            marks={session.marks}
            evaluation={evaluation}
            cursor={session.cursor}
            hintCell={hintCell}
            focused={focused}
            onSelect={onSelect}
            onCross={onCross}
            onKeyDown={onKeyDown}
            onFocusChange={onFocusChange}
          />
          <HudControls
            onHint={doHint}
            onUndo={undo}
            onRedo={redo}
            canUndo={session.past.length > 0}
            canRedo={session.future.length > 0}
            onNew={() => startGame(session.sizeId)}
            onMenu={toMenu}
            onRules={() => setRulesOpen(true)}
            soundOn={soundOn}
            onToggleSound={toggleSound}
          />
        </>
      )}

      <RulesPanel open={rulesOpen} onClose={() => setRulesOpen(false)} />
      <WinPanel
        open={session?.status === "won"}
        timeMs={session?.finishedMs ?? 0}
        best={currentBest}
        isNewBest={session?.newBest ?? false}
        onNew={() => startGame(session?.sizeId ?? DEFAULT_SIZE_ID)}
        onMenu={toMenu}
      />
    </main>
  );
}
