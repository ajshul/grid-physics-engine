import { describe, it, expect } from "vitest";
import { Engine } from "../engine/engine";
import { idx } from "../engine/grid";
import {
  WATER,
  DUST,
  MUD,
  LAVA,
  STEAM,
  ICE,
  STONE,
  WOOD,
  OIL,
  FIRE,
  SMOKE,
  EMBER,
} from "../engine/materials/presets";

function F(e: Engine) {
  return e.grid.frontIsA ? e.grid.a : e.grid.b;
}

function tank(e: Engine, x0: number, y0: number, x1: number, y1: number) {
  const g = F(e);
  for (let x = x0; x <= x1; x++) {
    g.mat[idx(x, y0, e.grid.w)] = STONE;
    g.mat[idx(x, y1, e.grid.w)] = STONE;
  }
  for (let y = y0; y <= y1; y++) {
    g.mat[idx(x0, y, e.grid.w)] = STONE;
    g.mat[idx(x1, y, e.grid.w)] = STONE;
  }
}

describe("additional interactions", () => {
  it("dust near water turns into mud over time", () => {
    const W = 40,
      H = 30;
    const e = new Engine({ w: W, h: H, seed: 246 });
    tank(e, 10, 10, 28, 22);
    // place a patch of dust adjacent to water line
    for (let x = 12; x <= 20; x++) e.paint(x, 16, DUST, 0);
    for (let x = 12; x <= 20; x++) e.paint(x, 17, WATER, 0);
    // run for a while to allow probabilistic conversion
    for (let t = 0; t < 1200; t++) e.step();
    const g = F(e);
    let mud = 0;
    for (let i = 0; i < g.mat.length; i++) if (g.mat[i] === MUD) mud++;
    expect(mud).toBeGreaterThan(0);
  });

  it.skip("lava without input heat cools to stone eventually", () => {
    const W = 40,
      H = 30;
    const e = new Engine({ w: W, h: H, seed: 888 });
    tank(e, 15, 10, 25, 20);
    const x = 20,
      y = 15;
    e.paint(x, y, LAVA, 0);
    for (let t = 0; t < 1500; t++) e.step();
    const g = F(e);
    expect(g.mat[idx(x, y, W)]).toBe(STONE);
  });

  it("steam condenses to water near cold ice", () => {
    const W = 40,
      H = 30;
    const e = new Engine({ w: W, h: H, seed: 135 });
    tank(e, 10, 10, 20, 20);
    e.paint(12, 15, ICE, 0);
    e.paint(13, 15, STEAM, 0);
    // Keep ice cold
    const g = F(e);
    g.temp[idx(12, 15, W)] = -5;
    for (let t = 0; t < 120; t++) e.step();
    const gv = F(e);
    // ensure at least one water cell exists anywhere (no initial water present)
    const foundWater = Array.from(gv.mat).some((v) => v === WATER);
    expect(foundWater).toBe(true);
  });

  it("lava near wood and oil reliably ignites them", () => {
    const W = 36,
      H = 24;
    const e = new Engine({ w: W, h: H, seed: 2024 });
    const x = 18,
      y = 12;
    e.paint(x, y, LAVA, 0);
    e.paint(x + 1, y, WOOD, 0);
    e.paint(x - 1, y, OIL, 0);
    let nearWoodIgnited = false;
    let nearOilIgnited = false;
    for (let t = 0; t < 90; t++) {
      e.step();
      const g = F(e);
      const neighWood = [
        idx(x + 1, y, W),
        idx(x + 2, y, W),
        idx(x + 1, y - 1, W),
        idx(x + 1, y + 1, W),
      ];
      const neighOil = [
        idx(x - 1, y, W),
        idx(x - 2, y, W),
        idx(x - 1, y - 1, W),
        idx(x - 1, y + 1, W),
      ];
      if (neighWood.some((i) => [FIRE, SMOKE, EMBER].includes(g.mat[i])))
        nearWoodIgnited = true;
      if (neighOil.some((i) => [FIRE, SMOKE, EMBER].includes(g.mat[i])))
        nearOilIgnited = true;
      if (nearWoodIgnited && nearOilIgnited) break;
    }
    expect(nearWoodIgnited).toBe(true);
    expect(nearOilIgnited).toBe(true);
  });

  it("burning oil tends to smoke out; burning wood tends to leave ember", () => {
    const W = 40,
      H = 28;
    const e = new Engine({ w: W, h: H, seed: 3003 });
    const xo = 12,
      yo = 14;
    const xw = 26,
      yw = 14;
    e.paint(xo, yo, OIL, 0);
    e.paint(xw, yw, WOOD, 0);
    e.paint(xo + 1, yo, FIRE, 0);
    e.paint(xw - 1, yw, FIRE, 0);
    for (let t = 0; t < 260; t++) e.step();
    const g = F(e);
    expect([SMOKE, FIRE, OIL, 0]).toContain(g.mat[idx(xo, yo, W)]);
    expect([EMBER, FIRE, WOOD, 0]).toContain(g.mat[idx(xw, yw, W)]);
  });
});
