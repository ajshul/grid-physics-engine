// Simple seeded 2D value noise (fast, deterministic) — not Perlin, but adequate

export function mulberry32(seed: number) {
  return function rand(): number {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash2(x: number, y: number, seed: number): number {
  let h = seed ^ (x * 374761393) ^ (y * 668265263);
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function valueNoise2D(
  x: number,
  y: number,
  scale: number,
  seed: number
): number {
  const sx = Math.floor(x / scale);
  const sy = Math.floor(y / scale);
  const fx = x / scale - sx;
  const fy = y / scale - sy;
  const h00 = hash2(sx, sy, seed);
  const h10 = hash2(sx + 1, sy, seed);
  const h01 = hash2(sx, sy + 1, seed);
  const h11 = hash2(sx + 1, sy + 1, seed);
  const ix0 = lerp(h00, h10, smoothstep(fx));
  const ix1 = lerp(h01, h11, smoothstep(fx));
  return lerp(ix0, ix1, smoothstep(fy));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}
