export interface GridView {
  mat: Uint16Array;
  temp: Float32Array;
  velX: Int8Array;
  velY: Int8Array;
  flags: Uint8Array;
  pressure: Int16Array; // approximate hydrostatic/air pressure
  // transient pressure impulses (explosions, reactions). Decays quickly and
  // is blended into the final `pressure` field during the pressure pass.
  impulse: Int16Array;
  aux: Uint16Array; // generic per-cell data (timers, age, etc.)
  humidity: Uint8Array; // 0..255 wetness proxy (drives cohesion and fire suppression)
  // latent heat accumulator for phase changes (ice↔water↔steam). Units are
  // arbitrary but proportional to heat capacity * degrees C.
  phase: Float32Array;
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
    impulse: new Int16Array(w * h),
    aux: new Uint16Array(w * h),
    humidity: new Uint8Array(w * h),
    phase: new Float32Array(w * h),
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

/** Expand the grid width (mutates in place by reallocating the buffers). */
export function expandGridWidth(grid: Grid, newW: number): void {
  if (newW <= grid.w) return;
  const { h } = grid;
  const makeView = (): GridView => ({
    mat: new Uint16Array(newW * h),
    temp: new Float32Array(newW * h),
    velX: new Int8Array(newW * h),
    velY: new Int8Array(newW * h),
    flags: new Uint8Array(newW * h),
    pressure: new Int16Array(newW * h),
    impulse: new Int16Array(newW * h),
    aux: new Uint16Array(newW * h),
    humidity: new Uint8Array(newW * h),
    phase: new Float32Array(newW * h),
  });
  const copy = (src: GridView, dst: GridView) => {
    for (let y = 0; y < h; y++) {
      const srcRow = y * grid.w;
      const dstRow = y * newW;
      dst.mat.set(src.mat.subarray(srcRow, srcRow + grid.w), dstRow);
      dst.temp.set(src.temp.subarray(srcRow, srcRow + grid.w), dstRow);
      dst.velX.set(src.velX.subarray(srcRow, srcRow + grid.w), dstRow);
      dst.velY.set(src.velY.subarray(srcRow, srcRow + grid.w), dstRow);
      dst.flags.set(src.flags.subarray(srcRow, srcRow + grid.w), dstRow);
      dst.pressure.set(src.pressure.subarray(srcRow, srcRow + grid.w), dstRow);
      dst.impulse.set(src.impulse.subarray(srcRow, srcRow + grid.w), dstRow);
      dst.aux.set(src.aux.subarray(srcRow, srcRow + grid.w), dstRow);
      dst.humidity.set(src.humidity.subarray(srcRow, srcRow + grid.w), dstRow);
      dst.phase.set(src.phase.subarray(srcRow, srcRow + grid.w), dstRow);
      // Newly allocated columns are already zero/ambient by default (0-filled arrays).
    }
  };
  const newA = makeView();
  const newB = makeView();
  copy(grid.a, newA);
  copy(grid.b, newB);
  grid.a = newA;
  grid.b = newB;
  grid.w = newW;
}
