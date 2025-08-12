import type { Engine } from "../../engine";
import type { GridView } from "../../grid";
import { registry } from "../index";
import { CAT } from "../categories";
import { LAVA, STEAM, WATER } from "../presets";

export function stepLiquid(
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
  for (let y = h - 2; y >= 0; y--) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const id = R[i];
      const m = registry[id];
      if (!m || m.category !== "liquid") continue;

      const below = i + w;
      const above = i - w;
      const belowMat = registry[R[below]];
      const aboveMat = registry[R[above]];

      // buoyancy exchange between liquids based on density
      if (
        belowMat &&
        belowMat.category === CAT.LIQUID &&
        (m.density ?? 0) > (belowMat.density ?? 0)
      ) {
        // heavier sinks; respect immiscibility by requiring stronger drive
        const imm =
          (m.immiscibleWith && m.immiscibleWith.includes(belowMat.name)) ||
          (belowMat.immiscibleWith && belowMat.immiscibleWith.includes(m.name));
        const densDelta = (m.density ?? 0) - (belowMat.density ?? 0);
        if (!imm || densDelta > 1.5 || rand() < 0.2) {
          W[i] = R[below];
          W[below] = id;
          engine.markDirty(x, y);
          engine.markDirty(x, y + 1);
          continue;
        }
      }
      if (
        aboveMat &&
        aboveMat.category === CAT.LIQUID &&
        (m.density ?? 0) < (aboveMat.density ?? 0)
      ) {
        // lighter rises; respect immiscibility
        const imm =
          (m.immiscibleWith && m.immiscibleWith.includes(aboveMat.name)) ||
          (aboveMat.immiscibleWith && aboveMat.immiscibleWith.includes(m.name));
        const densDelta = (aboveMat.density ?? 0) - (m.density ?? 0);
        if (!imm || densDelta > 1.5 || rand() < 0.2) {
          W[i] = R[above];
          W[above] = id;
          engine.markDirty(x, y);
          engine.markDirty(x, y - 1);
          continue;
        }
      }
      if (R[below] === 0 || registry[R[below]]?.category === CAT.GAS) {
        W[i] = 0;
        W[below] = id;
        engine.markDirty(x, y);
        engine.markDirty(x, y + 1);
        continue;
      }
      const dl = below - 1;
      const dr = below + 1;
      // slope bias: prefer downhill (lower y) if neighbor stack is shorter
      const leftStack = (P[i - 1] | 0) + (P[dl] | 0);
      const rightStack = (P[i + 1] | 0) + (P[dr] | 0);
      const preferLeft = leftStack < rightStack - 2;
      if (R[dl] === 0 && R[i - 1] === 0 && (preferLeft || (x & 1) === 0)) {
        W[i] = 0;
        W[dl] = id;
        engine.markDirty(x, y);
        engine.markDirty(x - 1, y + 1);
        continue;
      }
      if (R[dr] === 0 && R[i + 1] === 0 && (!preferLeft || (x & 1) === 1)) {
        W[i] = 0;
        W[dr] = id;
        engine.markDirty(x, y);
        engine.markDirty(x + 1, y + 1);
        continue;
      }
      // lateral flow guided by pressure gradient
      const spread = Math.max(1, 3 - (m.viscosity ?? 1));
      const pHere = P[i] | 0;
      let bestDx = 0;
      let bestDrop = 0;
      for (let s = 1; s <= spread; s++) {
        const Li = i - s;
        const Ri = i + s;
        if (
          x - s >= 0 &&
          (R[Li] === 0 || registry[R[Li]]?.category === CAT.GAS)
        ) {
          const drop = pHere - (P[Li] | 0);
          if (drop > bestDrop) {
            bestDrop = drop;
            bestDx = -s;
          }
        }
        if (
          x + s < w &&
          (R[Ri] === 0 || registry[R[Ri]]?.category === CAT.GAS)
        ) {
          const drop = pHere - (P[Ri] | 0);
          if (drop > bestDrop) {
            bestDrop = drop;
            bestDx = s;
          }
        }
      }
      if (bestDx !== 0) {
        const target = i + bestDx;
        W[i] = 0;
        W[target] = id;
        engine.markDirty(x, y);
        engine.markDirty(x + bestDx, y);
      }

      // reactions: water + lava => stone + steam (handled here for immediacy)
      if (
        (id === WATER && R[below] === LAVA) ||
        (id === LAVA && R[below] === WATER)
      ) {
        const stoneId = Object.keys(registry).find(
          (k) => registry[+k]?.name === "Stone"
        );
        const steamId = STEAM;
        if (stoneId) {
          W[below] = +stoneId;
          W[i] = steamId;
          // heat burst
          T[i] = Math.max(T[i], 200);
          T[below] = Math.max(T[below], 200);
          // small outward gas push via pressure impulse
          const r = 2;
          for (let dy = -r; dy <= r; dy++) {
            for (let dx = -r; dx <= r; dx++) {
              if (dx * dx + dy * dy > r * r) continue;
              const px = x + dx;
              const py = y + dy;
              if (px < 1 || py < 1 || px >= w - 1 || py >= h - 1) continue;
              const k = py * w + px;
              P[k] = Math.max(P[k], (r * 4 - (dx * dx + dy * dy)) | 0);
            }
          }
        }
        engine.markDirty(x, y);
        engine.markDirty(x, y + 1);
        continue;
      }
    }
  }
}
