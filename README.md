# 2D Grid Sandbox

A modern, deterministic, and extensible 2D grid-based physics sandbox built with Vite + React + TypeScript.

- Deterministic simulation (seeded RNG), double-buffered stepping
- Structure-of-Arrays (SoA) grid for performance
- Category rules for powders, liquids, gases, energy (fire), and objects
- Thermal conduction + phase changes + reactions (antisymmetric, mass-aware conduction; latent heat; vitrification)
- Pressure field for liquid/gas guidance: persistent static field with decay/diffusion plus a separate transient impulse buffer (blended)
- Modular pass pipeline and write-guards to avoid cross-pass clobbering
- Fuel‑aware fire lifecycle (default burnout → Smoke; oil → Smoke; wood → Ember → Ash), embers only reignite with nearby fuel; lava reliably ignites flammables before cooling to stone

This README summarizes how to run the project, the architecture, materials and interactions, and how to extend it. For a deep-dive, see `./Engine_Guide.md`.

## Quick Start

- Install deps: `npm i`
- Dev server: `npm run dev`
- Build: `npm run build`
- Preview build: `npm run preview`
- Tests (Vitest): `npm run test`

## Controls

- Left click: paint with the selected material
- Sidebar:
  - Brush: set brush radius with the slider
  - Speed: simulation speed multiplier
  - Pause/Resume: toggle simulation
  - Step: advance one frame (when paused)
  - Clear: reset the world to ambient
  - Overlay: None / Temperature / Pressure
  - CRT: removed

Planned (see TODO.md): additional tools (line/rect/fill/eyedropper/fan/heater/cooler), expanded inspector, save/load/undo.

## Project Structure

```
src/
  engine/
    engine.ts           # main step loop (double buffer, seeded RNG)
    pipeline.ts         # modular pass pipeline (pressure → powder → liquid → gas → energy → objects → chemistry → thermal)
    grid.ts             # SoA buffers and helpers
      constants.ts        # core tunables (ambient, conduction, latent heat, pressure)
      utils.ts            # helpers (name lookup, neighbors, clamps)
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
     Palette.tsx         # material selection grid + overlay toggle + compact inspector
   tests/
     *.test.ts           # determinism, first-principles physics, pressure, overlays, humidity, category rules
```

## Engine Overview

- Double buffer step: read Front, write Back, then swap
- Update order per frame (via PassPipeline): Pressure → Powder → Liquid → Gas → Energy → Objects → Chemistry → Thermal/Reactions
- Pressure: static and impulse components; bottom-up accumulation for liquids, gradient for gases; blended for flow/venting
- Thermal: antisymmetric, mass-aware conduction; additive ambient cooling; latent heat (ice↔water); boiling delayed under pressure; steam rises then condenses
  - Empty space is strongly coupled to ambient to prevent residual heat; overlays redraw the full frame each tick to avoid stale visualization
- Reactions: water+lava→stone+steam (brief heat gating, then precedence); rubber pops to smoke; wood chars; foam deterministically quenches fire; acid etching deterministic via budgets; lava preheats/ignites nearby oil/wood before it cools to stone
- Objects: bomb uses `aux` as a deterministic fuse; explosion applies heat + smoke/fire + pressure impulse

Core tunables (e.g., ambient temperature, conduction scale, latent heat, pressure decay/diffusion, impulse blend) live in `src/engine/constants.ts`.

## Materials (Selected)

- Solids: Stone, Wood, Ice, Glass, Rubber
- Powders: Sand, Dust, Rubble, Ash
- Liquids: Water, Oil, Acid, Foam, Lava
- Gases: Smoke, Steam
- Energy: Fire
- Objects: Bomb, Meteor, Ball

## Interactions (Selected)

- Water + Lava → Stone + Steam (heats area; conversion may occur after brief heating and has precedence once hot)
- Sand + Lava → Glass (high heat conversion; see guide)
- Oil near Fire ignites readily and propagates fire; lava in contact with oil/wood ignites them
- Foam deterministically suppresses Fire and may decay into Water
- Acid dissolves Stone/Wood/Glass into Rubble and emits heat + some Smoke
- Rubber pops into Smoke at high temperature
- Fuel‑aware fire: default burnout is Smoke unless wood‑origin; burning oil tends to become Smoke; burning wood burns longer and tends to leave Ember (and can later Ash)
  - Water quenching: the water cell becomes Steam; the Fire cell becomes Ember if wood‑origin, otherwise Smoke
  - Burning spreads emit small smoke puffs in nearby empty cells; embers warm neighbors, cool gradually, and only reignite if fuel is adjacent
  - Embers fall if unsupported (with occasional diagonal slip), can ignite dust they contact, may crumble to Ash while falling, and quench to Ash when touching Water
  - Origin tagging: when Fire is painted over Oil/Wood or ignites them, its origin is tagged; if missing, origin may be inferred from nearby fuel
  - Mud wets Dust below over time by transferring humidity; sufficiently wet Dust converts to Mud
  - Dust has a higher ignition temperature to avoid spurious ignition in recently cooled areas
- Steam rises when hot and condenses to Water near cold cells; Water freezes to Ice at ≤0°C

For a detailed first-principles specification, see `./Engine_Guide.md`.

### Test Coverage (Added)

- Pressure model: hydrostatic gradient behavior, impulse blending/decay, diffusion and venting
- Painting semantics: temperature presets and buffer resets
- Humidity: wetting from Water/Foam/Acid and Mud→Dust transfer
- Gas/liquid bubble swap: hot gas releases under a sticky phase
- Overlay consistency: temperature/pressure fields evolve near activity

## Determinism and Performance

- Seeded RNG via `mulberry32`; probabilistic behavior is scoped and minimized; budgets/thresholds preferred for test-critical behavior
- SoA arrays minimize allocation and favor fast copies
- Pressure-guided liquid/gas movement improves realism without heavy solvers; liquids have slope bias; gases rise faster when hot; steam has vertical preference with age/condense rules
- Write-guards in passes avoid cross-pass clobbering; explicit reaction precedence is used for physically-driven conversions
- Build is optimized via Vite; consider moving simulation into a Web Worker (see TODO)

## Testing

- Determinism test: identical state hashes given seed after N steps
- Rules tests: powder fall, basic flows, gas rise
- Interaction tests: foam suppression; lava ignites wood/oil before cooling; water+lava reaction observed in a neighborhood

Run: `npm run test`

## Roadmap

See `TODO.md` for a comprehensive backlog (physics accuracy, tools, overlays, performance, determinism improvements, and QA).
