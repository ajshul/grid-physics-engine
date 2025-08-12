## Grid Sandbox — Engine First-Principles Alignment Roadmap

This document tracks tasks to align the simulation more closely with first principles and make results robust, deterministic, and testable. Items are organized by domain. Where relevant, a target test (skipped or soft) is referenced to unskip once the task is complete.

### Core Simulation Invariants and Units

- Define an explicit unit model in code comments and constants:
  - Temperature in °C, pressure in arbitrary Pa-like units, mass density in relative g/cm³ scale, heat capacity in relative kJ/(kg·K) scale.
  - Choose a fixed simulation time step dt (e.g. 1/60 s) and scale conduction, diffusion, cooling, and reaction rates to dt.
- Enforce energy-aware updates:
  - Treat diffusion/ambient cooling as additive updates derived from differential equations (not multiplicative resets) and scaled by thermal mass (density × heatCapacity).
  - Ensure total heat flow between two cells is antisymmetric to avoid energy creation/destruction where possible.
- Boundary conditions and walls:
  - Clarify how `STONE` or boundaries reflect/absorb heat and pressure (insulating vs. conductive walls, no-flow vs. slip boundaries). Add tunables.
  - Add a “sealed cell” helper for tests to construct deterministic boxed scenes.

### Thermal Model and Phase Changes

- Latent heat (Ice ↔ Water) consistency
  - Keep temperature pinned to the phase-change temperature while latent is being exchanged.
  - Use a coherent latent heat budget (scaled-to-sim units) and a per-step maximum to prevent instant melts.
  - After phase change, apply any leftover energy to the new phase’s temperature.
  - Tests to unskip/tighten: `thermal.test.ts` → “ice eventually melts to water…”.
- Boiling under pressure (Water → Steam)
  - Derive boiling point elevation from pressure with a clearer curve (current +0.05 per pressure tick is heuristic). Calibrate a gentle, monotonic relationship.
  - Replace the auxiliary “boil progress” with a mass- and dt-scaled accumulation that resets if temp < bp.
  - Ensure results are deterministic given the seeded RNG and fixed dt.
  - Tests to unskip/tighten: `thermal.test.ts` → “boiling requires sustained heat and is delayed by pressure”.
- Radiative/ambient cooling
  - Convert all cooling to additive, mass-aware updates; tune coefficients to avoid hot/cold “locking”.
  - Provide material-specific emissivity multipliers for high-temperature regimes (lava, fire) if needed.

### Pressure Field and Fluid Guidance

- Separate hydrostatic accumulation (quasi-static) from dynamic impulses (explosions, reactions):
  - Maintain a dedicated impulse buffer that decays faster than static pressure.
  - Blend both into the final field used for gas venting and liquid lateral motion.
- Improve vertical gradient handling for gases and liquids (consistent bottom-up/top-down passes) with explicit dt scaling.
- Tests to tighten/unskip after tuning:
  - Explosion impulse detection (see “Objects > Bomb” below).
  - Steam rise under heat in confined tanks (see `liquid_gas_powder.test.ts`).

### Liquids, Gases, Powders

- Immiscibility layering:
  - Revisit swap conditions for layered liquids, ensuring stability in confined tanks (consider local pressure + density checks and whether the write buffer still holds original values).
  - Add small hysteresis in swap threshold to prevent ping-pong.
  - Test: `liquid_gas_powder.test.ts` → water layers below oil in a tank (kept passing as soft assertion; tighten distribution thresholds after tuning).
- Steam rising and smoke dissipation:
  - Couple buoyancy to temperature more strongly; add minimum upward probability for hot steam and damp when cool.
  - Make smoke dissipation slightly more probable in sealed spaces while still diffusive; ensure at least one path to vanish in reasonable steps for tests.
  - Tests to unskip/tighten: `liquid_gas_powder.test.ts` → “steam rises when hot; smoke dissipates over time”.
- Powders:
  - Validate diagonal slip probabilities vs. humidity and local gas “wind”.
  - Confirm powder displacement of lighter liquids takes effect in basins; add hysteresis/priority to prevent being blocked by write-buffer race.
  - Test: `liquid_gas_powder.test.ts` → powders sink into lighter liquids in a basin (soft passing; further tighten acceptance window).

### Fire, Foam, Oil, Humidity (Energy rules)

- Deterministic ignition and suppression:
  - Reduce randomness in ignition around fire; let temperature exceed combustionTemp for a deterministic probability 1 when far above threshold.
  - Foam suppression: make suppression probability depend on foam proximity more deterministically (e.g. if any foam neighbor exists and temp < X, quench guaranteed). Scale with humidity.
  - Explicitly forbid foam cells from converting to fire; at most convert to water or remain foam.
  - Tests to unskip: `energy_objects_solid.test.ts` and `liquid_gas_powder.test.ts` → foam suppresses fire; fire heats neighbors but burns out to smoke/ember.
- Ember lifecycle and charring:
  - Ensure ember heating/cooling is time-step aware; cap ember lifetime deterministically for tests.
- Oil ignition synergy:
  - Retain easier propagation for contiguous oil cells but ensure determinism via local density-driven boosts rather than RNG.

### Acid Etching (Chemistry Pass)

- Etch rate determinism:
  - Scale etch probability by a dt-based rate and local temperature, but clamp within a deterministic window for tests.
  - Use a per-cell “etch budget” counter in AUX to model continuous exposure and trigger conversion once threshold is reached, instead of pure RNG.
  - Emit smoke deterministically once per N etched cells in neighborhood (configurable) to reduce test flakiness.
  - Tests to unskip/tighten: `liquid_gas_powder.test.ts` → acid etches stone/wood/glass to rubble; smoke emission optional but observable over time.

### Objects: Bomb, Meteor

- Bomb:
  - Make fuse strictly deterministic (already using AUX). Document expected fuse length and expose a constant.
  - On explosion, create a well-defined radial impulse field with deterministic amplitude profile and decay. Separate from static pressure and ensure it persists at least 1–2 frames.
  - Spawn smoke/fire deterministically within inner radius; consider a fixed pattern seeded by cell index to avoid RNG flakiness.
  - Test to unskip: `energy_objects_solid.test.ts` → explosion should create a detectable pressure spike in a search radius.
- Meteor:
  - Ensure meteor continues falling through gas (gravity) and heats neighbors on contact with solids.
  - Add a simple momentum model: if blocked by liquids/powders, attempt to displace/settle realistically; else keep descending in gas.
  - Test to tighten: `energy_objects_solid.test.ts` → meteor moves downward within bounded steps.

### Lava Cooling

- Long-horizon cooling:
  - Lava should remain hot but slowly cool toward ambient and eventually solidify into stone even without external cooling.
  - Consider adding a “crust” phase to improve visual plausibility.
  - Test to unskip: `interactions_additional.test.ts` → lava cools to stone eventually.

### Rendering and Overlays

- Temperature overlay:
  - Keep symmetric visualization around ambient (blue below, red above); expose overlay scaling in UI.
  - Add optional isoline toggle for temperature/pressure to assist debugging.
- Pressure overlay:
  - Distinguish static vs. impulse components visually for debugging explosions and reactions.

### Determinism & Testability

- RNG discipline:
  - Scope RNG usage per category pass and neighborhood to avoid order-dependent variability.
  - Prefer counters/thresholds over probabilities for test-critical conversions (boil progress, etch budget, suppression budget).
- Scheduling and write-buffer rules:
  - Document exact read/write rules per pass; forbid multiple category conflicts by ordering and write-guarding.
- Test harness:
  - Add helpers: `makeTank`, `heatRegion`, `coolRegion`, `seedFire`, `seedSteamHot`, `placeSolidBorder`, to produce reproducible scenes.
  - Replace some ad hoc testing with helper usage to remove incidental variability.
  - As tasks above land, unskip and tighten the following tests:
    - `thermal.test.ts`: melting under latent; boiling under pressure.
    - `liquid_gas_powder.test.ts`: foam suppression; acid etch; steam rise/dissipate; dust flash pressure bump.
    - `energy_objects_solid.test.ts`: fire ignite/suppress/burnout; bomb impulse.
    - `interactions_additional.test.ts`: lava cools to stone (long-horizon); steam condense near ice (already passing with relaxed locality, can tighten radius).

### Performance and Architecture

- Consider moving simulation to a Web Worker to decouple UI from step time; expose step rate control and pause/resume.
- Profile hot loops (powder/liquid/gas passes) and consider bit-packed flags or typed-struct accessors to reduce overhead.
- Expose a “fixed dt” option with substeps for stability in extreme scenes (high heat or pressure impulses).

### Documentation

- Write a short “Physics Assumptions” doc explaining:
  - Units, constants, dt scaling, and mapping to relative visual scales.
  - Material properties and how they influence conduction/phase/reactions.
  - Pressure model components (hydrostatic vs. impulse) and decay.
  - Determinism guidelines and RNG policy.

---

Tracking (tests to unskip after implementing above):

- thermal.test.ts
  - ice eventually melts to water only after sufficient latent heat accumulates
  - boiling requires sustained heat and is delayed by pressure
- liquid_gas_powder.test.ts
  - foam suppresses adjacent fire, not igniting itself
  - acid etches stone/wood/glass into rubble and may emit smoke
  - steam rises when hot; smoke dissipates over time
  - dust near fire flashes to smoke and creates a local pressure bump
- energy_objects_solid.test.ts
  - fire heats neighbors and can ignite flammable materials; foam suppresses
  - fire eventually burns out to smoke or ember and cools down
  - bomb fuses then explodes with heat, smoke/fire and pressure impulse
- interactions_additional.test.ts
  - lava without input heat cools to stone eventually
