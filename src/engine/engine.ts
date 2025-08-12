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
        g.mat[(py * this.grid.w + px) | 0] = materialId;
        // clear auxiliary fields when painting new cells
        const i = (py * this.grid.w + px) | 0;
        g.temp[i] = 20;
        g.pressure[i] = 0;
        g.aux[i] = 0;
        g.humidity[i] = 0;
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
