import type { Engine } from "../../engine";
import type { GridView } from "../../grid";
import { registry } from "../index";
import { BOMB, METEOR } from "../presets";
import { CAT } from "../categories";
import { getMaterialIdByName } from "../../utils";
import {
  BOMB_DEFAULT_FUSE_STEPS,
  METEOR_HEAT_NEIGHBORS_AMOUNT,
  BOMB_EXPLOSION_RADIUS,
  EXPLOSION_HEAT_C,
  IMPULSE_RADIAL_SCALE,
  EXPLOSION_SHRAPNEL_CHANCE,
  EXPLOSION_SHRAPNEL_MIN_RADIUS_FRAC,
} from "../../constants";

export function stepObjects(
  engine: Engine,
  read: GridView,
  write: GridView,
  _rand: () => number
): void {
  const { w, h } = engine.grid;
  const R = read.mat;
  const W = write.mat;
  // const I = write.impulse; // not used in main loop; explosion writes impulse
  const canWrite = (idx: number): boolean => W[idx] === R[idx];
  for (let y = h - 2; y >= 1; y--) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const id = R[i];
      const m = registry[id];
      if (!m || m.category !== CAT.OBJECT) continue;

      const below = i + w;
      const belowId = R[below];
      // simple gravity for objects
      if (
        (belowId === 0 || registry[belowId]?.category === CAT.GAS) &&
        canWrite(i) &&
        canWrite(below)
      ) {
        W[i] = 0;
        W[below] = id;
        engine.markDirty(x, y);
        engine.markDirty(x, y + 1);
        continue;
      }

      // simple behaviors
      if (id === BOMB) {
        // deterministic fuse in AUX
        const fuse = (write.aux[i] || BOMB_DEFAULT_FUSE_STEPS) - 1;
        write.aux[i] = fuse;
        if (fuse <= 0) {
          explode(engine, write, x, y, BOMB_EXPLOSION_RADIUS);
          continue;
        }
      } else if (id === METEOR) {
        // heat surroundings and attempt displacement through powder/liquid
        heatNeighbors(engine, write, x, y, METEOR_HEAT_NEIGHBORS_AMOUNT);
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
          if ((canL || canR) && canWrite(i) && canWrite(down)) {
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
  // const P = write.pressure; // not used directly here
  const I = write.impulse;
  const smokeId = getMaterialIdByName("Smoke");
  const fireId = getMaterialIdByName("Fire");
  const rubbleId = getMaterialIdByName("Rubble");
  const bedrockId = getMaterialIdByName("Bedrock");
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > r * r) continue;
      const px = cx + dx;
      const py = cy + dy;
      if (px < 1 || py < 1 || px >= w - 1 || py >= h - 1) continue;
      const i = py * w + px;
      // Do not modify bedrock cells
      if (typeof bedrockId === "number" && M[i] === bedrockId) continue;
      M[i] = smokeId ?? 0;
      if (fireId && Math.hypot(dx, dy) < r * 0.6) M[i] = fireId;
      T[i] = Math.max(T[i], EXPLOSION_HEAT_C);
      // radial impulse (separate from static pressure)
      I[i] = Math.max(
        I[i],
        (r * IMPULSE_RADIAL_SCALE - (dx * dx + dy * dy)) | 0
      );
      // occasional shrapnel turning nearby solids into rubble
      if (
        rubbleId &&
        Math.hypot(dx, dy) > r * EXPLOSION_SHRAPNEL_MIN_RADIUS_FRAC &&
        engine.rand() < EXPLOSION_SHRAPNEL_CHANCE
      ) {
        const mid = M[i];
        if (
          registry[mid]?.category === CAT.SOLID &&
          (typeof bedrockId !== "number" || mid !== bedrockId)
        )
          M[i] = rubbleId;
      }
      engine.markDirty(px, py);
    }
  }
}

// findByName centralized in utils

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
