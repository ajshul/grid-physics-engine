import type { Engine } from "../../engine";
import type { GridView } from "../../grid";
import { registry } from "../index";
import { FIRE, FOAM, SMOKE, STEAM, WATER, OIL } from "../presets";

function findByName(name: string): number | undefined {
  const id = Object.keys(registry).find((k) => registry[+k]?.name === name);
  return id ? +id : undefined;
}

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

  const ASH = findByName("Ash");
  const DUST = findByName("Dust");

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
          if (rand() < 0.9) {
            W[i] = 0; // foam absorbs heat and smothers
            extinguished = true;
            break;
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
          const base = 0.08 * (1 - suppression); // baseline ignition chance
          const tempBoost = Math.min(
            0.35,
            Math.max(0, (T[j] - (mat.combustionTemp ?? 300)) / 800)
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

      // Lifetime and burnout → smoke/ash
      let life = AUX[i];
      if (!life) life = 30 + ((rand() * 10) | 0);
      life--;
      AUX[i] = life;
      if (life <= 0) {
        // leave smoke; occasionally ash
        if (ASH && rand() < 0.3) W[i] = ASH;
        else W[i] = SMOKE;
      }

      // Dust flash hazard: if nearby density of dust is high, flash to smoke/ash with a small pressure bump
      if (DUST) {
        let dustCount = 0;
        for (const j of n) if (R[j] === DUST) dustCount++;
        if (dustCount >= 3 && rand() < 0.2) {
          for (const j of n) if (R[j] === DUST) W[j] = SMOKE;
          // small local pressure bump
          const { w: Ww } = engine.grid;
          const Pi = write.pressure;
          Pi[i] = Math.max(Pi[i], 20);
          Pi[i - 1] = Math.max(Pi[i - 1], 12);
          Pi[i + 1] = Math.max(Pi[i + 1], 12);
          Pi[i - Ww] = Math.max(Pi[i - Ww], 12);
          Pi[i + Ww] = Math.max(Pi[i + Ww], 12);
        }
      }
    }
  }
}
