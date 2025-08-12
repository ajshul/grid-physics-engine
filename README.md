# Grid Sandbox — 2D Grid Physics Sandbox

A modern, deterministic, and extensible 2D grid-based physics sandbox built with Vite + React + TypeScript.

- Deterministic simulation (seeded RNG), double-buffered stepping
- Structure-of-Arrays (SoA) grid for performance
- Category rules for powders, liquids, gases, energy (fire), and objects
- Thermal diffusion + phase changes + reactions
- Pressure field (pseudo-hydrostatic) for liquid and gas guidance

This README summarizes how to run the project, the architecture, materials and interactions, and how to extend it. For a deep-dive design, see `../Materials_Interaction_Guide.md`.

## Quick Start

- Install deps: `npm i`
- Dev server: `npm run dev`
- Build: `npm run build`
- Preview build: `npm run preview`
- Tests (Vitest): `npm run test`

## Controls

- Left click: paint with the selected material
- Sidebar: pick material, change brush size, adjust speed, pause/resume

Planned (not yet implemented; see TODO.md): temperature/pressure overlays, additional tools (line/rect/fill/eyedropper/fan/heater/cooler), inspector panel, save/load/undo.

## Project Structure

```
src/
  engine/
    engine.ts           # main step loop (double buffer, seeded RNG)
    grid.ts             # SoA buffers and helpers
    rng.ts              # mulberry32 deterministic RNG
    passes/
      pressure.ts       # compute pseudo-hydrostatic pressure for flows
      acid.ts           # acid etching chemistry pass
    materials/
      index.ts          # registry + define()
      types.ts          # Material/Category types
      categories.ts     # CAT constants
      presets.ts        # all materials defined here
      reactions.ts      # thermal diffusion, phases, global reactions
      rules/
        powder.ts       # powders settling/diagonals/displacement
        liquid.ts       # liquids buoyancy + pressure-driven lateral flow
        gas.ts          # gases rise/diffuse/vent/dissipate
        energy.ts       # fire: ignite/heat/quench/foam-suppress
        object.ts       # bombs/meteors; deterministic fuse/explosion
  render/
    painter.ts          # canvas blit + palette
    palette.ts          # palette from materials
  state/
    useStore.ts         # Zustand UI store
  ui/
    CanvasView.tsx      # canvas + input interaction
    Palette.tsx         # material selection grid
  tests/
    *.test.ts           # basic determinism/rules tests
```

## Engine Overview

- Double buffer step: read Front, write Back, then swap
- Update order per frame: Powder → Liquid → Gas → Energy → Objects → Thermal/Reactions
- Pressure pass (i16): bottom-up accumulation for liquids, simple gradient for gases
- Thermal: 4-neighborhood diffusion + phase changes (ice↔water↔steam) with hysteresis
- Reactions: water+lava→stone+steam; rubber pops to smoke when hot; wood chars; foam slowly decays
- Objects: bomb uses `aux` as a deterministic fuse; explosion applies heat + smoke/fire + pressure impulse

## Materials (Selected)

- Solids: Stone, Wood, Ice, Glass, Rubber
- Powders: Sand, Dust, Rubble, Ash
- Liquids: Water, Oil, Acid, Foam, Lava
- Gases: Smoke, Steam
- Energy: Fire
- Objects: Bomb, Meteor, Ball

## Interactions (Selected)

- Water + Lava → Stone + Steam (heats area)
- Sand + Lava → Glass (high heat conversion; see guide)
- Oil near Fire ignites readily and propagates fire
- Foam suppresses Fire with high probability; slowly decays into Water
- Acid dissolves Stone/Wood/Glass into Rubble and emits heat + some Smoke
- Rubber pops into Smoke at high temperature
- Steam condenses to Water near cold cells; Water freezes to Ice at ≤0°C

For a detailed first-principles specification, consult `../Materials_Interaction_Guide.md`.

## Determinism and Performance

- Seeded RNG via `mulberry32`; category passes use `rand()` for probabilistic behavior
- SoA arrays minimize allocation and favor fast copies
- Pressure-guided liquid/gas movement improves realism without heavy solvers
- Build is optimized via Vite; consider moving simulation into a Web Worker (see TODO)

## Testing

- Determinism test: identical state hashes given seed after N steps
- Rules tests: powder fall, basic flows, gas rise

Run: `npm run test`

## Roadmap

See `TODO.md` for a comprehensive backlog (physics accuracy, tools, overlays, performance, determinism improvements, and QA).
