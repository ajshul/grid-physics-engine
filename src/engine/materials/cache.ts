import { registry, nameToId } from "./index";
import {
  CONDUCTIVITY_DEFAULT_EMPTY,
  CONDUCTIVITY_DEFAULT_GAS,
  CONDUCTIVITY_DEFAULT_LIQUID,
  CONDUCTIVITY_DEFAULT_POWDER,
  CONDUCTIVITY_DEFAULT_SOLID,
  HEAT_CAPACITY_DEFAULT_EMPTY,
  HEAT_CAPACITY_DEFAULT_GAS,
  HEAT_CAPACITY_DEFAULT_LIQUID,
  HEAT_CAPACITY_DEFAULT_POWDER,
  HEAT_CAPACITY_DEFAULT_SOLID,
} from "../../engine/constants";

// Numeric category codes for hot loops
export const CAT_CODE = {
  UNKNOWN: 0,
  SOLID: 1,
  POWDER: 2,
  LIQUID: 3,
  GAS: 4,
  ENERGY: 5,
  OBJECT: 6,
} as const;

export let catCodeById: Uint8Array = new Uint8Array(0);
export let densityById: Float32Array = new Float32Array(0);
export let heatCapacityById: Float32Array = new Float32Array(0);
export let conductivityById: Float32Array = new Float32Array(0);
export let flammableById: Uint8Array = new Uint8Array(0);
export let combustionTempById: Int16Array = new Int16Array(0);
export let immiscibleIdsById: number[][] = [];

let builtSize = 0;

/** Ensure per-id material property caches are built and sized. */
export function ensureMaterialCaches(): void {
  // Max id in registry (0 is empty)
  let maxId = 0;
  for (const k of Object.keys(registry)) {
    const id = +k;
    if (id > maxId) maxId = id;
  }
  const size = maxId + 1;
  if (size === builtSize && catCodeById.length === size) return;

  catCodeById = new Uint8Array(size);
  densityById = new Float32Array(size);
  heatCapacityById = new Float32Array(size);
  conductivityById = new Float32Array(size);
  flammableById = new Uint8Array(size);
  combustionTempById = new Int16Array(size);
  immiscibleIdsById = new Array(size);

  const toCode = (cat?: string): number => {
    switch (cat) {
      case "solid":
        return CAT_CODE.SOLID;
      case "powder":
        return CAT_CODE.POWDER;
      case "liquid":
        return CAT_CODE.LIQUID;
      case "gas":
        return CAT_CODE.GAS;
      case "energy":
        return CAT_CODE.ENERGY;
      case "object":
        return CAT_CODE.OBJECT;
      default:
        return CAT_CODE.UNKNOWN;
    }
  };

  // id 0 defaults: treat as empty/air
  catCodeById[0] = CAT_CODE.UNKNOWN;
  densityById[0] = 0;
  heatCapacityById[0] = HEAT_CAPACITY_DEFAULT_EMPTY;
  conductivityById[0] = CONDUCTIVITY_DEFAULT_EMPTY;
  flammableById[0] = 0;
  combustionTempById[0] = 300;
  immiscibleIdsById[0] = [];

  for (let id = 1; id < size; id++) {
    const m = registry[id];
    if (!m) {
      catCodeById[id] = CAT_CODE.UNKNOWN;
      densityById[id] = 0;
      heatCapacityById[id] = HEAT_CAPACITY_DEFAULT_EMPTY;
      conductivityById[id] = CONDUCTIVITY_DEFAULT_EMPTY;
      flammableById[id] = 0;
      combustionTempById[id] = 300;
      immiscibleIdsById[id] = [];
      continue;
    }
    catCodeById[id] = toCode(m.category);
    densityById[id] = Math.abs(m.density ?? 5.0);
    // Heat capacity and conductivity default by category if not specified
    if (typeof m.heatCapacity === "number") {
      heatCapacityById[id] = m.heatCapacity;
    } else {
      switch (m.category) {
        case "liquid":
          heatCapacityById[id] = HEAT_CAPACITY_DEFAULT_LIQUID;
          break;
        case "solid":
          heatCapacityById[id] = HEAT_CAPACITY_DEFAULT_SOLID;
          break;
        case "powder":
          heatCapacityById[id] = HEAT_CAPACITY_DEFAULT_POWDER;
          break;
        case "gas":
          heatCapacityById[id] = HEAT_CAPACITY_DEFAULT_GAS;
          break;
        default:
          heatCapacityById[id] = HEAT_CAPACITY_DEFAULT_EMPTY;
      }
    }
    if (typeof m.conductivity === "number") {
      const c = m.conductivity;
      conductivityById[id] = c < 0 ? 0 : c > 1 ? 1 : c;
    } else {
      switch (m.category) {
        case "gas":
          conductivityById[id] = CONDUCTIVITY_DEFAULT_GAS;
          break;
        case "liquid":
          conductivityById[id] = CONDUCTIVITY_DEFAULT_LIQUID;
          break;
        case "powder":
          conductivityById[id] = CONDUCTIVITY_DEFAULT_POWDER;
          break;
        case "solid":
          conductivityById[id] = CONDUCTIVITY_DEFAULT_SOLID;
          break;
        default:
          conductivityById[id] = CONDUCTIVITY_DEFAULT_EMPTY;
      }
    }
    flammableById[id] = m.flammable ? 1 : 0;
    combustionTempById[id] = (m.combustionTemp ?? 300) | 0;
    // immiscible mapping by id list
    const list: number[] = [];
    if (Array.isArray(m.immiscibleWith)) {
      for (const nm of m.immiscibleWith) {
        const other = nameToId.get(nm);
        if (typeof other === "number") list.push(other);
      }
    }
    immiscibleIdsById[id] = list;
  }

  builtSize = size;
}

/** Check if two liquid ids are considered immiscible (either side lists the other). */
export function isImmiscible(idA: number, idB: number): boolean {
  if (idA === idB) return false;
  const a = immiscibleIdsById[idA];
  const b = immiscibleIdsById[idB];
  if (!a && !b) return false;
  if (a && a.length > 0) {
    for (let i = 0; i < a.length; i++) if (a[i] === idB) return true;
  }
  if (b && b.length > 0) {
    for (let i = 0; i < b.length; i++) if (b[i] === idA) return true;
  }
  return false;
}

