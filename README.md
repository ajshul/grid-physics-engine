# Grid Sandbox — 2D Grid Physics Sandbox

A modern, deterministic, and extensible 2D grid-based physics sandbox built with Vite + React + TypeScript.

- Deterministic simulation (seeded RNG), double-buffered stepping
- Structure-of-Arrays (SoA) grid for performance
- Category rules for powders, liquids, gases, energy (fire), and objects
- Thermal conduction + phase changes + reactions (antisymmetric, mass-aware conduction; latent heat; vitrification)
- Pressure field for liquid/gas guidance: persistent static field with decay/diffusion plus a separate transient impulse buffer (blended)

This README summarizes how to run the project, the architecture, materials and interactions, and how to extend it. For a deep-dive, see `./Engine_Guide.md`.

## Quick Start

- Install deps: `npm i`
- Dev server: `npm run dev`
- Build: `npm run build`
- Preview build: `npm run preview`
- Tests (Vitest): `npm run test`

## Controls

- Left click: paint with the selected material
- Sidebar: pick material, change brush size, adjust speed, pause/resume
- Toggle overlays (temperature/pressure) in the sidebar

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
    painter.ts          # canvas blit + palette + overlays (temp/pressure) + dirty chunks
    palette.ts          # palette from materials
  state/
    useStore.ts         # Zustand UI store
  ui/
    CanvasView.tsx      # canvas + input interaction
    Palette.tsx         # material selection grid + overlay toggle + inspector
  tests/
    *.test.ts           # basic determinism/rules tests
```

## Engine Overview

- Double buffer step: read Front, write Back, then swap
- Update order per frame: Pressure → Powder → Liquid → Gas → Energy → Objects → Chemistry → Thermal/Reactions
- Pressure: static and impulse components; bottom-up accumulation for liquids, gradient for gases; blended for flow/venting
- Thermal: antisymmetric, mass-aware conduction; additive ambient cooling; latent heat (ice↔water); boiling delayed under pressure; steam rises then condenses
- Reactions: water+lava→stone+steam (heat-gated); rubber pops to smoke; wood chars; foam deterministically quenches fire; acid etching deterministic via budgets
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
- Foam deterministically suppresses Fire and may decay into Water
- Acid dissolves Stone/Wood/Glass into Rubble and emits heat + some Smoke
- Rubber pops into Smoke at high temperature
- Steam rises when hot and condenses to Water near cold cells; Water freezes to Ice at ≤0°C

For a detailed first-principles specification, see `./Engine_Guide.md`.

## Determinism and Performance

- Seeded RNG via `mulberry32`; probabilistic behavior is scoped and minimized; budgets/thresholds preferred for test-critical behavior
- SoA arrays minimize allocation and favor fast copies
- Pressure-guided liquid/gas movement improves realism without heavy solvers; liquids have slope bias; gases rise faster when hot; steam has vertical preference with age/condense rules
- Build is optimized via Vite; consider moving simulation into a Web Worker (see TODO)

## Testing

- Determinism test: identical state hashes given seed after N steps
- Rules tests: powder fall, basic flows, gas rise

Run: `npm run test`

## Roadmap

See `TODO.md` for a comprehensive backlog (physics accuracy, tools, overlays, performance, determinism improvements, and QA).
