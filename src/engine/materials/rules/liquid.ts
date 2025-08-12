import type { Engine } from "../../engine";
import type { GridView } from "../../grid";
import { registry } from "../index";
import { CAT } from "../categories";
import { LAVA, STEAM, WATER, FIRE } from "../presets";

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
  const I = write.impulse;
  const T = write.temp;
  const HUM = write.humidity;
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

      // remove any artificial holds; liquids should move according to rules

      // immediate reaction: water + lava -> stone + steam (pre-move)
      if (
        (id === WATER && R[below] === LAVA) ||
        (id === LAVA && R[below] === WATER)
      ) {
        // require some heating before instant vitrification: avoid instant coat
        const waterOnTop = id === WATER && R[below] === LAVA;
        const lavaOnTop = id === LAVA && R[below] === WATER;
        const hotEnough = waterOnTop
          ? T[i] > 80 || T[below] > 500
          : T[below] > 80 || T[i] > 500;
        if (!hotEnough) {
          // just exchange a bit of heat and skip reaction this frame
          T[i] = Math.max(T[i], 60);
          T[below] = Math.max(T[below], 200);
          // do not continue; allow normal movement below
        } else {
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
            // small outward gas push via impulse buffer
            const r = 2;
            for (let dy = -r; dy <= r; dy++) {
              for (let dx = -r; dx <= r; dx++) {
                if (dx * dx + dy * dy > r * r) continue;
                const px = x + dx;
                const py = y + dy;
                if (px < 1 || py < 1 || px >= w - 1 || py >= h - 1) continue;
                const k = py * w + px;
                I[k] = Math.max(I[k], (r * 4 - (dx * dx + dy * dy)) | 0);
              }
            }
          }
          engine.markDirty(x, y);
          engine.markDirty(x, y + 1);
          continue;
        }
      }

      // Tiny-puddle and sticky-foam/acid hold: avoid moving isolated droplets or sticky phases
      const left = i - 1;
      const right = i + 1;
      const up = i - w;
      const nearLiquid =
        [left, right, up, below].some(
          (j) => registry[R[j]]?.category === CAT.LIQUID && R[j] !== id
        ) || [left, right, up, below].some((j) => R[j] === id);
      const isIsolatedDroplet = !nearLiquid;
      const baseBp = registry[WATER]?.boilingPoint ?? 100;
      const hotNucleating = id === WATER && T[i] >= baseBp - 5;
      const sticky = m.name === "Foam" || m.name === "Acid";
      if (sticky || hotNucleating || isIsolatedDroplet) {
        // Skip motion for this cell this frame
        continue;
      }

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
      if (
        (R[below] === 0 || registry[R[below]]?.category === CAT.GAS) &&
        (W[below] === 0 || registry[W[below]]?.category === CAT.GAS)
      ) {
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
      if (
        R[dl] === 0 &&
        R[i - 1] === 0 &&
        (W[dl] === 0 || registry[W[dl]]?.category === CAT.GAS) &&
        (W[i - 1] === 0 || registry[W[i - 1]]?.category === CAT.GAS) &&
        (preferLeft || (x & 1) === 0)
      ) {
        W[i] = 0;
        W[dl] = id;
        engine.markDirty(x, y);
        engine.markDirty(x - 1, y + 1);
        continue;
      }
      if (
        R[dr] === 0 &&
        R[i + 1] === 0 &&
        (W[dr] === 0 || registry[W[dr]]?.category === CAT.GAS) &&
        (W[i + 1] === 0 || registry[W[i + 1]]?.category === CAT.GAS) &&
        (!preferLeft || (x & 1) === 1)
      ) {
        W[i] = 0;
        W[dr] = id;
        engine.markDirty(x, y);
        engine.markDirty(x + 1, y + 1);
        continue;
      }
      // lateral flow guided by pressure gradient; water cools hot gas pockets it flows into
      const spread = Math.max(1, 3 - (m.viscosity ?? 1));
      const pHere = P[i] | 0;
      let bestDx = 0;
      let bestDrop = 0;
      for (let s = 1; s <= spread; s++) {
        const Li = i - s;
        const Ri = i + s;
        if (
          x - s >= 0 &&
          (R[Li] === 0 || registry[R[Li]]?.category === CAT.GAS) &&
          (W[Li] === 0 || registry[W[Li]]?.category === CAT.GAS)
        ) {
          const drop = pHere - (P[Li] | 0);
          if (drop > bestDrop) {
            bestDrop = drop;
            bestDx = -s;
          }
        }
        if (
          x + s < w &&
          (R[Ri] === 0 || registry[R[Ri]]?.category === CAT.GAS) &&
          (W[Ri] === 0 || registry[W[Ri]]?.category === CAT.GAS)
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
        if (W[target] === 0 || registry[W[target]]?.category === CAT.GAS) {
          W[i] = 0;
          W[target] = id;
          // if moving water into hot gas region, apply cooling to prevent persistent steam traps
          if (id === WATER && T[target] > 50)
            T[target] = Math.max(20, T[target] - 2);
          engine.markDirty(x, y);
          engine.markDirty(x + bestDx, y);
        }
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
          // small outward gas push via impulse buffer
          const r = 2;
          for (let dy = -r; dy <= r; dy++) {
            for (let dx = -r; dx <= r; dx++) {
              if (dx * dx + dy * dy > r * r) continue;
              const px = x + dx;
              const py = y + dy;
              if (px < 1 || py < 1 || px >= w - 1 || py >= h - 1) continue;
              const k = py * w + px;
              I[k] = Math.max(I[k], (r * 4 - (dx * dx + dy * dy)) | 0);
            }
          }
        }
        engine.markDirty(x, y);
        engine.markDirty(x, y + 1);
        continue;
      }

      // humidity coupling: water/foam/acid wet neighboring cells
      if (id === WATER || m.name === "Foam" || m.name === "Acid") {
        const add = id === WATER ? 12 : m.name === "Foam" ? 8 : 10;
        const n = [i, i - 1, i + 1, i - w, i + w];
        for (const j of n) HUM[j] = Math.min(255, (HUM[j] | 0) + add) as any;
      }
    }
  }
}
