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

  it("water + lava react to stone + steam", () => {
    const W = 24, H = 16;
    const e = new Engine({ w: W, h: H, seed: 2 });
    e.paint(12, 7, WATER, 0);
    e.paint(12, 8, LAVA, 0);
    e.step();
    const front = e.grid.frontIsA ? e.grid.a : e.grid.b;
    expect(front.mat[idx(12, 8, W)]).toBe(STONE);
  });
});


