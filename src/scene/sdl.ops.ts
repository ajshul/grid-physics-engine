import type { SDLScene } from "./sdl.types";
import { resolveMaterialIdOrThrow } from "./sdl.materials";
import { valueNoise2D } from "./sdl.noise";

export type PaintTarget = {
  w: number;
  h: number;
  mat: Uint16Array;
  temp: Float32Array;
};

export function applyOps(scene: SDLScene, target: PaintTarget): void {
  const ops = scene.layers
    .flatMap((l) => l.ops.map((op) => ({ ...op, z: l.z ?? op.z ?? 0 })))
    .sort((a, b) => (a.z ?? 0) - (b.z ?? 0));
  for (const op of ops) {
    switch (op.type) {
      case "fill":
        paintRect(
          target,
          op.x,
          op.y,
          op.w,
          op.h,
          resolveMaterialIdOrThrow(op.material)
        );
        break;
      case "overlay": {
        const maskAny = op.mask === "any";
        const maskId =
          !maskAny && op.mask ? resolveMaterialIdOrThrow(op.mask) : undefined;
        const id = resolveMaterialIdOrThrow(op.material);
        rectIter(target, op.x, op.y, op.w, op.h, (i) => {
          if (
            maskAny ||
            (typeof maskId === "number" && target.mat[i] === maskId)
          ) {
            target.mat[i] = id;
          }
        });
        break;
      }
      case "scatter": {
        const id = resolveMaterialIdOrThrow(op.material);
        const rng = seeded(op.seed ?? scene.metadata.seed ?? 0);
        const { x, y, w, h } = op.region;
        for (let py = 0; py < h; py++) {
          for (let px = 0; px < w; px++) {
            if (rng() < op.density) {
              const cx = x + px;
              const cy = y + py;
              if (!inBounds(target, cx, cy)) continue;
              paintDisk(target, cx, cy, op.radius ?? 0, id);
            }
          }
        }
        break;
      }
      case "basin": {
        const wall = resolveMaterialIdOrThrow(op.wall);
        const x0 = op.x;
        const y0 = op.y;
        const x1 = op.x + op.w - 1;
        const y1 = op.y + op.depth - 1;
        // walls
        drawLine(target, x0, y0, x0, y1, wall);
        drawLine(target, x1, y0, x1, y1, wall);
        drawLine(target, x0, y1, x1, y1, wall);
        // fill level
        if (op.fill) {
          const fid = resolveMaterialIdOrThrow(op.fill.material);
          const levelY = Math.min(y0 + op.fill.level, y1 - 1);
          paintRect(target, x0 + 1, levelY, x1 - x0 - 1, y1 - levelY, fid);
        }
        break;
      }
      case "ring": {
        const id = resolveMaterialIdOrThrow(op.material);
        circle(target, op.cx, op.cy, op.r, id, op.thickness ?? 1);
        break;
      }
      case "spot": {
        const id = resolveMaterialIdOrThrow(op.material);
        paintDisk(target, op.cx, op.cy, op.r, id);
        break;
      }
      case "slope": {
        const id = resolveMaterialIdOrThrow(op.material);
        const dir = op.direction === "up" ? 1 : -1;
        for (let dx = 0; dx < op.w; dx++) {
          const height = Math.floor((dx / Math.max(1, op.w - 1)) * op.h);
          const colH = dir > 0 ? height : op.h - height;
          paintRect(target, op.x + dx, op.y + (op.h - colH), 1, colH, id);
        }
        break;
      }
      case "stream": {
        const id = resolveMaterialIdOrThrow(op.material);
        thickLine(
          target,
          op.from.x,
          op.from.y,
          op.to.x,
          op.to.y,
          id,
          op.thickness ?? 1
        );
        break;
      }
      case "structure": {
        const id = resolveMaterialIdOrThrow(op.material);
        rectFrame(target, op.x, op.y, op.w, op.h, id);
        if (!op.hollow)
          paintRect(target, op.x + 1, op.y + 1, op.w - 2, op.h - 2, id);
        if (op.roof) {
          const rid = resolveMaterialIdOrThrow(op.roof.material);
          const t = op.roof.thickness ?? 1;
          paintRect(target, op.x, op.y - t, op.w, t, rid);
        }
        break;
      }
      case "noiseFill": {
        const id = resolveMaterialIdOrThrow(op.material);
        const seed = (op.seed ?? scene.metadata.seed ?? 0) | 0;
        const scale = Math.max(1, op.scale ?? 8);
        rectIter(target, op.x, op.y, op.w, op.h, (i, px, py) => {
          const n = valueNoise2D(px, py, scale, seed);
          if (n >= op.threshold) target.mat[i] = id;
        });
        break;
      }
      case "emitter":
        // handled in compiler; geometry free
        break;
    }
  }
}

function paintRect(
  t: PaintTarget,
  x: number,
  y: number,
  w: number,
  h: number,
  id: number
): void {
  rectIter(t, x, y, w, h, (i) => (t.mat[i] = id));
}

function rectFrame(
  t: PaintTarget,
  x: number,
  y: number,
  w: number,
  h: number,
  id: number
): void {
  for (let dx = 0; dx < w; dx++) {
    pset(t, x + dx, y, id);
    pset(t, x + dx, y + h - 1, id);
  }
  for (let dy = 0; dy < h; dy++) {
    pset(t, x, y + dy, id);
    pset(t, x + w - 1, y + dy, id);
  }
}

function rectIter(
  t: PaintTarget,
  x: number,
  y: number,
  w: number,
  h: number,
  fn: (i: number, px: number, py: number) => void
): void {
  const x0 = Math.max(0, x);
  const y0 = Math.max(0, y);
  const x1 = Math.min(t.w, x + w);
  const y1 = Math.min(t.h, y + h);
  for (let py = y0; py < y1; py++) {
    for (let px = x0; px < x1; px++) {
      const i = py * t.w + px;
      fn(i, px, py);
    }
  }
}

function pset(t: PaintTarget, x: number, y: number, id: number): void {
  if (!inBounds(t, x, y)) return;
  t.mat[y * t.w + x] = id;
}

function inBounds(t: PaintTarget, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < t.w && y < t.h;
}

function paintDisk(
  t: PaintTarget,
  cx: number,
  cy: number,
  r: number,
  id: number
): void {
  if (r <= 0) {
    pset(t, cx, cy, id);
    return;
  }
  const rr = r * r;
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy <= rr) pset(t, cx + dx, cy + dy, id);
    }
  }
}

function circle(
  t: PaintTarget,
  cx: number,
  cy: number,
  r: number,
  id: number,
  thickness: number
): void {
  for (let rr = 0; rr < thickness; rr++) {
    bresenhamCircle(t, cx, cy, Math.max(1, r - rr), id);
  }
}

function bresenhamCircle(
  t: PaintTarget,
  cx: number,
  cy: number,
  r: number,
  id: number
): void {
  let x = r;
  let y = 0;
  let err = 0;
  while (x >= y) {
    pset(t, cx + x, cy + y, id);
    pset(t, cx + y, cy + x, id);
    pset(t, cx - y, cy + x, id);
    pset(t, cx - x, cy + y, id);
    pset(t, cx - x, cy - y, id);
    pset(t, cx - y, cy - x, id);
    pset(t, cx + y, cy - x, id);
    pset(t, cx + x, cy - y, id);
    y++;
    if (err <= 0) err += 2 * y + 1;
    if (err > 0) {
      x--;
      err -= 2 * x + 1;
    }
  }
}

function thickLine(
  t: PaintTarget,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  id: number,
  thickness: number
): void {
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  while (true) {
    paintDisk(t, x0, y0, Math.max(0, thickness - 1), id);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y0 += sy;
    }
  }
}

function seeded(seed: number): () => number {
  let s = seed | 0;
  return function rand() {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function drawLine(
  t: PaintTarget,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  id: number
): void {
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  while (true) {
    pset(t, x0, y0, id);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y0 += sy;
    }
  }
}
