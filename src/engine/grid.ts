export interface GridView {
  mat: Uint16Array;
  temp: Float32Array;
  velX: Int8Array;
  velY: Int8Array;
  flags: Uint8Array;
  pressure: Int16Array; // approximate hydrostatic/air pressure
  aux: Uint16Array; // generic per-cell data (timers, age, etc.)
  humidity: Uint8Array; // 0..255 wetness proxy (drives cohesion and fire suppression)
}

export interface Grid {
  w: number;
  h: number;
  a: GridView;
  b: GridView;
  frontIsA: boolean;
}

export function createGrid(w: number, h: number): Grid {
  const alloc = (): GridView => ({
    mat: new Uint16Array(w * h),
    temp: new Float32Array(w * h),
    velX: new Int8Array(w * h),
    velY: new Int8Array(w * h),
    flags: new Uint8Array(w * h),
    pressure: new Int16Array(w * h),
    aux: new Uint16Array(w * h),
    humidity: new Uint8Array(w * h),
  });
  return { w, h, a: alloc(), b: alloc(), frontIsA: true };
}

export function swap(grid: Grid): void {
  grid.frontIsA = !grid.frontIsA;
}

export function front(grid: Grid): GridView {
  return grid.frontIsA ? grid.a : grid.b;
}

export function back(grid: Grid): GridView {
  return grid.frontIsA ? grid.b : grid.a;
}

export const idx = (x: number, y: number, w: number): number => (y * w + x) | 0;
