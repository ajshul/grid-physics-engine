import { registry, nameToId } from "./materials";

export function getMaterialIdByName(name: string): number | undefined {
  const id = nameToId.get(name);
  return typeof id === "number" ? id : undefined;
}

export function neighbors4(
  index: number,
  width: number
): [number, number, number, number] {
  return [index - 1, index + 1, index - width, index + width];
}

export function isEmpty(id: number): boolean {
  return id === 0;
}

export function isCategory(id: number, category: string): boolean {
  const m = registry[id];
  return !!m && m.category === (category as any);
}

export function isGasOrEmpty(id: number): boolean {
  return isEmpty(id) || isCategory(id, "gas");
}

export function clamp16(v: number): number {
  if (v > 32767) return 32767;
  if (v < -32768) return -32768;
  return v | 0;
}

export function stepTowardZero(v: number): number {
  if (v > 0) return v - 1;
  if (v < 0) return v + 1;
  return 0;
}
