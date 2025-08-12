import type { Engine } from "../engine";
import type { GridView } from "../grid";
import { registry } from "../materials";
import { CAT } from "../materials/categories";

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

  // 1) decay existing pressure (carry impulses between frames)
  const decay = 0.95; // configurable if needed
  for (let i = 0; i < P.length; i++) {
    const v = P[i] | 0;
    const decayed = (v * decay) | 0;
    // bias toward zero by subtracting 1 when small to clear noise
    P[i] = clamp16(stepTowardZero(decayed));
  }

  // 2) bottom-up accumulation for liquids; top-down for gases
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
        const next = base + dens;
        if ((P[i] | 0) < next) P[i] = clamp16(next);
      } else if (m.category === CAT.GAS) {
        const below = i + w;
        const next = (P[below] | 0) - 1;
        if ((P[i] | 0) > next) P[i] = clamp16(next);
      }
    }
  }

  // 3) light diffusion to bleed spikes (no temp buffers, single-pass)
  const alpha = 0.05;
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
}

function clamp16(v: number): number {
  if (v > 32767) return 32767;
  if (v < -32768) return -32768;
  return v | 0;
}

function stepTowardZero(v: number): number {
  if (v > 0) return v - 1;
  if (v < 0) return v + 1;
  return 0;
}
