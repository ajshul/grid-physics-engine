## Grid Sandbox — Engine Guide (First Principles)

This document explains the simulation architecture, unit model, data layout, update order, materials, category rules, thermal/pressure models, reactions, determinism policy, and guidance for extending the engine.

### Goals

- Deterministic, testable 2D grid physics with a fixed time step (dt)
- First‑principles inspired behavior: mass/heat/phase change/pressure effects
- Structure‑of‑Arrays (SoA) for performance and clarity
- Clear rules per category (powder, liquid, gas, energy, object, solid)

---

## Units and Time Step

- Temperature: degrees Celsius (°C)
- Pressure: Int16 “Pa‑like” relative units (static) plus a separate Int16 transient impulse field
- Density, heat capacity, conductivity: relative coefficients that act as multipliers in heat/flow equations
- Fixed time step: `dt` seconds per frame (default 1/60 s). All rates scale with `dt` or `dt*Hz` as noted.

The engine is deterministic: the seeded RNG is used only where explicitly required, and local decisions are structured to avoid order dependence.

---

## Data Layout (SoA)

Grid cell data (`src/engine/grid.ts`):

- `mat: Uint16Array` — material id (0 = empty)
- `temp: Float32Array` — temperature (°C)
- `velX: Int8Array`, `velY: Int8Array` — coarse cell motion hints
- `flags: Uint8Array` — per‑frame hints; cleared each step
- `pressure: Int16Array` — persistent/static pressure field
- `impulse: Int16Array` — transient pressure impulses (explosions/reactions)
- `aux: Uint16Array` — per‑cell budget/timers (boiling progress, etch budget, fuses, ages…)
- `humidity: Uint8Array` — 0..255 wetness for cohesion/suppression
- `phase: Float32Array` — latent heat accumulator for phase changes (fusion)

Double buffering (`a` and `b`) ensures “read front, write back, then swap” each step.

---

## Update Order per Frame

1. Pressure pass (`passes/pressure.ts`)
2. Powders (`materials/rules/powder.ts`)
3. Liquids (`materials/rules/liquid.ts`)
4. Gases (`materials/rules/gas.ts`)
5. Solids (mostly stationary)
6. Energy (fire/ember) (`materials/rules/energy.ts`)
7. Objects (bomb/meteor/ball) (`materials/rules/object.ts`)
8. Chemistry pass (acid) (`passes/acid.ts`)
9. Thermal/Phase/Reactions (`materials/reactions.ts`)
10. Swap buffers

Implemented via `PassPipeline` (`engine/pipeline.ts`). Each pass writes to the back buffer and uses write-guards to minimize cross-pass clobbering. The order avoids write conflicts and reflects physical causality (pressure → motion → reactions → thermal).

---

## Pressure Model

Two components: static and impulse.

- Decay: static decays slowly, impulse decays faster (dt‑scaled). Both step toward zero to remove residual noise.
- Accumulation: bottom‑up hydrostatic accumulation for liquids; top‑down gradient for gases.
- Diffusion: light blending to remove spikes (single pass).
- Blending: the final `pressure` used by fluids is `static + k*impulse` (k≈0.6 by default), so shocks persist briefly.
  - Tunables for decay, diffusion, and blend live in `src/engine/constants.ts`.

Usage:

- Liquids: lateral move biased by horizontal pressure gradient; supports pooling, slope bias, and impulses from reactions.
- Gases: venting step occasionally moves towards lower effective pressure; buoyancy and temperature remain primary for vertical motion.

---

## Thermal and Phase Changes

### Antisymmetric Conduction

Pairwise exchange with right/down neighbors per step to avoid double counting:

- Effective conductivity: mean of neighbor conductivities, scaled by `CONDUCTION_SCALE * dt` (see `constants.ts`)
- Thermal mass: `heatCapacity * density` (bounded below)
- Heat flow `Q = (Tj - Ti) * k_eff`; updates are `+Q/mass_i` and `-Q/mass_j` (strictly antisymmetric)

### Ambient Cooling (Additive)

- Category baselines (gases coolest faster than solids); high‑temperature radiative tail
- Additive approach: `ΔT = (T_ambient − T) * rate_per_sec * dt / mass`
- Empty cells cool quickly; Steam cools slowly (to rise first)

### Latent Heat (ICE ↔ WATER)

- Temperature clamps to the phase point while latent accumulates in `phase`
- Fusion budget is spent/earned with a per‑step cap; any leftover raises/lowers the daughter phase temperature

### Boiling (WATER → STEAM)

- Boiling point raises gently with pressure: `bp ≈ 100 + 0.8*sqrt(max(0,P))`
- Overheat energy accumulates into `aux` (dt‑scaled). When threshold reached, convert to STEAM and carry over any leftover energy
  - The latent fusion budget and per‑step cap constants are defined in `constants.ts`.

### Steam Condensation

- Ambient condensation threshold ≈ 90°C
- Near cool surfaces (esp. Ice or cold solids) condenses at a slightly higher threshold
- Fresh steam has an “age” in `aux` and resists condensing until it had time to rise

### Other Thermal Behaviors

- Lava cools slowly towards ambient and eventually solidifies to Stone (no external cooling required). Lava preheats neighbors strongly; direct contact with flammables (Oil/Wood) deterministically ignites them before cooling/solidifying.
- Ice mildly cools its 4‑neighbors
- Rubber pops to Smoke when hot
- Wood can char (stochastically) before combustion

---

## Materials and Properties

Each `Material` has: `id`, `name`, `category`, `color`, `density`, optional `viscosity`, `flammable`/`combustionTemp`, `heatCapacity`, `conductivity`, phase points, `slip`, `bounciness`, `immiscibleWith`, and optional per‑tick `tick` handler.

### Catalog (selected)

- Solids: Stone, Wood, Ice, Glass, Rubber
- Powders: Sand, Dust, Rubble, Ash, Mud (wet dust)
- Liquids: Water, Oil, Acid, Foam, Lava
- Gases: Steam, Smoke
- Energy: Fire, Ember
- Objects: Bomb, Meteor, Ball

---

## Category Rules

### Powders (`rules/powder.ts`)

- Settle vertically into empty/gas; diagonal slip controlled by `slip`, humidity, and nearby gas “wind”
- Displace lighter liquids when falling; write‑buffer checks prevent race conditions

### Liquids (`rules/liquid.ts`)

- Density layering: heavier sinks, lighter rises (with immiscibility hysteresis)
- Downward flow if empty/gas below; diagonal downhill based on local pressure stack and parity to avoid bias
- Lateral flow guided by pressure gradient; viscosity limits spread per frame
- Humidity: WATER/FOAM/ACID wet neighbors, affecting powders and fire suppression
- Reaction (Water + Lava → Stone + Steam) requires sufficient heat to avoid instant stone coating; injects a small pressure impulse when it reacts (reaction gating and handling centralized in the liquid pass)

### Gases (`rules/gas.ts`)

- Buoyancy increases with temperature; hot gases prefer moving up
- Bubble swap under liquids may release trapped gas (probabilistic, hot gas favored)
- Steam: strong vertical preference when space above is free; lateral and diagonal moves are reduced, especially early in its “age”. Near Ice, upward preference is reduced to allow local condensation as it cools
- Smoke: diffuses and stochastically dissipates, slightly more so when enclosed (higher effective pressure magnitude)

### Energy (`rules/energy.ts`)

- Fire: heats neighbors; deterministic ignition when far above threshold; lifetime deterministic and fuel‑aware (uses `aux` + origin tag): oil → Smoke on burnout, wood → Ember; on burnout cools locally to avoid immediate re‑ignition
- Foam: deterministically quenches adjacent Fire by converting the fire cell to Foam; never converts Foam to Fire
- Oil: more easily ignited and propagates better along contiguous Oil
- Dust flash: high local Dust density near Fire may flash to Smoke and emits a small impulse

### Objects (`rules/object.ts`)

- Bomb: deterministic fuse via `aux`; explosion spawns Fire/Smoke, heats locally, and writes a radial impulse profile
- Meteor: falls through gas under gravity, heats neighbors on contact, and attempts limited displacement through liquids/powders

### Chemistry (`passes/acid.ts`)

- Acid etches Stone/Wood/Glass via a deterministic per‑cell “etch budget” (in `aux`), scaled by local temperature and `dt`
- Emits Smoke deterministically for every N conversions; raises local humidity; exothermic heat on the etched cell

---

## Rendering and Overlays

Renderer paints via palette; repaints only dirty chunks marked during the step.

- Overlays: temperature (blue→red around ambient) and pressure (static+impulse blended). Their alpha scales with magnitude.

---

## Determinism Policy

- Seeded RNG (`mulberry32`) provided at engine creation; used locally and consistently
- Category passes read from `front`, write to `back` only; no pass reads from `back`
- Counters/thresholds preferred over raw probabilities for test‑critical transitions (boil/etch/fuse/near‑lava ignition)
- Fixed `dt` and mass‑aware rates; avoid frame‑rate dependent behavior

---

## Tests and Expectations

Run: `npm run test`

Coverage (selected):

- Determinism under seeded RNG
- Powder settling and displacement
- Liquid layering, pressure‑guided spread; sand and water in basins
- Gas rise and smoke dissipation; steam rising; condensation near cold ice
- Thermal fundamentals: ambient cooling; latent heat melt; boiling delayed by pressure
- Energy interactions: ignition/suppression; burnout to ember/ash; bomb impulse
- Acid etching

All tests should pass deterministically under the default `dt`.

---

## Extensibility Guidelines

1. Add a material in `materials/presets.ts` with properties. Prefer realistic densities/heat capacities (relative scale) and explicit category
2. If behavior is general to a category, add it to the corresponding `rules/*.ts`; if it is thermal or cross‑category, prefer `reactions.ts`
3. Use `aux` for budgets/fuses/ages; keep units interpretable and `dt`‑scaled
4. Respect determinism: constrain RNG usage locally; avoid pass order dependencies; prefer thresholds and budgets
5. Scale all continuous rates by `dt` and thermal mass; keep antisymmetric conduction semantics
6. Add tests for new behaviors and tighten existing ones as needed

---

## Known Tunables

- `CONDUCTION_SCALE` (see `constants.ts`), ambient cooling baselines, steam cooling rate and condensation thresholds
- Pressure decay/diffusion constants and impulse blend factor (see `constants.ts`)
- Liquid slope bias and spread; gas buoyancy and rise probabilities
- Foam suppression strictness; ember burnout timing; acid etch budget/threshold
- Lava cooling rate and solidification threshold/energy budget (see `constants.ts`)

Most core constants live in `src/engine/constants.ts`; remaining local tunables are documented near their usage.
