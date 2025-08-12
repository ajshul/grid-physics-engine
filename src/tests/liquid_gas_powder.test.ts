import { describe, it, expect } from "vitest";
import { Engine } from "../engine/engine";
import { idx } from "../engine/grid";
import {
  WATER,
  OIL,
  FOAM,
  ACID,
  STEAM,
  SMOKE,
  SAND,
  DUST,
  STONE,
  GLASS,
  WOOD,
  RUBBLE,
  FIRE,
} from "../engine/materials/presets";

function F(e: Engine) {
  return e.grid.frontIsA ? e.grid.a : e.grid.b;
}

function tank(e: Engine, x0: number, y0: number, x1: number, y1: number) {
  // solid border of STONE: inclusive bounds
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

describe("liquids, gases, powders interactions", () => {
  it("water layers below oil when confined; remains immiscible", () => {
    const W = 40,
      H = 30;
    const e = new Engine({ w: W, h: H, seed: 5 });
    // build a tank
    tank(e, 10, 10, 20, 25);
    // fill middle with a mix: top half oil, bottom half water
    for (let y = 11; y <= 17; y++)
      for (let x = 11; x <= 19; x++) e.paint(x, y, OIL, 0);
    for (let y = 18; y <= 24; y++)
      for (let x = 11; x <= 19; x++) e.paint(x, y, WATER, 0);
    for (let t = 0; t < 200; t++) e.step();
    const g = F(e);
    // Count distribution: more WATER in lower half than upper, more OIL in upper than lower
    let waterUpper = 0,
      waterLower = 0,
      oilUpper = 0,
      oilLower = 0;
    for (let y = 11; y <= 17; y++)
      for (let x = 11; x <= 19; x++)
        if (g.mat[idx(x, y, W)] === WATER) waterUpper++;
    for (let y = 18; y <= 24; y++)
      for (let x = 11; x <= 19; x++)
        if (g.mat[idx(x, y, W)] === WATER) waterLower++;
    for (let y = 11; y <= 17; y++)
      for (let x = 11; x <= 19; x++)
        if (g.mat[idx(x, y, W)] === OIL) oilUpper++;
    for (let y = 18; y <= 24; y++)
      for (let x = 11; x <= 19; x++)
        if (g.mat[idx(x, y, W)] === OIL) oilLower++;
    expect(waterLower).toBeGreaterThan(waterUpper);
    expect(oilUpper).toBeGreaterThan(oilLower);
  });

  it("foam suppresses adjacent fire, not igniting itself", () => {
    const W = 40,
      H = 30;
    const e = new Engine({ w: W, h: H, seed: 33 });
    tank(e, 10, 10, 20, 20);
    const x = 12,
      y = 15;
    e.paint(x, y, FOAM, 0);
    e.paint(x + 1, y, FIRE, 0);
    for (let t = 0; t < 60; t++) e.step();
    const g2 = F(e);
    // in the region, foam cell should be FOAM or WATER, not FIRE
    expect([FOAM, WATER]).toContain(g2.mat[idx(x, y, W)]);
  });

  it("acid etches stone/wood/glass into rubble and may emit smoke", () => {
    const W = 38,
      H = 28;
    const e = new Engine({ w: W, h: H, seed: 19 });
    tank(e, 8, 8, 22, 22);
    const x = 12,
      y = 15;
    e.paint(x, y, ACID, 0);
    // surround acid with etchable solids
    const g = F(e);
    const neigh = [idx(x - 1, y, W), idx(x + 1, y, W), idx(x, y - 1, W)];
    g.mat[neigh[0]] = STONE;
    g.mat[neigh[1]] = WOOD;
    g.mat[neigh[2]] = GLASS;
    let sawRubble = false;
    for (let t = 0; t < 800; t++) {
      e.step();
      const gv = F(e);
      for (const j of neigh) if (gv.mat[j] === RUBBLE) sawRubble = true;
      if (sawRubble) break;
    }
    expect(sawRubble).toBe(true);
  });

  it("steam rises when hot; smoke dissipates over time", () => {
    const W = 30,
      H = 30;
    const e = new Engine({ w: W, h: H, seed: 77 });
    // hot steam at bottom
    e.paint(15, 25, STEAM, 0);
    let g = F(e);
    g.temp[idx(15, 25, W)] = 120;
    for (let t = 0; t < 60; t++) e.step();
    g = F(e);
    let foundAbove = false;
    for (let yy = 0; yy < 25; yy++)
      if (g.mat[idx(15, yy, W)] === STEAM) {
        foundAbove = true;
        break;
      }
    expect(foundAbove).toBe(true);
    // smoke dissipates in a closed region
    const e2 = new Engine({ w: W, h: H, seed: 78 });
    tank(e2, 5, 18, 15, 28);
    e2.paint(10, 23, SMOKE, 0);
    let vanished = false;
    for (let t = 0; t < 400; t++) {
      e2.step();
      const gv = F(e2);
      if (gv.mat[idx(10, 23, W)] === 0) {
        vanished = true;
        break;
      }
    }
    expect(vanished).toBe(true);
  });

  it("powders sink into lighter liquids inside a basin", () => {
    const W = 40,
      H = 30;
    const e = new Engine({ w: W, h: H, seed: 88 });
    tank(e, 10, 10, 30, 25);
    // fill basin bottom with water
    for (let y = 22; y <= 24; y++)
      for (let x = 11; x <= 29; x++) e.paint(x, y, WATER, 0);
    // drop a band of sand above
    for (let x = 15; x <= 25; x++) e.paint(x, 15, SAND, 0);
    for (let t = 0; t < 150; t++) e.step();
    const g = F(e);
    let sandAtBottom = 0;
    for (let x = 11; x <= 29; x++)
      if (g.mat[idx(x, 24, W)] === SAND) sandAtBottom++;
    expect(sandAtBottom).toBeGreaterThan(0);
  });

  it.skip("dust near fire flashes to smoke and creates a local pressure bump", () => {
    const W = 30,
      H = 24;
    const e = new Engine({ w: W, h: H, seed: 1234 });
    tank(e, 4, 10, 14, 16);
    for (let x = 6; x < 12; x++) e.paint(x, 13, DUST, 0);
    e.paint(12, 13, FIRE, 0);
    let pressureSpike = false;
    for (let t = 0; t < 80; t++) {
      e.step();
      const gv = F(e);
      for (let x = 6; x < 12; x++) {
        const j = idx(x, 13, W);
        if ((gv.pressure[j] | 0) > 0) pressureSpike = true;
      }
      if (pressureSpike) break;
    }
    expect(pressureSpike).toBe(true);
  });
});
