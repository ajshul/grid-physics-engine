import { createGrid, front, back, swap } from "./grid";
import { mulberry32 } from "./rng";
import { registry } from "./materials";
import { createDefaultPipeline, PassPipeline } from "./pipeline";
import { AMBIENT_TEMPERATURE_C } from "./constants";

export interface EngineOptions {
  w: number;
  h: number;
  seed?: number;
  // Fixed simulation time step in seconds. Defaults to 1/60 s.
  dt?: number;
}

export class Engine {
  private opts!: EngineOptions;
  grid!: ReturnType<typeof createGrid>;
  rand!: () => number;
  dirty: Set<number> = new Set<number>();
  chunkSize = 64;
  // Fixed simulation time step in seconds
  dt = 1 / 60;
  private pipeline: PassPipeline;

  constructor(opts: EngineOptions) {
    this.opts = opts;
    this.grid = createGrid(this.opts.w, this.opts.h);
    this.rand = mulberry32(this.opts.seed ?? 1337);
    this.dt = typeof opts.dt === "number" && opts.dt > 0 ? opts.dt : 1 / 60;
    this.pipeline = createDefaultPipeline();
  }

  paint(x: number, y: number, materialId: number, radius = 3): void {
    const g = front(this.grid);
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const px = x + dx;
        const py = y + dy;
        if (dx * dx + dy * dy > radius * radius) continue;
        if (px < 0 || py < 0 || px >= this.grid.w || py >= this.grid.h)
          continue;
        const i = (py * this.grid.w + px) | 0;
        const prevId = g.mat[i] | 0;
        g.mat[i] = materialId;
        // set reasonable initial temperature based on material and locally cool/heat
        const mat = registry[materialId];
        if (mat?.name === "Ice") {
          // place ice slightly below freezing to avoid instant melt from ambient
          g.temp[i] = Math.min(g.temp[i], -5);
          // chill local area slightly
          for (let oy = -1; oy <= 1; oy++) {
            for (let ox = -1; ox <= 1; ox++) {
              const nx = px + ox;
              const ny = py + oy;
              if (nx < 0 || ny < 0 || nx >= this.grid.w || ny >= this.grid.h)
                continue;
              const ni = (ny * this.grid.w + nx) | 0;
              g.temp[ni] = Math.min(g.temp[ni], 0);
            }
          }
        } else if (mat?.name === "Lava") {
          g.temp[i] = Math.max(g.temp[i], 800);
        } else if (mat?.name === "Water") {
          g.temp[i] = Math.min(g.temp[i], 25);
        } else if (mat?.name === "Fire") {
          g.temp[i] = Math.max(g.temp[i], 420);
          // Tag origin for burnout byproducts if painting directly over fuel
          const prev = registry[prevId];
          if (prev?.name === "Oil") {
            g.velX[i] = 1 as any;
          } else if (prev?.name === "Wood") {
            g.velX[i] = 2 as any;
          }
        }
        // clear auxiliary fields when painting new cells
        g.pressure[i] = 0;
        g.impulse[i] = 0;
        g.aux[i] = 0;
        g.humidity[i] = 0;
        g.phase[i] = 0;
        this.markDirty(px, py);
      }
    }
  }

  markDirty(x: number, y: number): void {
    const cx = (x / this.chunkSize) | 0;
    const cy = (y / this.chunkSize) | 0;
    this.dirty.add((cy << 16) | cx);
  }

  step(): void {
    const r = this.rand;
    const gA = front(this.grid);
    const gB = back(this.grid);
    // reset dirty chunks for this frame; category passes will mark
    this.dirty.clear();
    // clear write buffer to read buffer baseline
    gB.mat.set(gA.mat);
    gB.temp.set(gA.temp);
    gB.velX.set(gA.velX);
    gB.velY.set(gA.velY);
    // flags used for per-frame hints (e.g., hysteresis); clear each step
    gB.flags.fill(0);
    gB.pressure.set(gA.pressure);
    gB.impulse.set(gA.impulse);
    gB.aux.set(gA.aux);
    gB.humidity.set(gA.humidity);
    gB.phase.set(gA.phase);

    // Run modular pass pipeline
    this.pipeline.run(this, gA, gB, r);

    swap(this.grid);
  }

  /** Clear both buffers to ambient/empty and mark all chunks dirty for redraw. */
  clear(): void {
    const { w, h } = this.grid;
    const views = [this.grid.a, this.grid.b];
    for (const v of views) {
      v.mat.fill(0);
      v.temp.fill(AMBIENT_TEMPERATURE_C);
      v.velX.fill(0);
      v.velY.fill(0);
      v.flags.fill(0);
      v.pressure.fill(0);
      v.impulse.fill(0);
      v.aux.fill(0);
      v.humidity.fill(0);
      v.phase.fill(0);
    }
    // mark all chunks dirty so the next blit fully redraws
    this.dirty.clear();
    const chunksX = Math.ceil(w / this.chunkSize);
    const chunksY = Math.ceil(h / this.chunkSize);
    for (let cy = 0; cy < chunksY; cy++) {
      for (let cx = 0; cx < chunksX; cx++) {
        this.dirty.add((cy << 16) | cx);
      }
    }
  }
}

export type { GridView } from "./grid";
