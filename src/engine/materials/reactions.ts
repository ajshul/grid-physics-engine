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
  const dt = engine.dt; // fixed step seconds
  // Latent heat budget for melting/freezing (scaled-to-sim units per cell mass)
  // Realistic L_f ~334 kJ/kg; our units are relative. Tune for visual pacing.
  const LATENT_FUSION = 4000; // energy units required to change phase (fusion)
  const MAX_LATENT_STEP = 20 * (dt * 60); // per-step cap in energy units

  // --- Pairwise conduction (antisymmetric heat exchange) ---
  // We exchange heat between right and down neighbors only to avoid double-processing.
  // Energy flow Q = (Tj - Ti) * k_eff * dt
  // Temperature updates: dTi = Q / mass_i, dTj = -Q / mass_j
  const getConductivity = (id: number): number => {
    const m = registry[id];
    if (!m) return 0.1; // empty cell behaves like air
    if (typeof m.conductivity === "number") return clamp01(m.conductivity);
    switch (m.category) {
      case "gas":
        return 0.03;
      case "liquid":
        return 0.15;
      case "powder":
        return 0.12;
      case "solid":
        return 0.2;
      default:
        return 0.1;
    }
  };
  const getHeatCapacity = (id: number): number => {
    const m = registry[id];
    if (!m) return 1.0;
    if (typeof m.heatCapacity === "number") return m.heatCapacity;
    switch (m.category) {
      case "liquid":
        return 4.0;
      case "solid":
        return 0.9;
      case "powder":
        return 0.6;
      case "gas":
        return 1.0;
      default:
        return 1.0;
    }
  };
  const getDensity = (id: number): number => {
    const m = registry[id];
    const d = m?.density ?? 5.0;
    return Math.abs(d);
  };
  // base coupling scale controls speed of conduction in our unit system
  const CONDUCTION_SCALE = 0.35; // tuned empirically, per second
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const right = i + 1;
      const down = i + w;
      // i <-> right
      {
        const k1 = getConductivity(M[i]);
        const k2 = getConductivity(M[right]);
        const kEff = (k1 + k2) * 0.5 * CONDUCTION_SCALE * dt;
        if (kEff > 0) {
          const mass1 = Math.max(0.2, getHeatCapacity(M[i]) * getDensity(M[i]));
          const mass2 = Math.max(
            0.2,
            getHeatCapacity(M[right]) * getDensity(M[right])
          );
          const dT = T[right] - T[i];
          const Q = dT * kEff; // energy units
          // Apply symmetric update
          T[i] += Q / mass1;
          T[right] -= Q / mass2;
        }
      }
      // i <-> down
      {
        const k1 = getConductivity(M[i]);
        const k2 = getConductivity(M[down]);
        const kEff = (k1 + k2) * 0.5 * CONDUCTION_SCALE * dt;
        if (kEff > 0) {
          const mass1 = Math.max(0.2, getHeatCapacity(M[i]) * getDensity(M[i]));
          const mass2 = Math.max(
            0.2,
            getHeatCapacity(M[down]) * getDensity(M[down])
          );
          const dT = T[down] - T[i];
          const Q = dT * kEff;
          T[i] += Q / mass1;
          T[down] -= Q / mass2;
        }
      }
    }
  }

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const id = M[i];
      const m = registry[id];

      // --- Ambient + radiative cooling for all cells (additive) ---
      const n = [i - 1, i + 1, i - w, i + w];
      const category = m?.category;
      const cpDefault = getHeatCapacity(id);
      const density = getDensity(id);
      const mass = Math.max(0.2, cpDefault * density);
      const coolantBoostName = m?.name;
      const coolantBoost =
        coolantBoostName === "Water"
          ? 0.02
          : coolantBoostName === "Ice"
          ? 0.035
          : coolantBoostName === "Foam"
          ? 0.01
          : 0;
      let baseCoolingPerSec =
        category === "solid" ? 0.5 : category === "liquid" ? 0.7 : 0.5; // gases cool moderately
      // treat empty cells (air) as highly coupled to ambient to avoid heat lock-in
      if (id === 0) baseCoolingPerSec = 5.0;
      // keep steam hot a bit longer to allow visible rise before condensing
      if (m?.name === "Steam") baseCoolingPerSec = 0.05;
      const highTemp = Math.max(0, T[i] - 150) / 600; // radiative tail
      let coolingPerSec = baseCoolingPerSec + highTemp * 0.4 + coolantBoost;
      // convert to per-step coefficient, scale by mass
      const ambientDelta = ((AMBIENT - T[i]) * (coolingPerSec * dt)) / mass;
      T[i] += ambientDelta;

      // Note: Additional neighbor-cooling hacks removed; rely on conduction.

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

      // --- Water boiling (dt- and mass-scaled; pressure raises BP) ---
      if (id === WATER) {
        const baseBp = registry[WATER]?.boilingPoint ?? 100;
        const p = P[i] | 0;
        // gentle monotonic elevation with sqrt curve
        const bpAdj = baseBp + Math.min(80, Math.sqrt(Math.max(0, p)) * 0.8);
        const overheat = Math.max(0, T[i] - bpAdj);
        const cpWater = getHeatCapacity(WATER);
        const massWater = Math.max(0.2, cpWater * getDensity(WATER));
        const BOIL_THRESHOLD = 6000; // energy units to accumulate before phase change
        if (overheat > 0) {
          // accumulate energy towards vaporization, scaled by dt and mass
          const add = (overheat * cpWater * (dt * 10)) | 0;
          const prog = Math.min(65535, (AUX[i] | 0) + Math.max(1, add));
          AUX[i] = prog;
          if (prog >= BOIL_THRESHOLD) {
            M[i] = STEAM;
            // consume progress; leftover energy increases steam temperature slightly
            const leftover = prog - BOIL_THRESHOLD;
            AUX[i] = 0;
            if (leftover > 0)
              T[i] = Math.max(T[i], bpAdj + leftover / massWater);
          }
        } else {
          // below bp → lose progress gradually
          const dec = Math.max(1, (10 * dt) | 0);
          if (AUX[i] > 0) AUX[i] = Math.max(0, (AUX[i] | 0) - dec) as any;
        }
      }

      // --- Steam condensation ---
      if (id === STEAM) {
        const condenseTemp = 90;
        // add an age delay using AUX so fresh steam rises before condensing
        const age = (AUX[i] | 0) + 1;
        AUX[i] = Math.min(65535, age) as any;
        if (T[i] < condenseTemp && age > 80) M[i] = WATER;
        // near cool surfaces condense faster
        let nearCool = false;
        for (const j of n) {
          const mj = registry[M[j]];
          if (!mj) continue;
          if (mj.name === "Ice" || (mj.category === "solid" && T[j] < 30))
            nearCool = true;
        }
        if (nearCool && T[i] < 90 && age > 40) M[i] = WATER;
      }

      // --- Combustion/ignition ---
      if (m?.flammable && T[i] >= (m.combustionTemp ?? 300)) {
        M[i] = FIRE;
      }
      if (id === OIL && T[i] >= 250) {
        M[i] = FIRE;
      }

      // (Fire lifetime handled in energy pass deterministically)

      // --- Lava behavior: hot, slowly cools to stone without external input ---
      if (id === LAVA) {
        // ensure lava remains quite hot initially, but cools gradually via ambient
        const cp = getHeatCapacity(LAVA);
        const massLava = Math.max(0.2, cp * getDensity(LAVA));
        const coolPerSec = 0.3; // slower cooling than water/air
        const dT = ((AMBIENT - T[i]) * (coolPerSec * dt)) / massLava;
        T[i] += dT;
        if (T[i] < 220) {
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
      if (id === FIRE && T[i] < 300) {
        M[i] = EMBER;
      }
      if (id === EMBER) {
        // deterministic ember lifetime using AUX as counter
        const life = AUX[i] | 0 || 500;
        AUX[i] = (life - 1) as any;
        T[i] = Math.max(T[i], 160);
        for (const j of n) T[j] = Math.max(T[j], T[i] - 8);
        if (T[i] > 340) M[i] = FIRE;
        if ((AUX[i] | 0) <= 0) {
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
