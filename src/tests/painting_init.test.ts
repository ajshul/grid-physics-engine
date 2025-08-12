import { describe, it, expect } from "vitest";
import { Engine } from "../engine/engine";
import { idx } from "../engine/grid";
import { ICE, WATER, LAVA, FIRE } from "../engine/materials/presets";

function F(e: Engine) {
  return e.grid.frontIsA ? e.grid.a : e.grid.b;
}

describe("paint initialization semantics", () => {
  it("painting resets aux, humidity, phase, and sets reasonable temperature defaults", () => {
    const W = 20,
      H = 20;
    const e = new Engine({ w: W, h: H, seed: 7 });
    const x = 10,
      y = 10;
    const g = F(e);
    const i = idx(x, y, W);
    g.aux[i] = 1234 as any;
    g.humidity[i] = 200 as any;
    g.phase[i] = 99;
    g.temp[i] = 500;
    e.paint(x, y, WATER, 0);
    const gv = F(e);
    expect(gv.aux[i] | 0).toBe(0);
    expect(gv.humidity[i] | 0).toBe(0);
    expect(gv.phase[i]).toBe(0);
    // water temp clamped down
    expect(gv.temp[i]).toBeLessThanOrEqual(25);
  });

  it("ice paint chills local area and sets below freezing to avoid instant melt", () => {
    const W = 24,
      H = 24;
    const e = new Engine({ w: W, h: H, seed: 8 });
    const x = 12,
      y = 12;
    e.paint(x, y, ICE, 0);
    const g = F(e);
    // center is at or below 0
    expect(g.temp[idx(x, y, W)]).toBeLessThanOrEqual(0);
    // neighbors not above ambient and often cooled to <= 0
    let cooledNeighbors = 0;
    for (const [dx, dy] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ]) {
      if (g.temp[idx(x + (dx as number), y + (dy as number), W)] <= 0)
        cooledNeighbors++;
    }
    expect(cooledNeighbors).toBeGreaterThan(0);
  });

  it("lava paint sets high temperature for immediate heating visuals", () => {
    const W = 20,
      H = 20;
    const e = new Engine({ w: W, h: H, seed: 9 });
    const x = 10,
      y = 10;
    e.paint(x, y, LAVA, 0);
    const g = F(e);
    expect(g.temp[idx(x, y, W)]).toBeGreaterThanOrEqual(800);
  });

  it("fire paint sets a hot floor so it is visible right away", () => {
    const W = 18,
      H = 18;
    const e = new Engine({ w: W, h: H, seed: 10 });
    const x = 9,
      y = 9;
    e.paint(x, y, FIRE, 0);
    const g = F(e);
    expect(g.temp[idx(x, y, W)]).toBeGreaterThanOrEqual(420);
  });
});
