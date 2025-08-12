import type { Engine } from "../../engine";
import type { GridView } from "../../grid";
import { registry } from "../index";
import { CAT } from "../categories";
import { LAVA, STEAM, WATER, STONE, FIRE } from "../presets";
import {
  HUMIDITY_FROM_WATER_PER_STEP,
  HUMIDITY_FROM_FOAM_PER_STEP,
  HUMIDITY_FROM_ACID_PER_STEP,
  LAVA_PREHEAT_NEIGHBOR_TARGET_MAX_C,
  LAVA_PREHEAT_NEIGHBOR_OFFSET_C,
  WATER_LAVA_REACT_WATER_TEMP_C,
  WATER_LAVA_REACT_LAVA_TEMP_C,
  WATER_LAVA_REACTION_IMPULSE_RADIUS,
  REACTION_IMPULSE_RADIAL_SCALE,
  WATER_NEAR_BOIL_HOLD_DELTA_C,
  IMMISCIBILITY_DENSITY_DELTA_THRESHOLD,
  WATER_MOVE_INTO_HOT_GAS_COOL_DELTA_C,
  WATER_MOVE_COOL_MIN_TEMP_C,
} from "../../constants";

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
  const canWrite = (idx: number): boolean => W[idx] === R[idx];
  const VX = write.velX;
  for (let y = h - 2; y >= 0; y--) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const id = R[i];
      const m = registry[id];
      if (!m || m.category !== "liquid") continue;

      // humidity coupling: water/foam/acid wet neighboring cells (apply regardless of movement)
      if (id === WATER || m.name === "Foam" || m.name === "Acid") {
        const add =
          id === WATER
            ? HUMIDITY_FROM_WATER_PER_STEP
            : m.name === "Foam"
            ? HUMIDITY_FROM_FOAM_PER_STEP
            : HUMIDITY_FROM_ACID_PER_STEP;
        const n = [i, i - 1, i + 1, i - w, i + w];
        for (const j of n) HUM[j] = Math.min(255, (HUM[j] | 0) + add) as any;
      }

      // Lava strongly preheats adjacent cells before movement to better model radiative/contact heating
      if (m.name === "Lava") {
        const neigh = [i - 1, i + 1, i - w, i + w];
        for (const j of neigh) {
          // raise neighbor temperature toward a hot target to ensure ignition without instant stone coating
          const target = Math.min(
            LAVA_PREHEAT_NEIGHBOR_TARGET_MAX_C,
            (T[i] | 0) - LAVA_PREHEAT_NEIGHBOR_OFFSET_C
          );
          if (target > (T[j] | 0)) T[j] = target;
          // direct contact ignition for flammables (oil, wood) — immediate and deterministic
          const mid = R[j];
          const mn = registry[mid];
          if (mn?.flammable) {
            // Reaction precedence: force ignition even if prior writes attempted movement
            W[j] = FIRE; // rely on energy pass to evolve; tag origin in VX
            VX[j] = (mn.name === "Oil" ? 1 : mn.name === "Wood" ? 2 : 0) as any;
            T[j] = Math.max(T[j], 320);
            engine.markDirty(j % w, (j / w) | 0);
          }
        }
      }

      const below = i + w;
      const above = i - w;
      const belowMat = registry[R[below]];
      const aboveMat = registry[R[above]];

      // remove any artificial holds; liquids should move according to rules

      // immediate reaction: water + lava -> stone + steam (pre-move)
      // Do NOT react with solids like wood/oil here; handled by thermal/energy passes
      if (
        (id === WATER && R[below] === LAVA) ||
        (id === LAVA && R[below] === WATER)
      ) {
        // require some heating before instant vitrification: avoid instant coat
        const waterOnTop = id === WATER && R[below] === LAVA;
        const hotEnough = waterOnTop
          ? T[i] > WATER_LAVA_REACT_WATER_TEMP_C ||
            T[below] > WATER_LAVA_REACT_LAVA_TEMP_C
          : T[below] > WATER_LAVA_REACT_WATER_TEMP_C ||
            T[i] > WATER_LAVA_REACT_LAVA_TEMP_C;
        if (!hotEnough) {
          // just exchange a bit of heat and skip reaction this frame
          T[i] = Math.max(T[i], 60);
          T[below] = Math.max(T[below], 200);
          // do not continue; allow normal movement below
        } else {
          // Reaction takes precedence over previous writes; enforce conversion
          W[below] = STONE;
          W[i] = STEAM;
          // heat burst
          T[i] = Math.max(T[i], 200);
          T[below] = Math.max(T[below], 200);
          // small outward gas push via impulse buffer
          const r = WATER_LAVA_REACTION_IMPULSE_RADIUS;
          for (let dy = -r; dy <= r; dy++) {
            for (let dx = -r; dx <= r; dx++) {
              if (dx * dx + dy * dy > r * r) continue;
              const px = x + dx;
              const py = y + dy;
              if (px < 1 || py < 1 || px >= w - 1 || py >= h - 1) continue;
              const k = py * w + px;
              I[k] = Math.max(
                I[k],
                (r * REACTION_IMPULSE_RADIAL_SCALE - (dx * dx + dy * dy)) | 0
              );
            }
          }
          engine.markDirty(x, y);
          engine.markDirty(x, y + 1);
          continue;
        }
      }

      // Tiny-puddle and sticky-foam/acid hold: avoid moving sticky phases or near-boiling water
      // local neighbor indices (unused here but kept for consistent neighborhood patterns)
      // const left = i - 1;
      // const right = i + 1;
      // const up = i - w;
      const baseBp = registry[WATER]?.boilingPoint ?? 100;
      const hotNucleating =
        id === WATER && T[i] >= baseBp - WATER_NEAR_BOIL_HOLD_DELTA_C;
      const sticky = m.name === "Foam" || m.name === "Acid";
      if (sticky || hotNucleating) {
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
        if (
          (!imm ||
            densDelta > IMMISCIBILITY_DENSITY_DELTA_THRESHOLD ||
            rand() < 0.2) &&
          canWrite(i) &&
          canWrite(below)
        ) {
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
        if (
          (!imm ||
            densDelta > IMMISCIBILITY_DENSITY_DELTA_THRESHOLD ||
            rand() < 0.2) &&
          canWrite(i) &&
          canWrite(above)
        ) {
          W[i] = R[above];
          W[above] = id;
          engine.markDirty(x, y);
          engine.markDirty(x, y - 1);
          continue;
        }
      }
      if (
        (R[below] === 0 || registry[R[below]]?.category === CAT.GAS) &&
        (W[below] === 0 || registry[W[below]]?.category === CAT.GAS) &&
        canWrite(i) &&
        canWrite(below)
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
        (preferLeft || (x & 1) === 0) &&
        canWrite(i) &&
        canWrite(dl)
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
        (!preferLeft || (x & 1) === 1) &&
        canWrite(i) &&
        canWrite(dr)
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
      if (bestDx !== 0 && canWrite(i) && canWrite(i + bestDx)) {
        const target = i + bestDx;
        if (W[target] === 0 || registry[W[target]]?.category === CAT.GAS) {
          W[i] = 0;
          W[target] = id;
          // if moving water into hot gas region, apply cooling to prevent persistent steam traps
          if (id === WATER && T[target] > WATER_MOVE_COOL_MIN_TEMP_C)
            T[target] = Math.max(
              20,
              T[target] - WATER_MOVE_INTO_HOT_GAS_COOL_DELTA_C
            );
          engine.markDirty(x, y);
          engine.markDirty(x + bestDx, y);
        }
      }

      // (water+lava handled earlier)

      // (humidity coupling moved earlier so it applies even on frames with movement)
    }
  }
}
