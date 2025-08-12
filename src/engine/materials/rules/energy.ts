import type { Engine } from "../../engine";
import type { GridView } from "../../grid";
import { registry } from "../index";
import { FIRE, FOAM, SMOKE, STEAM, WATER, OIL, EMBER, WOOD } from "../presets";
import { getMaterialIdByName } from "../../utils";

export function stepEnergy(
  engine: Engine,
  read: GridView,
  write: GridView,
  rand: () => number
): void {
  const { w, h } = engine.grid;
  const R = read.mat;
  const W = write.mat;
  const T = write.temp;
  const AUX = write.aux;
  const HUM = write.humidity;
  const IMP = write.impulse;
  const VX = write.velX;
  const canWrite = (idx: number): boolean => W[idx] === R[idx];

  // const ASH = getMaterialIdByName("Ash"); // reserved for future use in burnout/ash logic
  const DUST = getMaterialIdByName("Dust");

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const id = R[i];
      if (id !== FIRE) continue;

      // base heat at fire cell
      T[i] = Math.max(T[i], 420);

      const n = [i - 1, i + 1, i - w, i + w];

      // Quenching by water/foam
      let extinguished = false;
      for (const j of n) {
        const nid = R[j];
        if (nid === WATER && canWrite(i)) {
          // produce steam and extinguish
          W[i] = STEAM;
          T[j] = Math.max(T[j], 100);
          extinguished = true;
          break;
        }
        if (nid === FOAM && canWrite(i)) {
          // Deterministic suppression if any foam neighbor and temperature not extreme
          if (T[i] < 800) {
            W[i] = FOAM; // smothered into foam mass (stable)
            extinguished = true;
            break;
          } else {
            // at very high temp, allow small chance to persist
            if (rand() < 0.05) {
              W[i] = FOAM;
              extinguished = true;
              break;
            }
          }
        }
      }
      if (extinguished) continue;

      // Heat neighbors and attempt ignition
      for (const j of n) {
        const mid = R[j];
        const mat = registry[mid];
        if (!mat) continue;
        T[j] = Math.max(T[j], T[i] - 20);
        if (mat.flammable) {
          // Foam suppression halo: reduce ignition probability around foam
          let halo = 0;
          for (const k of [j - 1, j + 1, j - w, j + w]) {
            if (R[k] === FOAM) halo++;
          }
          const suppression = Math.min(0.5, halo * 0.15);
          const humidityFactor = 1 - Math.min(0.6, ((HUM[j] || 0) / 255) * 0.6);
          // Deterministic ignition when far above threshold; probabilistic near threshold
          const threshold = mat.combustionTemp ?? 300;
          if (T[j] >= threshold + 40 && canWrite(j)) {
            W[j] = FIRE;
            continue;
          }
          const base = 0.05 * (1 - suppression) * humidityFactor;
          const tempBoost = Math.min(
            0.35,
            Math.max(0, (T[j] - threshold) / 600)
          );
          let chance = base + tempBoost;
          // Oil synergy: easier propagation along contiguous oil cells
          if (mid === OIL) {
            const oilNeighbors = [j - 1, j + 1, j - w, j + w].filter(
              (k) => R[k] === OIL
            ).length;
            chance += Math.min(0.2, oilNeighbors * 0.06);
          }
          if (rand() < chance && canWrite(j)) {
            // mark origin fuel type in VX for burnout byproducts
            const origin = mid === OIL ? 1 : mid === WOOD ? 2 : 0;
            W[j] = FIRE;
            VX[j] = origin as any;
          }
        }
      }

      // Lifetime and burnout → smoke/ember (fuel-aware deterministic duration)
      let life = AUX[i];
      // Longer for wood, shorter for oil
      if (!life) {
        const origin = VX[i] | 0;
        const base = origin === 2 ? 45 : origin === 1 ? 18 : 25; // frames at 60Hz
        life = (base * Math.max(1, Math.round(engine.dt * 60))) as any;
      }
      life--;
      AUX[i] = life as any;
      if (life <= 0 && canWrite(i)) {
        // Fuel-aware burnout using stored origin code in VX
        const origin = VX[i] | 0;
        if (origin === 1) {
          W[i] = SMOKE;
          T[i] = Math.max(80, Math.min(T[i], 220));
        } else if (origin === 2) {
          W[i] = EMBER;
          T[i] = Math.min(T[i], 260);
        } else {
          // default: ember
          W[i] = EMBER;
          T[i] = Math.min(T[i], 260);
        }
      }
      // If surrounded by cold non-flammable materials, shorten lifetime slightly
      const neigh = [i - 1, i + 1, i - w, i + w];
      let coldNeighbors = 0;
      for (const j of neigh)
        if (T[j] < 100 && !registry[R[j]]?.flammable) coldNeighbors++;
      if (coldNeighbors >= 3 && AUX[i] > 0) AUX[i] = (AUX[i] - 1) as any;

      // Dust flash hazard: if nearby density of dust is high, flash to smoke/ash with a small impulse bump
      if (DUST) {
        let dustCount = 0;
        for (const j of n) if (R[j] === DUST) dustCount++;
        if (dustCount >= 3 && rand() < 0.2) {
          for (const j of n) if (R[j] === DUST) W[j] = SMOKE;
          // small local impulse bump
          const { w: Ww } = engine.grid;
          IMP[i] = Math.max(IMP[i], 20);
          IMP[i - 1] = Math.max(IMP[i - 1], 12);
          IMP[i + 1] = Math.max(IMP[i + 1], 12);
          IMP[i - Ww] = Math.max(IMP[i - Ww], 12);
          IMP[i + Ww] = Math.max(IMP[i + Ww], 12);
        }
      }
    }
  }
}
