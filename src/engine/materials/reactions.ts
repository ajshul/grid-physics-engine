import type { Engine } from "../engine";
import type { GridView } from "../grid";
import { registry } from "./index";
import { conductivityById, heatCapacityById, densityById } from "./cache";
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
import {
  AMBIENT_TEMPERATURE_C,
  CONDUCTION_SCALE_PER_SEC,
  LATENT_FUSION_ENERGY,
  MAX_LATENT_STEP_AT_60HZ,
  LAVA_COOLING_PER_SEC,
  LAVA_SOLIDIFY_ENERGY,
  LAVA_SOLIDIFY_TEMP_C,
  CONDUCTIVITY_DEFAULT_EMPTY,
  HEAT_CAPACITY_DEFAULT_EMPTY,
  MIN_EFFECTIVE_MASS,
  BASE_COOLING_GAS_PER_SEC,
  BASE_COOLING_LIQUID_PER_SEC,
  BASE_COOLING_SOLID_PER_SEC,
  EMPTY_COUPLING_PER_SEC,
  STEAM_BASE_COOLING_PER_SEC,
  COOLANT_BOOST_FOAM,
  COOLANT_BOOST_ICE,
  COOLANT_BOOST_WATER,
  RADIATIVE_COOLING_SCALE,
  RADIATIVE_TEMP_DIVISOR,
  RADIATIVE_TEMP_START_C,
  WATER_BP_PRESSURE_CAP_C,
  WATER_BP_PRESSURE_COEFF_SQRT,
  WATER_BOIL_THRESHOLD_ENERGY,
  WATER_BOIL_ACCUM_MULT_AT_60HZ,
  WATER_BOIL_PROGRESS_DECAY_PER_SEC,
  STEAM_CONDENSE_TEMP_C,
  STEAM_CONDENSE_AGE_MIN,
  STEAM_CONDENSE_NEAR_COOL_AGE_MIN,
  NEAR_LAVA_IGNITION_ADD_PER_60HZ,
  NEAR_LAVA_IGNITION_BUDGET,
  OIL_AUTO_IGNITE_TEMP_C,
  LAVA_NEIGHBOR_HEAT_FACTOR,
  LAVA_NEIGHBOR_HEAT_MAX_ADD_C,
  LAVA_NEARBY_PREHEAT_BASE_BOOST_C,
  LAVA_NEARBY_PREHEAT_MAX_ADD_C,
  LAVA_NEARBY_PREHEAT_AMBIENT_DIFF_COEFF,
  LAVA_SOLIDIFY_ACCUM_SCALE,
  ICE_NEIGHBOR_COOL_DELTA_C,
  ICE_NEIGHBOR_COOL_CLAMP_MIN_C,
  RUBBER_POP_TEMP_C,
  WOOD_CHARRING_MIN_TEMP_C,
  WOOD_CHARRING_MAX_TEMP_C,
  WOOD_CHARRING_PROB_PER_STEP,
  FOAM_DECAY_PROB_PER_STEP,
  HUMIDITY_DECAY_PER_STEP,
  DUST_TO_MUD_PROB_PER_STEP,
  MUD_INITIAL_HUMIDITY,
  MUD_DRY_HUMIDITY_THRESHOLD,
  MUD_DRY_PROB_PER_STEP,
  SAND_VITRIFY_TEMP_C,
  SAND_VITRIFY_PROB_PER_STEP,
  SMOKE_TEMP_CLAMP_MIN_C,
  SMOKE_TEMP_CLAMP_MAX_C,
  EMBER_INITIAL_LIFE_STEPS,
  EMBER_COOL_DECAY_PER_STEP,
  EMBER_MIN_TEMP_C,
  EMBER_NEIGHBOR_WARM_DELTA_C,
  EMBER_REIGNITE_TEMP_C,
  EMBER_ASH_COOL_TEMP_C,
} from "../constants";
import { getMaterialIdByName } from "../utils";

export function applyThermal(engine: Engine, write: GridView) {
  const { w, h } = engine.grid;
  const T = write.temp;
  const M = write.mat;
  const HUM = write.humidity;
  const P = write.pressure;
  const PH = write.phase; // latent heat accumulator (fusion)
  const AUX = write.aux; // used for slow boiling
  const VX = write.velX; // reused to tag fire origin (0=unknown,1=oil,2=wood)

  // constants (tunable)
  const AMBIENT = AMBIENT_TEMPERATURE_C;
  const dt = engine.dt; // fixed step seconds
  // Latent heat budget for melting/freezing (scaled-to-sim units per cell mass)
  // Realistic L_f ~334 kJ/kg; our units are relative. Tune for visual pacing.
  const LATENT_FUSION = LATENT_FUSION_ENERGY; // energy units required to change phase (fusion)
  const MAX_LATENT_STEP = MAX_LATENT_STEP_AT_60HZ * (dt * 60); // per-step cap in energy units

  // --- Pairwise conduction (antisymmetric heat exchange) ---
  // We exchange heat between right and down neighbors only to avoid double-processing.
  // Energy flow Q = (Tj - Ti) * k_eff * dt
  // Temperature updates: dTi = Q / mass_i, dTj = -Q / mass_j
  const getConductivity = (id: number): number =>
    conductivityById[id] ?? CONDUCTIVITY_DEFAULT_EMPTY;
  const getHeatCapacity = (id: number): number =>
    heatCapacityById[id] ?? HEAT_CAPACITY_DEFAULT_EMPTY;
  const getDensity = (id: number): number => densityById[id] ?? 5.0;
  // base coupling scale controls speed of conduction in our unit system
  const CONDUCTION_SCALE = CONDUCTION_SCALE_PER_SEC; // tuned empirically, per second
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
          const mass1 = Math.max(
            MIN_EFFECTIVE_MASS,
            getHeatCapacity(M[i]) * getDensity(M[i])
          );
          const mass2 = Math.max(
            MIN_EFFECTIVE_MASS,
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
          const mass1 = Math.max(
            MIN_EFFECTIVE_MASS,
            getHeatCapacity(M[i]) * getDensity(M[i])
          );
          const mass2 = Math.max(
            MIN_EFFECTIVE_MASS,
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
      // Preheat from nearby lava to promote ignition before combustion check
      // This runs before ambient cooling and combustion to ensure timely ignition
      {
        let nearLava = false;
        for (const j of n) if (M[j] === LAVA) nearLava = true;
        if (nearLava) {
          const baseBoost = LAVA_NEARBY_PREHEAT_BASE_BOOST_C; // base radiant boost
          const tempHere = T[i];
          // apply a capped increase to simulate intense local heating
          const add = Math.min(
            LAVA_NEARBY_PREHEAT_MAX_ADD_C,
            Math.max(
              0,
              baseBoost +
                (AMBIENT - tempHere) * LAVA_NEARBY_PREHEAT_AMBIENT_DIFF_COEFF
            )
          );
          if (add > 0) T[i] += add;
        }
      }
      const category = m?.category;
      const cpDefault = getHeatCapacity(id);
      const density = getDensity(id);
      const mass = Math.max(MIN_EFFECTIVE_MASS, cpDefault * density);
      const coolantBoostName = m?.name;
      const coolantBoost =
        coolantBoostName === "Water"
          ? COOLANT_BOOST_WATER
          : coolantBoostName === "Ice"
          ? COOLANT_BOOST_ICE
          : coolantBoostName === "Foam"
          ? COOLANT_BOOST_FOAM
          : 0;
      let baseCoolingPerSec =
        category === "solid"
          ? BASE_COOLING_SOLID_PER_SEC
          : category === "liquid"
          ? BASE_COOLING_LIQUID_PER_SEC
          : BASE_COOLING_GAS_PER_SEC; // gases cool moderately
      // treat empty cells (air) as highly coupled to ambient to avoid heat lock-in
      if (id === 0) baseCoolingPerSec = EMPTY_COUPLING_PER_SEC;
      // keep steam hot a bit longer to allow visible rise before condensing
      if (m?.name === "Steam") baseCoolingPerSec = STEAM_BASE_COOLING_PER_SEC;
      const highTemp =
        Math.max(0, T[i] - RADIATIVE_TEMP_START_C) / RADIATIVE_TEMP_DIVISOR; // radiative tail
      let coolingPerSec =
        baseCoolingPerSec + highTemp * RADIATIVE_COOLING_SCALE + coolantBoost;
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
        const bpAdj =
          baseBp +
          Math.min(
            WATER_BP_PRESSURE_CAP_C,
            Math.sqrt(Math.max(0, p)) * WATER_BP_PRESSURE_COEFF_SQRT
          );
        const overheat = Math.max(0, T[i] - bpAdj);
        const cpWater = getHeatCapacity(WATER);
        const massWater = Math.max(
          MIN_EFFECTIVE_MASS,
          cpWater * getDensity(WATER)
        );
        const BOIL_THRESHOLD = WATER_BOIL_THRESHOLD_ENERGY; // energy units to accumulate before phase change
        if (overheat > 0) {
          // accumulate energy towards vaporization, scaled by dt and mass
          const add =
            (overheat * cpWater * (dt * WATER_BOIL_ACCUM_MULT_AT_60HZ)) | 0;
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
          const dec = Math.max(1, (WATER_BOIL_PROGRESS_DECAY_PER_SEC * dt) | 0);
          if (AUX[i] > 0) AUX[i] = Math.max(0, (AUX[i] | 0) - dec) as any;
        }
      }

      // --- Steam condensation ---
      if (id === STEAM) {
        const condenseTemp = STEAM_CONDENSE_TEMP_C;
        // add an age delay using AUX so fresh steam rises before condensing
        const age = (AUX[i] | 0) + 1;
        AUX[i] = Math.min(65535, age) as any;
        if (T[i] < condenseTemp && age > STEAM_CONDENSE_AGE_MIN) M[i] = WATER;
        // near cool surfaces condense faster
        let nearCool = false;
        for (const j of n) {
          const mj = registry[M[j]];
          if (!mj) continue;
          if (mj.name === "Ice" || (mj.category === "solid" && T[j] < 30))
            nearCool = true;
        }
        if (
          nearCool &&
          T[i] < STEAM_CONDENSE_TEMP_C &&
          age > STEAM_CONDENSE_NEAR_COOL_AGE_MIN
        )
          M[i] = WATER;
      }

      // --- Combustion/ignition ---
      if (m?.flammable) {
        // temperature-gated ignition
        if (T[i] >= (m.combustionTemp ?? 300)) {
          M[i] = FIRE;
          VX[i] =
            m.name === "Oil"
              ? (1 as any)
              : m.name === "Wood"
              ? (2 as any)
              : (0 as any);
        }
        // deterministic near-lava contact ignition budget (accumulates over frames)
        const neigh = [i - 1, i + 1, i - w, i + w];
        let nearLava = false;
        for (const j of neigh) if (M[j] === LAVA) nearLava = true;
        const add = nearLava
          ? Math.max(1, (NEAR_LAVA_IGNITION_ADD_PER_60HZ * dt * 60) | 0)
          : -1;
        const budget = Math.max(0, (AUX[i] | 0) + add);
        AUX[i] = Math.min(65535, budget) as any;
        if (budget >= NEAR_LAVA_IGNITION_BUDGET) {
          M[i] = FIRE;
          VX[i] =
            m.name === "Oil"
              ? (1 as any)
              : m.name === "Wood"
              ? (2 as any)
              : (0 as any);
          AUX[i] = 0 as any;
        }
      }
      if (id === OIL && T[i] >= OIL_AUTO_IGNITE_TEMP_C) {
        M[i] = FIRE;
        VX[i] = 1 as any;
      }
      // (Ignition easing handled above with deterministic budget + temperature gating)
      // Lava promotes ignition nearby via strong heating; direct contact already heated above may switch earlier

      // (Fire lifetime handled in energy pass deterministically)

      // --- Lava behavior: hot, slowly cools to stone without external input ---
      if (id === LAVA) {
        // cool toward ambient at a gentle rate (configurable), mass-aware
        const cp = getHeatCapacity(LAVA);
        const massLava = Math.max(MIN_EFFECTIVE_MASS, cp * getDensity(LAVA));
        const dT = ((AMBIENT - T[i]) * (LAVA_COOLING_PER_SEC * dt)) / massLava;
        T[i] += dT;
        // radiant/conductive heating of immediate neighbors to promote ignition of flammables
        const neigh = [i - 1, i + 1, i - w, i + w];
        for (const j of neigh) {
          // boost neighbor temperature based on lava heat, capped
          const targetBoost = Math.max(
            0,
            Math.min(
              LAVA_NEIGHBOR_HEAT_MAX_ADD_C,
              (T[i] - T[j]) * LAVA_NEIGHBOR_HEAT_FACTOR
            )
          );
          T[j] += targetBoost;
        }
        // accumulate a latent-like budget while lava is below a threshold
        if (T[i] <= LAVA_SOLIDIFY_TEMP_C) {
          const deficit = LAVA_SOLIDIFY_TEMP_C - T[i];
          const add = Math.max(
            1,
            (deficit * cp * (dt * LAVA_SOLIDIFY_ACCUM_SCALE)) | 0
          );
          AUX[i] = Math.min(65535, (AUX[i] | 0) + add) as any;
        }
        if ((AUX[i] | 0) >= LAVA_SOLIDIFY_ENERGY) {
          const stoneId = getMaterialIdByName("Stone");
          if (stoneId) {
            M[i] = stoneId;
            // carry a bit of residual heat into stone to avoid instant re-melt visuals
            T[i] = Math.max(T[i], AMBIENT_TEMPERATURE_C + 20);
            AUX[i] = 0 as any;
          }
        }
      }

      // --- Ice neighborhood cooling ---
      if (id === ICE) {
        // gentle local cooling; clamp to avoid driving neighbors extremely cold
        for (const j of n)
          T[j] = Math.max(
            ICE_NEIGHBOR_COOL_CLAMP_MIN_C,
            T[j] - ICE_NEIGHBOR_COOL_DELTA_C
          );
      }

      // --- Rubber pops to smoke ---
      if (id === RUBBER && T[i] >= RUBBER_POP_TEMP_C) {
        const smokeId = getMaterialIdByName("Smoke");
        if (smokeId) M[i] = smokeId;
      }

      // --- Wood charring ---
      if (
        m?.name === "Wood" &&
        T[i] > WOOD_CHARRING_MIN_TEMP_C &&
        T[i] < (m.combustionTemp ?? WOOD_CHARRING_MAX_TEMP_C)
      ) {
        if (engine.rand && engine.rand() < WOOD_CHARRING_PROB_PER_STEP) {
          const ashId = getMaterialIdByName("Ash");
          if (ashId) M[i] = ashId as any;
        }
      }

      // --- Foam decay ---
      if (m?.name === "Foam") {
        if (engine.rand && engine.rand() < FOAM_DECAY_PROB_PER_STEP) {
          M[i] = WATER;
          for (const j of n) {
            if (M[j] === 0) {
              const smokeId = getMaterialIdByName("Smoke");
              M[j] = T[i] > 80 ? STEAM : smokeId ? (smokeId as any) : 0;
              break;
            }
          }
        }
      }

      // --- Humidity decay ---
      if (HUM[i] > 0) HUM[i] = (HUM[i] - HUMIDITY_DECAY_PER_STEP) as any;

      // --- Water + Dust -> Mud ---
      if (m?.name === "Dust") {
        for (const j of n) {
          if (M[j] === WATER) {
            if (engine.rand && engine.rand() < DUST_TO_MUD_PROB_PER_STEP) {
              M[i] = MUD;
              HUM[i] = MUD_INITIAL_HUMIDITY as any;
              break;
            }
          }
        }
      }

      // --- Mud dries to Sand ---
      if (id === MUD) {
        const nearWater = n.some((j) => M[j] === WATER);
        if (
          !nearWater &&
          HUM[i] < MUD_DRY_HUMIDITY_THRESHOLD &&
          engine.rand &&
          engine.rand() < MUD_DRY_PROB_PER_STEP
        ) {
          M[i] = SAND;
        }
      }

      // --- Vitrification ---
      if (m?.name === "Sand" && T[i] > SAND_VITRIFY_TEMP_C) {
        if (engine.rand && engine.rand() < SAND_VITRIFY_PROB_PER_STEP) {
          M[i] = GLASS;
        }
      }

      // --- Ember/Smoke transition for cooling fire ---
      if (id === FIRE && T[i] < 300) {
        let origin = VX[i] | 0; // 2 = wood, 1 = oil, 0 = unknown/other
        if (origin === 0) {
          // Fallback inference: inspect immediate neighbors for fuel type
          const neigh = [i - 1, i + 1, i - w, i + w];
          for (const j of neigh) {
            const mj = registry[M[j]];
            if (mj?.name === "Wood") {
              origin = 2;
              break;
            }
            if (mj?.name === "Oil") origin = origin === 2 ? 2 : 1;
          }
          if (origin !== 0) VX[i] = origin as any;
        }
        if (origin === 2) {
          M[i] = EMBER;
        } else {
          const smokeId = getMaterialIdByName("Smoke");
          if (smokeId) {
            M[i] = smokeId as any;
            // give cooled smoke a reasonable temperature band
            T[i] = Math.max(
              SMOKE_TEMP_CLAMP_MIN_C,
              Math.min(T[i], SMOKE_TEMP_CLAMP_MAX_C)
            );
          }
        }
      }
      if (id === EMBER) {
        // deterministic ember lifetime using AUX as counter
        const life = AUX[i] | 0 || EMBER_INITIAL_LIFE_STEPS;
        AUX[i] = (life - 1) as any;
        // maintain a warm floor, but slowly decay
        T[i] = Math.max(T[i] - EMBER_COOL_DECAY_PER_STEP, EMBER_MIN_TEMP_C);
        for (const j of n)
          T[j] = Math.max(T[j], T[i] - EMBER_NEIGHBOR_WARM_DELTA_C);
        // Only reignite if there is nearby unburnt fuel
        let hasFuelNeighbor = false;
        for (const j of n) {
          const mj = registry[M[j]];
          if (mj?.flammable) {
            hasFuelNeighbor = true;
            break;
          }
        }
        if (hasFuelNeighbor && T[i] > EMBER_REIGNITE_TEMP_C) M[i] = FIRE;
        // convert to ash when life expires or cooled sufficiently
        if ((AUX[i] | 0) <= 0 || T[i] < EMBER_ASH_COOL_TEMP_C) {
          const ashId = getMaterialIdByName("Ash");
          if (ashId) M[i] = ashId as any;
        }
      }
    }
  }
}

// clamp01 not needed here; conductivity is pre-clamped in cache
