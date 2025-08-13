import type { Engine } from "../engine";
import type { GridView } from "../grid";
import { registry } from "../materials";
import { CAT } from "../materials/categories";
import { clamp16, stepTowardZero } from "../utils";
import {
  STATIC_PRESSURE_DECAY_PER_STEP,
  IMPULSE_DECAY_PER_STEP,
  PRESSURE_DIFFUSION_ALPHA,
  IMPULSE_BLEND_FACTOR,
} from "../constants";

// Very simple hydrostatic-like pressure estimator for liquids/gases.
// Not physically accurate, but provides gradients to drive lateral flow.
export function computePressure(
  engine: Engine,
  read: GridView,
  write: GridView
): void {
  const { w, h } = engine.grid;
  const mat = read.mat;
  const P = write.pressure;
  const I = write.impulse;

  // 1) decay existing static pressure and the impulse field separately
  const dt = engine.dt;
  const staticDecay = Math.pow(
    STATIC_PRESSURE_DECAY_PER_STEP,
    Math.max(1, dt * 60)
  );
  const impulseDecay = Math.pow(IMPULSE_DECAY_PER_STEP, Math.max(1, dt * 60));
  for (let i = 0; i < P.length; i++) {
    P[i] = clamp16(stepTowardZero(((P[i] | 0) * staticDecay) | 0));
    I[i] = clamp16(stepTowardZero(((I[i] | 0) * impulseDecay) | 0));
  }

  // 2) bottom-up accumulation for liquids; top-down for gases (quasi-static)
  for (let y = h - 2; y >= 1; y--) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const id = mat[i];
      const m = registry[id];
      if (!m) continue;
      if (m.category === CAT.LIQUID) {
        const below = i + w;
        const base = P[below] | 0;
        const dens = Math.max(1, Math.floor((m.density ?? 5) * 2));
        // scale per-step accumulation by dt relative to 60 Hz baseline
        const stepScale = Math.max(1, Math.round(engine.dt * 60));
        const next = base + dens * stepScale;
        if ((P[i] | 0) < next) P[i] = clamp16(next);
      } else if (m.category === CAT.GAS) {
        const below = i + w;
        const stepScale = Math.max(1, Math.round(engine.dt * 60));
        const next = (P[below] | 0) - 1 * stepScale;
        if ((P[i] | 0) > next) P[i] = clamp16(next);
      }
    }
  }

  // 3) light diffusion to bleed spikes (static field only)
  const alpha = PRESSURE_DIFFUSION_ALPHA;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const l = i - 1;
      const r = i + 1;
      const u = i - w;
      const d = i + w;
      const here = P[i] | 0;
      const avg = (((P[l] | 0) + (P[r] | 0) + (P[u] | 0) + (P[d] | 0)) / 4) | 0;
      const blended = here + (avg - here) * alpha;
      P[i] = clamp16(blended | 0);
    }
  }

  // 4) blend impulse into pressure used by movement, then partially write back
  // We add a fraction of the impulse to P to produce the effective pressure
  // for this frame, but keep impulse around with its own decay so it persists
  // for a few frames.
  for (let i = 0; i < P.length; i++) {
    const eff = ((P[i] | 0) + (I[i] | 0) * IMPULSE_BLEND_FACTOR) | 0;
    P[i] = clamp16(eff);
  }
}
