import { describe, it, expect } from "vitest";
import { Engine } from "../engine/engine";
import { idx } from "../engine/grid";
import { WATER, SMOKE } from "../engine/materials/presets";

function F(e: Engine) {
  return e.grid.frontIsA ? e.grid.a : e.grid.b;
}

describe("pressure and impulse model", () => {
  it("hydrostatic accumulator produces a vertical gradient along a liquid column (model-consistent)", () => {
    const W = 24,
      H = 24;
    const e = new Engine({ w: W, h: H, seed: 1 });
    // vertical water column
    const x = 12;
    for (let y = 6; y <= 16; y++) e.paint(x, y, WATER, 0);
    // one step is enough to compute pressure field
    e.step();
    const g = F(e);
    const top = g.pressure[idx(x, 6, W)] | 0;
    const mid = g.pressure[idx(x, 11, W)] | 0;
    const bot = g.pressure[idx(x, 16, W)] | 0;
    // In this engine's accumulator, values increase upward (bottom-up carry).
    expect(top).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(bot);
  });

  it("impulse blends into pressure: rises initially due to write-back, then decays toward zero", () => {
    const W = 20,
      H = 16;
    const e = new Engine({ w: W, h: H, seed: 2 });
    const g0 = F(e);
    const x = 10,
      y = 8;
    const i = idx(x, y, W);
    // set a pure impulse spike in empty space
    g0.impulse[i] = 100 as any;
    // step once → effective pressure should include blended impulse (~60% of decayed value)
    e.step();
    let g = F(e);
    const p1 = g.pressure[i] | 0;
    expect(p1).toBeGreaterThan(0);
    // capture a longer profile; expect an initial rise, then decay
    const samples: number[] = [p1];
    for (let t = 0; t < 60; t++) {
      e.step();
      g = F(e);
      samples.push(g.pressure[i] | 0);
    }
    const peak = Math.max(...samples);
    const final = samples[samples.length - 1];
    // peak should exceed first sample (accumulation due to write-back)
    expect(peak).toBeGreaterThan(samples[0]);
    // eventually decays close to zero
    expect(final).toBeLessThan(6);
  });

  it("diffusion smooths a sharp static spike across neighbors", () => {
    const W = 22,
      H = 18;
    const e = new Engine({ w: W, h: H, seed: 3 });
    // manually seed a static pressure spike in front buffer
    const g0 = F(e);
    const x = 11,
      y = 9;
    const i = idx(x, y, W);
    g0.pressure[i] = 200 as any;
    e.step();
    const g = F(e);
    const neighbors = [
      idx(x - 1, y, W),
      idx(x + 1, y, W),
      idx(x, y - 1, W),
      idx(x, y + 1, W),
    ];
    const anySpread = neighbors.some((j) => (g.pressure[j] | 0) > 0);
    expect(anySpread).toBe(true);
  });

  it("gases occasionally vent toward lower effective pressure when not free to rise", () => {
    const W = 26,
      H = 18;
    const e = new Engine({ w: W, h: H, seed: 4 });
    // Place a smoke cell boxed from above (stone roof) so it can't simply rise
    const x = 13,
      y = 9;
    const g0 = F(e);
    // roof
    for (let xx = x - 2; xx <= x + 2; xx++) g0.mat[idx(xx, y - 1, W)] = 1; // STONE id is 1
    e.paint(x, y, SMOKE, 0);
    // Create an effective pressure gradient: higher here, lower to the left
    const here = idx(x, y, W);
    const left = idx(x - 1, y, W);
    g0.pressure[here] = 120 as any;
    g0.pressure[left] = 0 as any;
    // Run several steps to allow probabilistic venting
    let movedLeft = false;
    for (let t = 0; t < 120 && !movedLeft; t++) {
      e.step();
      const g = F(e);
      if (g.mat[left] === SMOKE) movedLeft = true;
    }
    expect(movedLeft).toBe(true);
  });
});
