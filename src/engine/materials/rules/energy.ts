import type { Engine } from "../../engine";
import type { GridView } from "../../grid";
import { registry } from "../index";
import { FIRE, FOAM, SMOKE, STEAM, WATER, OIL, EMBER } from "../presets";
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
        if (nid === WATER) {
          // produce steam and extinguish
          W[i] = STEAM;
          T[j] = Math.max(T[j], 100);
          extinguished = true;
          break;
        }
        if (nid === FOAM) {
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
          if (T[j] >= threshold + 40) {
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
          if (rand() < chance) {
            W[j] = FIRE;
          }
        }
      }

      // Lifetime and burnout → smoke/ember (deterministic duration)
      let life = AUX[i];
      if (!life) life = (25 * Math.max(1, Math.round(engine.dt * 60))) as any;
      life--;
      AUX[i] = life as any;
      if (life <= 0) {
        // on burnout convert to ember (which cools and eventually ashes)
        W[i] = EMBER;
        // drop local temperature to avoid immediate re-ignition loops
        T[i] = Math.min(T[i], 260);
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
