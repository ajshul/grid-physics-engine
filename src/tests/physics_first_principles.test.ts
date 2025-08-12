import { describe, it, expect } from "vitest";
import { Engine } from "../engine/engine";
import { idx } from "../engine/grid";
import {
  DUST,
  WOOD,
  STONE,
  WATER,
  LAVA,
  FIRE,
  EMBER,
  SMOKE,
} from "../engine/materials/presets";

function F(e: Engine) {
  return e.grid.frontIsA ? e.grid.a : e.grid.b;
}

describe("physics: first principles", () => {
  it("empty space heated then cooled stays at ambient; painting dust does not spontaneously ignite", () => {
    const W = 48,
      H = 32;
    const e = new Engine({ w: W, h: H, seed: 4242 });
    const x0 = 20,
      y0 = 14;
    const g = F(e);
    // Heat a 5x5 empty patch
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) {
        const i = idx(x0 + dx, y0 + dy, W);
        g.mat[i] = 0;
        g.temp[i] = 500;
      }
    // Allow to cool to ambient
    for (let t = 0; t < 400; t++) e.step();
    let gv = F(e);
    // verify center near ambient
    expect(gv.temp[idx(x0, y0, W)]).toBeLessThan(60);
    // Now paint dust at center; shouldn't ignite
    e.paint(x0, y0, DUST, 0);
    // step a few frames to allow any erroneous ignition to happen
    for (let t = 0; t < 10; t++) e.step();
    gv = F(e);
    const v = gv.mat[idx(x0, y0, W)];
    expect([DUST, 0]).toContain(v);
    // ensure not fire or smoke at the painted spot
    expect(v).not.toBe(FIRE);
    expect(v).not.toBe(SMOKE);
  });

  it("pairwise conduction moves temperatures toward equilibrium (left cools, right warms)", () => {
    const W = 24,
      H = 16;
    const e = new Engine({ w: W, h: H, seed: 7 });
    const x = 8,
      y = 8;
    const g = F(e);
    // Put two stones side by side with a temperature gradient
    g.mat[idx(x, y, W)] = STONE;
    g.mat[idx(x + 1, y, W)] = STONE;
    g.temp[idx(x, y, W)] = 200;
    g.temp[idx(x + 1, y, W)] = 20;
    // One step is enough to see monotonic approach (ambient may slightly perturb sum)
    e.step();
    const gv = F(e);
    const TL = gv.temp[idx(x, y, W)];
    const TR = gv.temp[idx(x + 1, y, W)];
    expect(TL).toBeLessThan(200);
    expect(TR).toBeGreaterThan(20);
    expect(TL).toBeGreaterThan(TR); // still above after a single step
  });

  it("lava over wood ignites wood before fully cooling to stone; aftermath not instant stone coating", () => {
    const W = 32,
      H = 24;
    const e = new Engine({ w: W, h: H, seed: 99 });
    const x = 12,
      y = 10;
    e.paint(x, y, LAVA, 0);
    e.paint(x, y + 1, WOOD, 0);
    let ignited = false;
    for (let t = 0; t < 90; t++) {
      e.step();
      const gv = F(e);
      const under = gv.mat[idx(x, y + 1, W)];
      if ([FIRE, SMOKE, EMBER].includes(under)) {
        ignited = true;
        break;
      }
    }
    expect(ignited).toBe(true);
  });

  it("painting resets AUX and humidity at the cell", () => {
    const W = 20,
      H = 20;
    const e = new Engine({ w: W, h: H, seed: 3 });
    const x = 5,
      y = 5;
    const g = F(e);
    const i = idx(x, y, W);
    g.mat[i] = 0;
    g.temp[i] = 100;
    g.aux[i] = 500 as any;
    g.humidity[i] = 200 as any;
    e.paint(x, y, DUST, 0);
    const gv = F(e);
    expect(gv.aux[i] | 0).toBe(0);
    expect(gv.humidity[i] | 0).toBe(0);
  });
});
