import { createGrid, front, back, swap } from "./grid";
import { stepPowder } from "./materials/rules/powder";
import { stepLiquid } from "./materials/rules/liquid";
import { stepGas } from "./materials/rules/gas";
import { stepSolid } from "./materials/rules/solid";
import { stepEnergy } from "./materials/rules/energy";
import { stepObjects } from "./materials/rules/object";
import { applyThermal } from "./materials/reactions";
import { mulberry32 } from "./rng";
import { computePressure } from "./passes/pressure";
import { applyAcidEtching } from "./passes/acid";
import { registry } from "./materials";

export interface EngineOptions {
  w: number;
  h: number;
  seed?: number;
}

export class Engine {
  private opts!: EngineOptions;
  grid!: ReturnType<typeof createGrid>;
  rand!: () => number;
  dirty: Set<number> = new Set<number>();
  chunkSize = 64;

  constructor(opts: EngineOptions) {
    this.opts = opts;
    this.grid = createGrid(this.opts.w, this.opts.h);
    this.rand = mulberry32(this.opts.seed ?? 1337);
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
        }
        // clear auxiliary fields when painting new cells
        g.pressure[i] = 0;
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
    gB.flags.set(gA.flags);
    gB.pressure.set(gA.pressure);
    gB.aux.set(gA.aux);
    gB.humidity.set(gA.humidity);
    gB.phase.set(gA.phase);

    // compute pressure field for liquids/gases with decay
    computePressure(this, gA, gB);

    stepPowder(this, gA, gB, r);
    stepLiquid(this, gA, gB, r);
    stepGas(this, gA, gB, r);
    stepSolid(this, gA, gB, r);
    stepEnergy(this, gA, gB, r);
    stepObjects(this, gA, gB, r);
    applyAcidEtching(this, gA, gB);
    applyThermal(this, gB);

    swap(this.grid);
  }
}

export type { GridView } from "./grid";
