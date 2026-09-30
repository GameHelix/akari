# 💡 AKARI

A neon **Light Up** (Akari) puzzle — the classic logic game by Nikoli — built with **Next.js 16**, **TypeScript** (strict), and **Tailwind CSS v4**. Light bulbs sit on a dark grid and cast glowing beams down their row and column; solve a board by lighting every white cell while keeping bulbs out of each other's sight and satisfying every numbered wall. Every puzzle is produced from a seeded RNG and verified by the built-in solver to have exactly one solution, so you never have to guess.

## ✨ Features

| Feature | Detail |
| --- | --- |
| Unique solutions | A constraint-propagation + backtracking solver counts solutions and guarantees exactly one |
| Seeded generator | Reproducible boards at 7×7, 10×10 and 14×14; difficulty scales with size, wall density and how many clues are shown |
| Live feedback | Beams illuminate the grid in real time; conflicting bulbs flash red; numbered walls glow green / red when exact / over |
| Hints | Reveals one genuinely deducible bulb or cross, drawn from the same solver |
| Undo / redo | Full history with keyboard and on-screen controls |
| Timer & best times | Per-size best times persisted in `localStorage`, in sync across tabs |
| Neon / CRT theme | Share Tech Mono, radial glow backdrop and scanlines, with beams that dim under reduced-motion |
| Procedural sound | Web Audio effects for placing, removing, marking, conflicts, hints and winning — no asset files |
| Responsive & accessible | One-screen board at any width, touch and keyboard input, no horizontal scroll |

## 🎮 How to play

1. **Light every white cell.** A bulb lights its own cell and shines up, down, left and right until a wall or the grid edge blocks it.
2. **Bulbs must not see each other.** Two bulbs in the same row or column with nothing between them is illegal — the offenders flash red.
3. **Satisfy every number.** A numbered wall must touch exactly that many bulbs in the four cells sharing an edge.

Controls:

- **Click / tap** a cell to cycle empty → bulb → cross → empty.
- **Right-click** to toggle a cross ("cannot be a bulb").
- **Arrow keys** move the cursor, **Enter** places or removes a bulb, **X** toggles a cross, **H** asks for a hint.

## 🛠 Tech

- Next.js 16 (App Router)
- React 19 + TypeScript 5 (strict)
- Tailwind CSS v4 via `@tailwindcss/postcss`
- Web Audio API for procedural sound
- Vitest for the logic unit tests

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
npm test         # run the unit tests
npm run lint     # lint the project
```
