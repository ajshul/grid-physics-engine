import type { Material } from "./types";

export const registry: Record<number, Material> = {};
export const nameToId = new Map<string, number>();
let nextId = 1; // 0 reserved for empty

export function define(mat: Omit<Material, "id">): number {
  const id = nextId++;
  const full = { ...mat, id } as Material;
  registry[id] = full;
  nameToId.set(mat.name, id);
  return id;
}


