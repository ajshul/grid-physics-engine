import type { Engine } from "../engine";
import type { GridView } from "../grid";
import { registry } from "./index";
import {
  FIRE,
  ICE,
  STEAM,
  WATER,
  OIL,
  LAVA,
  RUBBER,
  GLASS,
  MUD,
  EMBER,
  SAND,
} from "./presets";

export function applyThermal(engine: Engine, write: GridView) {
  const { w, h } = engine.grid;
  const T = write.temp;
  const M = write.mat;
  const HUM = write.humidity;
  const P = write.pressure;
  const PH = write.phase; // latent heat accumulator (fusion)
  const AUX = write.aux; // used for slow boiling

  // constants (tunable)
  const AMBIENT = 20;
  // Latent heat budget for melting/freezing (scaled for simulation time step)
  // Realistic L_f ~334 kJ/kg, but we upscale to slow visual melting.
  const LATENT_FUSION = 4000; // effective units
  const MAX_LATENT_STEP = 20; // cap per-tick latent energy transfer (effective units)

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const id = M[i];
      const m = registry[id];

      // --- Thermal diffusion (include air) ---
      const n = [i - 1, i + 1, i - w, i + w];
      let avg = T[i];
      for (const j of n) avg += T[j];
      avg /= 5;
      const category = m?.category;
      const k = clamp01(
        m?.conductivity ??
          (id === 0 || category === "gas"
            ? 0.05
            : category === "liquid"
            ? 0.15
            : category === "powder"
            ? 0.12
            : 0.2)
      );
      const cpDefault =
        m?.heatCapacity ??
        (category === "liquid"
          ? 4.0
          : category === "solid"
          ? 0.9
          : category === "powder"
          ? 0.6
          : category === "gas"
          ? 1.0
          : 1.0);
      const density = m?.density ?? 5.0;
      const massFactor = Math.min(6, Math.max(0.5, (cpDefault * density) / 5));
      const conductionRate = (k * 0.35) / massFactor;
      T[i] += (avg - T[i]) * conductionRate;

      // --- Ambient + radiative cooling for all cells ---
      const coolantBoostName = m?.name;
      const coolantBoost =
        coolantBoostName === "Water"
          ? 0.02
          : coolantBoostName === "Ice"
          ? 0.035
          : coolantBoostName === "Foam"
          ? 0.01
          : 0;
      const baseCooling =
        category === "solid" ? 0.992 : category === "liquid" ? 0.988 : 0.98; // gases/air cool fastest
      const highTemp = Math.max(0, T[i] - 150) / 600; // 0..~1
      let cooling = baseCooling - coolantBoost - highTemp * 0.02;
      if (cooling < 0.9) cooling = 0.9;
      // Convert multiplicative cooling to additive update and scale by mass
      const ambientRate = (1 - cooling) / massFactor;
      T[i] += (AMBIENT - T[i]) * ambientRate;

      // --- Phase changes: latent fusion (Ice <-> Water) ---
      if (id === ICE || id === WATER) {
        const cpIce = registry[ICE]?.heatCapacity ?? 2.1;
        const cpWater = registry[WATER]?.heatCapacity ?? 4.2;
        const mp = registry[ICE]?.meltingPoint ?? 0;
        if (id === ICE) {
          // absorb melt energy at 0 C
          if (T[i] > mp) {
            const excessDeg = T[i] - mp;
            const deltaE = excessDeg * cpIce;
            PH[i] += Math.min(MAX_LATENT_STEP, deltaE);
            T[i] = mp;
          }
          if (PH[i] >= LATENT_FUSION) {
            const leftover = PH[i] - LATENT_FUSION;
            M[i] = WATER;
            PH[i] = 0;
            // leftover energy raises water temperature above mp
            if (leftover > 0) T[i] = mp + leftover / cpWater;
          }
        } else if (id === WATER) {
          const fp = registry[WATER]?.freezingPoint ?? 0;
          if (T[i] < fp) {
            const deficitDeg = fp - T[i];
            const deltaE = deficitDeg * cpWater;
            PH[i] -= Math.min(MAX_LATENT_STEP, deltaE);
            T[i] = fp;
          }
          if (PH[i] <= -LATENT_FUSION) {
            const leftover = -LATENT_FUSION - PH[i];
            M[i] = ICE;
            PH[i] = 0;
            if (leftover > 0) T[i] = fp - leftover / cpIce;
          }
        }
      }

      // --- Water boiling (slow accumulation; pressure raises BP) ---
      if (id === WATER) {
        const baseBp = registry[WATER]?.boilingPoint ?? 100;
        const p = P[i] | 0;
        const bpAdj = baseBp + Math.min(50, Math.max(0, p) * 0.05);
        if (T[i] >= bpAdj) {
          const progress = Math.min(65535, (AUX[i] | 0) + 1);
          AUX[i] = progress;
          if (progress > 200) {
            M[i] = STEAM;
            AUX[i] = 0;
          }
        } else {
          if (AUX[i] > 0) AUX[i] = (AUX[i] - 1) as any; // cools, lose boil progress
        }
        // water locally cools neighbors (never floor to ambient)
        for (const j of n) T[j] = Math.max(-100, T[j] - 0.5);
      }

      // --- Steam condensation ---
      if (id === STEAM) {
        const condenseTemp = 95;
        if (T[i] < condenseTemp) M[i] = WATER;
        // near cool surfaces condense faster
        let nearCool = false;
        for (const j of n) {
          const mj = registry[M[j]];
          if (!mj) continue;
          if (mj.name === "Ice" || (mj.category === "solid" && T[j] < 30))
            nearCool = true;
        }
        if (nearCool && T[i] < 100) M[i] = WATER;
      }

      // --- Combustion/ignition ---
      if (m?.flammable && T[i] >= (m.combustionTemp ?? 300)) {
        M[i] = FIRE;
      }
      if (id === OIL && T[i] >= 250) {
        M[i] = FIRE;
      }

      // --- Lava behavior ---
      if (id === LAVA) {
        if (T[i] < 600) T[i] = 600;
        T[i] = AMBIENT + (T[i] - AMBIENT) * 0.999;
        if (T[i] < 200) {
          const stoneId = Object.keys(registry).find(
            (k) => registry[+k]?.name === "Stone"
          );
          if (stoneId) M[i] = +stoneId;
        }
      }

      // --- Ice neighborhood cooling ---
      if (id === ICE) {
        for (const j of n) T[j] = Math.max(-100, T[j] - 1.5);
      }

      // --- Rubber pops to smoke ---
      if (id === RUBBER && T[i] >= 260) {
        const smokeId = Object.keys(registry).find(
          (k) => registry[+k]?.name === "Smoke"
        );
        if (smokeId) M[i] = +smokeId;
      }

      // --- Wood charring ---
      if (
        m?.name === "Wood" &&
        T[i] > 220 &&
        T[i] < (m.combustionTemp ?? 300)
      ) {
        if (engine.rand && engine.rand() < 0.001) {
          const ashId = Object.keys(registry).find(
            (k) => registry[+k]?.name === "Ash"
          );
          if (ashId) M[i] = +(ashId as any);
        }
      }

      // --- Foam decay ---
      if (m?.name === "Foam") {
        if (engine.rand && engine.rand() < 0.0005) {
          M[i] = WATER;
          for (const j of n) {
            if (M[j] === 0) {
              const smokeId = Object.keys(registry).find(
                (k) => registry[+k]?.name === "Smoke"
              );
              M[j] = T[i] > 80 ? STEAM : smokeId ? +(smokeId as any) : 0;
              break;
            }
          }
        }
      }

      // --- Humidity decay ---
      if (HUM[i] > 0) HUM[i] = (HUM[i] - 1) as any;

      // --- Water + Dust -> Mud ---
      if (m?.name === "Dust") {
        for (const j of n) {
          if (M[j] === WATER) {
            if (engine.rand && engine.rand() < 0.1) {
              M[i] = MUD;
              HUM[i] = 200 as any;
              break;
            }
          }
        }
      }

      // --- Mud dries to Sand ---
      if (id === MUD) {
        const nearWater = n.some((j) => M[j] === WATER);
        if (!nearWater && HUM[i] < 40 && engine.rand && engine.rand() < 0.02) {
          M[i] = SAND;
        }
      }

      // --- Vitrification ---
      if (m?.name === "Sand" && T[i] > 900) {
        if (engine.rand && engine.rand() < 0.002) {
          M[i] = GLASS;
        }
      }

      // --- Ember lifecycle ---
      if (id === FIRE && T[i] < 260) {
        M[i] = EMBER;
      }
      if (id === EMBER) {
        T[i] = Math.max(T[i], 180);
        for (const j of n) T[j] = Math.max(T[j], T[i] - 10);
        if (T[i] > 300) M[i] = FIRE;
        if (engine.rand && engine.rand() < 0.01) {
          const ashId = Object.keys(registry).find(
            (k) => registry[+k]?.name === "Ash"
          );
          if (ashId) M[i] = +(ashId as any);
        }
      }
    }
  }
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
