import type { Engine } from "../../engine";
import type { GridView } from "../../grid";
import { registry } from "../index";
import {
  FIRE,
  FOAM,
  SMOKE,
  STEAM,
  WATER,
  OIL,
  EMBER,
  WOOD,
  ASH,
  DUST,
} from "../presets";
// getMaterialIdByName no longer needed; use preset ids directly
import {
  FIRE_INIT_TEMP_C,
  FIRE_NEIGHBOR_HEAT_DROP_C,
  FOAM_HALO_MAX_SUPPRESSION,
  FOAM_HALO_SUPPRESSION_PER_NEIGHBOR,
  HUMIDITY_IGNITION_REDUCTION_SCALE,
  IGNITION_DETERMINISTIC_MARGIN_C,
  BASE_IGNITION_CHANCE,
  TEMP_IGNITION_BOOST_CAP,
  TEMP_IGNITION_BOOST_DIVISOR,
  OIL_NEIGHBOR_IGNITION_BONUS_CAP,
  OIL_NEIGHBOR_IGNITION_BONUS_PER,
  FIRE_WOOD_SMOKE_EMIT_PROB,
  FIRE_BASE_LIFE_WOOD_FRAMES,
  FIRE_BASE_LIFE_OIL_FRAMES,
  FIRE_BASE_LIFE_DEFAULT_FRAMES,
  SMOKE_TEMP_CLAMP_MIN_C,
  SMOKE_TEMP_CLAMP_MAX_C,
  EMBER_IGNITE_DUST_CHANCE,
  EMBER_CRUMBLE_AFTER_IGNITING_CHANCE,
  EMBER_FREE_FALL_CRUMBLE_CHANCE,
  EMBER_ASH_COOL_TEMP_C,
  FOAM_SUPPRESS_MAX_TEMP_C,
  FOAM_SUPPRESS_PERSIST_CHANCE_AT_HIGH_TEMP,
  FIRE_QUENCH_WOOD_MAX_TEMP_C,
  FIRE_QUENCH_OIL_MAX_TEMP_C,
  FIRE_QUENCH_DEFAULT_MAX_TEMP_C,
  FIRE_COLD_NEIGHBOR_TEMP_C,
  FIRE_COLD_NEIGHBOR_THRESHOLD,
  FIRE_NO_FUEL_BURNOUT_ACCEL,
  DUST_FLASH_DENSITY_THRESHOLD,
  DUST_FLASH_PROB,
  DUST_FLASH_IMPULSE_CENTER,
  DUST_FLASH_IMPULSE_NEIGHBOR,
} from "../../constants";

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

  // Use preset ids to avoid repeated name lookups
  const DUST_ID = DUST;

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const id = R[i];
      // Ember falling and quenching
      if (id === EMBER) {
        const below = i + w;
        // water nearby -> ash conversion
        const nEm = [i - 1, i + 1, i - w, i + w];
        let nearWater = false;
        for (const j of nEm) if (R[j] === WATER) nearWater = true;
        if (nearWater && canWrite(i)) {
          W[i] = ASH;
          T[i] = Math.min(T[i], EMBER_ASH_COOL_TEMP_C);
          continue;
        }
        // ignite dust on contact occasionally
        if (
          typeof DUST_ID === "number" &&
          R[below] === DUST_ID &&
          canWrite(below)
        ) {
          if (rand() < EMBER_IGNITE_DUST_CHANCE) {
            W[below] = FIRE;
            VX[below] = 0 as any;
            T[below] = Math.max(T[below], 300);
            engine.markDirty(x, y + 1);
            // small chance ember crumbles after igniting
            if (rand() < EMBER_CRUMBLE_AFTER_IGNITING_CHANCE && canWrite(i)) {
              W[i] = ASH;
              continue;
            }
          }
        }
        // crumble to ash occasionally during free fall
        if (
          (R[below] === 0 || registry[R[below]]?.category === "gas") &&
          rand() < EMBER_FREE_FALL_CRUMBLE_CHANCE &&
          canWrite(i)
        ) {
          W[i] = ASH;
          continue;
        }
        // fall if unsupported
        if (
          (R[below] === 0 || registry[R[below]]?.category === "gas") &&
          (W[below] === 0 || registry[W[below]]?.category === "gas") &&
          canWrite(i) &&
          canWrite(below)
        ) {
          W[i] = 0;
          W[below] = EMBER;
          engine.markDirty(x, y);
          engine.markDirty(x, y + 1);
          continue;
        }
        // occasional diagonal slip
        const dl = below - 1;
        const dr = below + 1;
        if (
          R[dl] === 0 &&
          R[i - 1] === 0 &&
          (W[dl] === 0 || registry[W[dl]]?.category === "gas") &&
          canWrite(i) &&
          canWrite(dl) &&
          rand() < 0.4
        ) {
          W[i] = 0;
          W[dl] = EMBER;
          engine.markDirty(x, y);
          engine.markDirty(x - 1, y + 1);
          continue;
        }
        if (
          R[dr] === 0 &&
          R[i + 1] === 0 &&
          (W[dr] === 0 || registry[W[dr]]?.category === "gas") &&
          canWrite(i) &&
          canWrite(dr) &&
          rand() < 0.4
        ) {
          W[i] = 0;
          W[dr] = EMBER;
          engine.markDirty(x, y);
          engine.markDirty(x + 1, y + 1);
          continue;
        }
        continue;
      }
      if (id !== FIRE) continue;

      // base heat at fire cell
      T[i] = Math.max(T[i], FIRE_INIT_TEMP_C);

      const n = [i - 1, i + 1, i - w, i + w];

      // Quenching by water/foam
      let extinguished = false;
      for (const j of n) {
        const nid = R[j];
        if (nid === WATER) {
          // Extinguish: steam on the water cell; convert fire cell depending on fuel origin
          if (canWrite(j)) W[j] = STEAM;
          const origin = VX[i] | 0;
          if (canWrite(i)) {
            if (origin === 2) {
              // Wood-origin fire quenches into an ember
              W[i] = EMBER;
              T[i] = Math.min(T[i], FIRE_QUENCH_WOOD_MAX_TEMP_C);
            } else if (origin === 1) {
              W[i] = SMOKE;
              T[i] = Math.min(T[i], FIRE_QUENCH_OIL_MAX_TEMP_C);
            } else {
              // Default: quenched flames dissipate to smoke
              W[i] = SMOKE;
              T[i] = Math.min(T[i], FIRE_QUENCH_DEFAULT_MAX_TEMP_C);
            }
          }
          extinguished = true;
          break;
        }
        if (nid === FOAM && canWrite(i)) {
          // Deterministic suppression if any foam neighbor and temperature not extreme
          if (T[i] < FOAM_SUPPRESS_MAX_TEMP_C) {
            W[i] = FOAM; // smothered into foam mass (stable)
            extinguished = true;
            break;
          } else {
            // at very high temp, allow small chance to persist
            if (rand() < FOAM_SUPPRESS_PERSIST_CHANCE_AT_HIGH_TEMP) {
              W[i] = FOAM;
              extinguished = true;
              break;
            }
          }
        }
      }
      if (extinguished) continue;

      // Heat neighbors and attempt ignition; consume fuel mass gradually
      for (const j of n) {
        const mid = R[j];
        const mat = registry[mid];
        if (!mat) continue;
        T[j] = Math.max(T[j], T[i] - FIRE_NEIGHBOR_HEAT_DROP_C);
        if (mat.flammable) {
          // Foam suppression halo: reduce ignition probability around foam
          let halo = 0;
          for (const k of [j - 1, j + 1, j - w, j + w]) {
            if (R[k] === FOAM) halo++;
          }
          const suppression = Math.min(
            FOAM_HALO_MAX_SUPPRESSION,
            halo * FOAM_HALO_SUPPRESSION_PER_NEIGHBOR
          );
          const humidityFactor =
            1 -
            Math.min(
              HUMIDITY_IGNITION_REDUCTION_SCALE,
              ((HUM[j] || 0) / 255) * HUMIDITY_IGNITION_REDUCTION_SCALE
            );
          // Deterministic ignition when far above threshold; probabilistic near threshold
          const threshold = mat.combustionTemp ?? 300;
          if (
            T[j] >= threshold + IGNITION_DETERMINISTIC_MARGIN_C &&
            canWrite(j)
          ) {
            W[j] = FIRE;
            continue;
          }
          const base =
            BASE_IGNITION_CHANCE * (1 - suppression) * humidityFactor;
          const tempBoost = Math.min(
            TEMP_IGNITION_BOOST_CAP,
            Math.max(0, (T[j] - threshold) / TEMP_IGNITION_BOOST_DIVISOR)
          );
          let chance = base + tempBoost;
          // Oil synergy: easier propagation along contiguous oil cells
          if (mid === OIL) {
            const oilNeighbors = [j - 1, j + 1, j - w, j + w].filter(
              (k) => R[k] === OIL
            ).length;
            chance += Math.min(
              OIL_NEIGHBOR_IGNITION_BONUS_CAP,
              oilNeighbors * OIL_NEIGHBOR_IGNITION_BONUS_PER
            );
          }
          if (rand() < chance && canWrite(j)) {
            // mark origin fuel type in VX for burnout byproducts
            const origin = mid === OIL ? 1 : mid === WOOD ? 2 : 0;
            W[j] = FIRE;
            VX[j] = origin as any;
            // consume a small amount of neighbor fuel by converting a fraction to smoke/ash seeds
            // probabilistically spawn smoke at adjacent empty cells (visual byproduct of burning)
            const around = [j - 1, j + 1, j - w, j + w];
            for (const k of around) {
              if (R[k] === 0 && canWrite(k) && rand() < 0.1) W[k] = SMOKE;
            }
          }
        }
      }

      // Wood-origin fires emit more smoke while burning (visual realism)
      if ((VX[i] | 0) === 2) {
        const around = [i - 1, i + 1, i - w, i + w];
        for (const k of around) {
          if (R[k] === 0 && canWrite(k) && rand() < FIRE_WOOD_SMOKE_EMIT_PROB) {
            W[k] = SMOKE;
          }
        }
      }

      // Lifetime and burnout → smoke/ember (fuel-aware deterministic duration)
      let life = AUX[i];
      // Longer for wood, shorter for oil
      if (!life) {
        const origin = VX[i] | 0;
        // Infer origin from immediate neighbors if unknown
        if (origin === 0) {
          const neigh = [i - 1, i + 1, i - w, i + w];
          let inferred: 0 | 1 | 2 = 0;
          for (const j of neigh) {
            const m = registry[R[j]];
            if (m?.name === "Wood") {
              inferred = 2;
              break;
            }
            if (m?.name === "Oil") inferred = inferred === 2 ? 2 : 1;
          }
          if (inferred !== 0) VX[i] = inferred as any;
        }
        const base =
          (VX[i] | 0) === 2
            ? FIRE_BASE_LIFE_WOOD_FRAMES
            : (VX[i] | 0) === 1
            ? FIRE_BASE_LIFE_OIL_FRAMES
            : FIRE_BASE_LIFE_DEFAULT_FRAMES; // frames at 60Hz
        life = (base * Math.max(1, Math.round(engine.dt * 60))) as any;
      }
      life--;
      AUX[i] = life as any;
      if (life <= 0 && canWrite(i)) {
        // Fuel-aware burnout using stored origin code in VX
        const origin = VX[i] | 0;
        if (origin === 1) {
          W[i] = SMOKE;
          T[i] = Math.max(
            SMOKE_TEMP_CLAMP_MIN_C,
            Math.min(T[i], SMOKE_TEMP_CLAMP_MAX_C)
          );
        } else if (origin === 2) {
          // wood produces ember, but sometimes leaves a touch of ash
          W[i] = EMBER;
          T[i] = Math.min(T[i], 260);
          // chance to spawn ash in a neighbor empty cell
          if (ASH) {
            const k = [i - 1, i + 1, i - w, i + w][(rand() * 4) | 0];
            if (W[k] === 0 && canWrite(k) && rand() < 0.3) W[k] = ASH as any;
          }
        } else {
          // default burnout: prefer ember on unknown origin to avoid misclassifying wood as smoke
          W[i] = EMBER;
          T[i] = Math.min(T[i], 260);
        }
      }
      // If surrounded by cold non-flammable materials, shorten lifetime slightly
      const neigh = [i - 1, i + 1, i - w, i + w];
      let coldNeighbors = 0;
      for (const j of neigh)
        if (T[j] < FIRE_COLD_NEIGHBOR_TEMP_C && !registry[R[j]]?.flammable)
          coldNeighbors++;
      if (coldNeighbors >= FIRE_COLD_NEIGHBOR_THRESHOLD && AUX[i] > 0)
        AUX[i] = (AUX[i] - 1) as any;

      // If no nearby fuel, accelerate burnout so fire quickly smokes out
      let hasFuelNeighbor = false;
      for (const j of neigh) {
        if (registry[R[j]]?.flammable) {
          hasFuelNeighbor = true;
          break;
        }
      }
      const origin = VX[i] | 0;
      if (origin !== 2 && !hasFuelNeighbor && AUX[i] > 0) {
        AUX[i] = Math.max(
          0,
          (AUX[i] as any) - FIRE_NO_FUEL_BURNOUT_ACCEL
        ) as any;
      }

      // Dust flash hazard: if nearby density of dust is high, flash to smoke/ash with a small impulse bump
      if (DUST_ID) {
        let dustCount = 0;
        for (const j of n) if (R[j] === DUST_ID) dustCount++;
        if (
          dustCount >= DUST_FLASH_DENSITY_THRESHOLD &&
          rand() < DUST_FLASH_PROB
        ) {
          for (const j of n) if (R[j] === DUST_ID) W[j] = SMOKE;
          // small local impulse bump
          const { w: Ww } = engine.grid;
          IMP[i] = Math.max(IMP[i], DUST_FLASH_IMPULSE_CENTER);
          IMP[i - 1] = Math.max(IMP[i - 1], DUST_FLASH_IMPULSE_NEIGHBOR);
          IMP[i + 1] = Math.max(IMP[i + 1], DUST_FLASH_IMPULSE_NEIGHBOR);
          IMP[i - Ww] = Math.max(IMP[i - Ww], DUST_FLASH_IMPULSE_NEIGHBOR);
          IMP[i + Ww] = Math.max(IMP[i + Ww], DUST_FLASH_IMPULSE_NEIGHBOR);
        }
      }
    }
  }
}
