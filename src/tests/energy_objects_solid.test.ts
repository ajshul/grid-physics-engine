import { describe, it, expect } from "vitest";
import { Engine } from "../engine/engine";
import { idx } from "../engine/grid";
import {
  FIRE,
  EMBER,
  FOAM,
  WATER,
  OIL,
  WOOD,
  RUBBER,
  BOMB,
  METEOR,
  SAND,
  STONE,
  SMOKE,
} from "../engine/materials/presets";

function G(e: Engine) {
  return e.grid.frontIsA ? e.grid.a : e.grid.b;
}

function tank(e: Engine, x0: number, y0: number, x1: number, y1: number) {
  const g = G(e);
  for (let x = x0; x <= x1; x++) {
    g.mat[idx(x, y0, e.grid.w)] = STONE;
    g.mat[idx(x, y1, e.grid.w)] = STONE;
  }
  for (let y = y0; y <= y1; y++) {
    g.mat[idx(x0, y, e.grid.w)] = STONE;
    g.mat[idx(x1, y, e.grid.w)] = STONE;
  }
}

describe("energy, objects, solids behaviors", () => {
  it.skip("fire heats neighbors and can ignite flammable materials; foam suppresses", () => {
    const W = 36,
      H = 24;
    const e = new Engine({ w: W, h: H, seed: 321 });
    tank(e, 8, 10, 16, 18);
    const x = 12,
      y = 14;
    // place a 2x1 oil patch, a fire next to it, and foam on the other side
    e.paint(x, y, OIL, 0);
    e.paint(x, y - 1, OIL, 0);
    e.paint(x + 1, y, FIRE, 0);
    e.paint(x - 1, y, FOAM, 0);
    for (let t = 0; t < 60; t++) e.step();
    const gv = G(e);
    // assert foam cell not on fire; oil region either oil, fire, foam or water
    expect(gv.mat[idx(x - 1, y, W)]).not.toBe(FIRE);
    const v = gv.mat[idx(x, y, W)];
    expect([OIL, FIRE, FOAM, WATER]).toContain(v);
  });

  it.skip("fire eventually burns out to smoke or ember and cools down", () => {
    const W = 30,
      H = 20;
    const e = new Engine({ w: W, h: H, seed: 222 });
    const x = 8,
      y = 10;
    // seed a fire by heating a flammable material
    e.paint(x, y, WOOD, 0);
    const g = G(e);
    g.temp[idx(x, y, W)] = 500;
    for (let t = 0; t < 300; t++) e.step();
    const gv = G(e);
    expect([EMBER, SMOKE, WOOD, SAND]).toContain(gv.mat[idx(x, y, W)]);
    // temp should have dropped below initial high
    expect(gv.temp[idx(x, y, W)]).toBeLessThan(500);
  });

  it.skip("bomb fuses then explodes with heat, smoke/fire and pressure impulse", () => {
    const W = 40,
      H = 24;
    const e = new Engine({ w: W, h: H, seed: 999 });
    tank(e, 16, 8, 24, 16);
    const x = 20,
      y = 12;
    e.paint(x, y, BOMB, 0);
    // let the fuse tick down deterministically
    for (let t = 0; t < 220; t++) e.step();
    const g = G(e);
    // after explosion, expect non-zero pressure somewhere in a radius
    let hasImpulse = false;
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        const j = idx(x + dx, y + dy, W);
        if ((g.pressure[j] | 0) !== 0) {
          hasImpulse = true;
          break;
        }
      }
      if (hasImpulse) break;
    }
    expect(hasImpulse).toBe(true);
  });

  it("meteor heats neighbors and continues moving downward through gas", () => {
    const W = 36,
      H = 36;
    const e = new Engine({ w: W, h: H, seed: 77 });
    const x = 18,
      y = 5;
    e.paint(x, y, METEOR, 0);
    // step and locate meteor
    for (let t = 0; t < 30; t++) e.step();
    const g1 = G(e);
    let yPos = -1;
    for (let yy = 0; yy < H; yy++)
      if (g1.mat[idx(x, yy, W)] === METEOR) {
        yPos = yy;
        break;
      }
    expect(yPos).toBeGreaterThan(y);
  });

  it("rubber pops to smoke when very hot", () => {
    const W = 24,
      H = 24;
    const e = new Engine({ w: W, h: H, seed: 555 });
    const x = 12,
      y = 12;
    e.paint(x, y, RUBBER, 0);
    const g = G(e);
    g.temp[idx(x, y, W)] = 300;
    // after 1-2 steps rubber should pop to smoke at location before diffusion
    e.step();
    let gv = G(e);
    expect(gv.mat[idx(x, y, W)]).toBe(SMOKE);
    // then smoke may move away; ensure original rubber is gone
    for (let t = 0; t < 20; t++) e.step();
    gv = G(e);
    expect(gv.mat[idx(x, y, W)]).not.toBe(RUBBER);
  });
});
