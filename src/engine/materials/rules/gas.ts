import type { Engine } from "../../engine";
import type { GridView } from "../../grid";
import { registry } from "../index";
import { CAT } from "../categories";

export function stepGas(
  engine: Engine,
  read: GridView,
  write: GridView,
  rand: () => number
): void {
  const { w, h } = engine.grid;
  const R = read.mat;
  const W = write.mat;
  const P = write.pressure;
  const T = write.temp;
  const VX = write.velX;
  const VY = write.velY;
  for (let y = 1; y < h - 1; y++) {
    const dir = (y & 1) === 0 ? 1 : -1;
    for (let x = dir > 0 ? 1 : w - 2; dir > 0 ? x < w - 1 : x > 0; x += dir) {
      const i = y * w + x;
      const id = R[i];
      const m = registry[id];
      if (!m || m.category !== "gas") continue;
      const up = i - w;
      // temperature-coupled buoyancy: hotter gas is more eager to rise
      const buoyancyBoost = Math.min(2, Math.max(0, (T[i] - 100) / 100));
      if (R[up] === 0 || registry[R[up]]?.category === CAT.GAS) {
        W[i] = 0;
        W[up] = id;
        VY[up] = -1;
        engine.markDirty(x, y);
        engine.markDirty(x, y - 1);
        continue;
      }
      const ul = up - 1;
      const ur = up + 1;
      if (R[ul] === 0 && rand() < 0.5 + 0.25 * buoyancyBoost) {
        W[i] = 0;
        W[ul] = id;
        VX[ul] = -1;
        continue;
      }
      if (R[ur] === 0 && rand() < 0.5 + 0.25 * buoyancyBoost) {
        W[i] = 0;
        W[ur] = id;
        VX[ur] = 1;
        continue;
      }
      // random jitter diffusion
      const j = rand() < 0.5 ? i - 1 : i + 1;
      if (R[j] === 0) {
        W[i] = 0;
        W[j] = id;
        VX[j] = j === i - 1 ? -1 : 1;
      }

      // mild dissipation: chance to vanish each tick for smoke
      if (m.name === "Smoke" && rand() < 0.01) {
        W[i] = 0;
      }

      // simple venting: move towards lower pressure occasionally
      const pHere = P[i] | 0;
      const left = i - 1;
      const right = i + 1;
      if (
        R[left] === 0 &&
        pHere - (P[left] | 0) > 2 &&
        rand() < 0.1 + 0.05 * buoyancyBoost
      ) {
        W[i] = 0;
        W[left] = id;
        VX[left] = -1;
      } else if (
        R[right] === 0 &&
        pHere - (P[right] | 0) > 2 &&
        rand() < 0.1 + 0.05 * buoyancyBoost
      ) {
        W[i] = 0;
        W[right] = id;
        VX[right] = 1;
      }
    }
  }
}
