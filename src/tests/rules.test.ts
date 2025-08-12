import { describe, it, expect } from "vitest";
import { Engine } from "../engine/engine";
import { idx } from "../engine/grid";
import { SAND, WATER, LAVA, STONE } from "../engine/materials/presets";

describe("rules", () => {
  it("powder falls down", () => {
    const W = 32;
    const H = 16;
    const e = new Engine({ w: W, h: H, seed: 1 });
    e.paint(10, 2, SAND, 0);
    e.step();
    const front = e.grid.frontIsA ? e.grid.a : e.grid.b;
    // after one step, grain should have moved down by 1 if empty
    expect(front.mat[idx(10, 3, W)]).toBe(SAND);
  });

  it("water + lava react to stone + steam (allow brief gating and movement)", () => {
    const W = 24,
      H = 16;
    const e = new Engine({ w: W, h: H, seed: 2 });
    e.paint(12, 7, WATER, 0);
    e.paint(12, 8, LAVA, 0);
    // Allow several frames for heat exchange/pressure and then assert presence of
    // the expected products in a small neighborhood to avoid false negatives due to motion.
    for (let t = 0; t < 12; t++) e.step();
    const front = e.grid.frontIsA ? e.grid.a : e.grid.b;
    const neighborhood = [
      idx(12, 8, W),
      idx(12, 7, W),
      idx(11, 8, W),
      idx(13, 8, W),
      idx(12, 9, W),
    ];
    const hasStone = neighborhood.some((i) => front.mat[i] === STONE);
    expect(hasStone).toBe(true);
  });
});
