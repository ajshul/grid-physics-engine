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
  // simple diffusion + basic phase/combustion hooks
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const id = M[i];
      const m = registry[id];
      if (!m) continue;

      // diffusion (4-neighborhood) with per-material conductivity weight
      const n = [i - 1, i + 1, i - w, i + w];
      let avg = T[i];
      for (const j of n) avg += T[j];
      avg /= 5;
      const k = clamp01(m.conductivity ?? 0.2);
      // higher conductivity -> more equalization per step
      T[i] = T[i] * (1 - k * 0.35) + avg * (k * 0.35);

      // ambient cooling: exponential decay toward ambient 20 C
      const ambient = 20;
      // water and ice accelerate cooling; foam slightly too
      const matName = m.name;
      const coolantBoost =
        matName === "Water"
          ? 0.015
          : matName === "Ice"
          ? 0.03
          : matName === "Foam"
          ? 0.008
          : 0;
      // base cooling
      let cooling = 0.995 - coolantBoost;
      if (cooling < 0.97) cooling = 0.97;
      // higher temps radiate faster: additional temp-dependent loss
      const highTemp = Math.max(0, T[i] - 200) / 800; // 0..~1
      cooling -= highTemp * 0.01;
      if (cooling < 0.95) cooling = 0.95;
      T[i] = ambient + (T[i] - ambient) * cooling;

      // phase changes
      if (id === ICE && T[i] >= (m.meltingPoint ?? 0) + 5) {
        // require a small buffer above melting point to prevent instant melt
        M[i] = WATER;
      }
      if (id === WATER) {
        const fp = m.freezingPoint ?? 0;
        const bp = m.boilingPoint ?? 100;
        if (T[i] <= fp - 5) M[i] = ICE; // stronger hysteresis
        else if (T[i] >= bp + 10) M[i] = STEAM;
        // water absorbs heat and cools neighbors slightly
        for (const j of n) T[j] = Math.max(ambient, T[j] - 0.5);
      }
      if (id === STEAM) {
        // condense when cooled
        if (T[i] < 85) M[i] = WATER;
        // near cooler surfaces condense faster (ice or cold solids)
        const n2 = [i - 1, i + 1, i - w, i + w];
        let nearCool = false;
        for (const j of n2) {
          const mj = registry[M[j]];
          if (!mj) continue;
          if (mj.name === "Ice" || (mj.category === "solid" && T[j] < 30)) {
            nearCool = true;
          }
        }
        if (nearCool && T[i] < 95) M[i] = WATER;
      }

      // flammability
      if (m.flammable && T[i] >= (m.combustionTemp ?? 300)) {
        M[i] = FIRE;
      }

      // oil ignites easier
      if (id === OIL && T[i] >= 250) {
        M[i] = FIRE;
      }

      // lava heats and cools to stone
      if (id === LAVA) {
        // keep lava hot
        if (T[i] < 600) T[i] = 600;
        // lava still cools but remains high until solidifying
        T[i] = ambient + (T[i] - ambient) * 0.999;
        if (T[i] < 200) {
          // turn to stone
          const stoneId = Object.keys(registry).find(
            (k) => registry[+k]?.name === "Stone"
          );
          if (stoneId) M[i] = +stoneId;
        }
      }

      if (id === ICE) {
        // ice cools neighbors and slowly melts when warm enough
        for (const j of n) T[j] = Math.max(ambient, T[j] - 1.5);
        if (T[i] >= (m.meltingPoint ?? 0) + 2) {
          M[i] = WATER;
        }
      }

      // rubber pops to smoke at high temp
      if (id === RUBBER && T[i] >= 260) {
        const smokeId = Object.keys(registry).find(
          (k) => registry[+k]?.name === "Smoke"
        );
        if (smokeId) M[i] = +smokeId;
      }

      // wood charring: when hot but not flaming
      if (m.name === "Wood" && T[i] > 220 && T[i] < (m.combustionTemp ?? 300)) {
        // slight charring over time
        if (engine.rand && engine.rand() < 0.001) {
          const ashId = Object.keys(registry).find(
            (k) => registry[+k]?.name === "Ash"
          );
          if (ashId) M[i] = +(ashId as any);
        }
      }

      // foam decay: slowly converts to water plus occasional gas bubbles
      if (m.name === "Foam") {
        if (engine.rand && engine.rand() < 0.0005) {
          M[i] = WATER;
          // bubble spawn in adjacent empty cell
          const neighbors = [i - 1, i + 1, i - w, i + w];
          for (const j of neighbors) {
            if (M[j] === 0) {
              M[j] =
                T[i] > 80
                  ? STEAM
                  : Object.keys(registry).find(
                      (k) => registry[+k]?.name === "Smoke"
                    )
                  ? (Object.keys(registry).find(
                      (k) => registry[+k]?.name === "Smoke"
                    ) as unknown as number)
                  : 0;
              break;
            }
          }
        }
      }

      // humidity decay towards 0
      if (HUM[i] > 0) HUM[i] = (HUM[i] - 1) as any;

      // Water + Dust -> Mud (increase humidity)
      if (m.name === "Dust") {
        const n2 = [i - 1, i + 1, i - w, i + w];
        for (const j of n2) {
          if (M[j] === WATER) {
            if (engine.rand && engine.rand() < 0.1) {
              M[i] = MUD;
              HUM[i] = 200 as any;
              break;
            }
          }
        }
      }

      // Mud dries back to Sand when not near water and humidity low
      if (id === MUD) {
        const nearWater = [i - 1, i + 1, i - w, i + w].some(
          (j) => M[j] === WATER
        );
        if (!nearWater && HUM[i] < 40 && engine.rand && engine.rand() < 0.02) {
          M[i] = SAND;
        }
      }

      // vitrification: Sand -> Glass with sustained high temperature
      if (m.name === "Sand" && T[i] > 900) {
        // a small chance per tick to convert when very hot
        if (engine.rand && engine.rand() < 0.002) {
          M[i] = GLASS;
        }
      }

      // embers: if a Fire cools, leave an Ember that can re-ignite
      if (id === FIRE && T[i] < 260) {
        M[i] = EMBER;
      }

      // Ember behavior: slowly heat neighbors; re-ignite if hot enough
      if (id === EMBER) {
        T[i] = Math.max(T[i], 180);
        const n2 = [i - 1, i + 1, i - w, i + w];
        for (const j of n2) T[j] = Math.max(T[j], T[i] - 10);
        if (T[i] > 300) M[i] = FIRE;
        // decay
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
