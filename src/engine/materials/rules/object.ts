import type { Engine } from "../../engine";
import type { GridView } from "../../grid";
import { registry } from "../index";
import { BOMB, METEOR } from "../presets";
import { CAT } from "../categories";

export function stepObjects(
  engine: Engine,
  read: GridView,
  write: GridView,
  _rand: () => number
): void {
  const { w, h } = engine.grid;
  const R = read.mat;
  const W = write.mat;
  const I = write.impulse;
  for (let y = h - 2; y >= 1; y--) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const id = R[i];
      const m = registry[id];
      if (!m || m.category !== CAT.OBJECT) continue;

      const below = i + w;
      const belowId = R[below];
      // simple gravity for objects
      if (belowId === 0 || registry[belowId]?.category === CAT.GAS) {
        W[i] = 0;
        W[below] = id;
        engine.markDirty(x, y);
        engine.markDirty(x, y + 1);
        continue;
      }

      // simple behaviors
      if (id === BOMB) {
        // deterministic fuse in AUX
        const fuse = (write.aux[i] || 180) - 1;
        write.aux[i] = fuse;
        if (fuse <= 0) {
          explode(engine, write, x, y, 8);
          continue;
        }
      } else if (id === METEOR) {
        // heat surroundings and attempt displacement through powder/liquid
        heatNeighbors(engine, write, x, y, 2.0);
        const down = i + w;
        const mid = R[down];
        const mDown = registry[mid];
        if (
          mDown &&
          (mDown.category === CAT.POWDER || mDown.category === CAT.LIQUID)
        ) {
          // Push the medium sideways deterministically if room exists
          const left = down - 1;
          const right = down + 1;
          const canL = R[left] === 0 && (W[left] === 0 || W[left] === R[left]);
          const canR =
            R[right] === 0 && (W[right] === 0 || W[right] === R[right]);
          if (canL || canR) {
            const target = canL ? left : right;
            W[target] = mid;
            W[down] = id;
            W[i] = 0;
            engine.markDirty(x, y);
            engine.markDirty(canL ? x - 1 : x + 1, y + 1);
            continue;
          }
        }
      }
    }
  }
}

function explode(
  engine: Engine,
  write: GridView,
  cx: number,
  cy: number,
  r: number
): void {
  const { w, h } = engine.grid;
  const M = write.mat;
  const T = write.temp;
  const P = write.pressure;
  const I = write.impulse;
  const smokeId = findByName("Smoke");
  const fireId = findByName("Fire");
  const rubbleId = findByName("Rubble");
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > r * r) continue;
      const px = cx + dx;
      const py = cy + dy;
      if (px < 1 || py < 1 || px >= w - 1 || py >= h - 1) continue;
      const i = py * w + px;
      M[i] = smokeId ?? 0;
      if (fireId && Math.hypot(dx, dy) < r * 0.6) M[i] = fireId;
      T[i] = Math.max(T[i], 300);
      // radial impulse (separate from static pressure)
      I[i] = Math.max(I[i], (r * 20 - (dx * dx + dy * dy)) | 0);
      // occasional shrapnel turning nearby solids into rubble
      if (rubbleId && Math.hypot(dx, dy) > r * 0.5 && engine.rand() < 0.05) {
        const mid = M[i];
        if (registry[mid]?.category === CAT.SOLID) M[i] = rubbleId;
      }
      engine.markDirty(px, py);
    }
  }
}

function findByName(name: string): number | undefined {
  const id = Object.keys(registry).find((k) => registry[+k]?.name === name);
  return id ? +id : undefined;
}

function heatNeighbors(
  engine: Engine,
  write: GridView,
  x: number,
  y: number,
  amount: number
): void {
  const { w } = engine.grid;
  const T = write.temp;
  const i = y * w + x;
  const n = [i - 1, i + 1, i - w, i + w];
  for (const j of n) T[j] += amount;
}
