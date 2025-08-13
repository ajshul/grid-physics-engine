import "../engine/materials/presets"; // ensure registry is populated
import { getMaterialIdByName } from "../engine/utils";
import { registry } from "../engine/materials";

const cache = new Map<string, number>();
let normalizedIndex: Map<string, number> | null = null;

function normalizeKey(s: string): string {
  return s
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function buildIndex(): Map<string, number> {
  const idx = new Map<string, number>();
  for (const [idStr, mat] of Object.entries(registry)) {
    if (!mat) continue;
    idx.set(normalizeKey(mat.name), Number(idStr));
  }
  return idx;
}

export function resolveMaterialIdOrThrow(name: string): number {
  const key = name.trim();
  if (cache.has(key)) return cache.get(key)!;
  const id = getMaterialIdByName(key);
  if (typeof id !== "number") {
    if (!normalizedIndex) normalizedIndex = buildIndex();
    const fromIndex = normalizedIndex.get(normalizeKey(key));
    if (typeof fromIndex !== "number") {
      throw new Error(`Unknown material in SDL: ${name}`);
    }
    cache.set(key, fromIndex);
    return fromIndex;
  }
  cache.set(key, id);
  return id;
}
