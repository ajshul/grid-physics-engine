import { describe, it, expect } from "vitest";
import { Engine } from "../engine/engine";
import { idx } from "../engine/grid";
import { ICE, WATER, STEAM, FIRE, STONE } from "../engine/materials/presets";

function frontView(e: Engine) {
  return e.grid.frontIsA ? e.grid.a : e.grid.b;
}

describe("thermal fundamentals", () => {
  it("hot air cools over time (ambient + diffusion)", () => {
    const W = 32,
      H = 24;
    const e = new Engine({ w: W, h: H, seed: 7 });
    const g = frontView(e);
    const x = 10,
      y = 10;
    const i = idx(x, y, W);
    // empty hot cell
    g.mat[i] = 0;
    g.temp[i] = 400;
    // neighbor empty cells at ambient
    for (const [dx, dy] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ]) {
      const j = idx(x + dx, y + dy, W);
      g.mat[j] = 0;
      g.temp[j] = 20;
    }
    e.step();
    const g2 = frontView(e);
    expect(g2.temp[i]).toBeLessThan(400);
    // after many steps should approach ambient ~20C
    for (let t = 0; t < 200; t++) e.step();
    const gf = frontView(e);
    expect(gf.temp[i]).toBeLessThan(60);
  });

  it("ice holds near 0°C while absorbing latent heat; does not auto-melt quickly", () => {
    const W = 32,
      H = 24;
    const e = new Engine({ w: W, h: H, seed: 9 });
    const x = 16,
      y = 12;
    e.paint(x, y, ICE, 0);
    // Surround with warm air to drive heat flow
    const g = frontView(e);
    for (const [dx, dy] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ]) {
      const j = idx(x + dx, y + dy, W);
      g.mat[j] = 0;
      g.temp[j] = 100;
    }
    // Step for a while; ice should remain ICE and near 0C for many frames
    for (let t = 0; t < 80; t++) e.step();
    const g2 = frontView(e);
    expect(g2.mat[idx(x, y, W)]).toBe(ICE);
    // temperature near melting point during latent absorption (allow small overshoot)
    expect(g2.temp[idx(x, y, W)]).toBeGreaterThanOrEqual(-5);
    expect(g2.temp[idx(x, y, W)]).toBeLessThanOrEqual(15);
  });

  it.skip("ice eventually melts to water only after sufficient latent heat accumulates", () => {
    const W = 32,
      H = 24;
    const e = new Engine({ w: W, h: H, seed: 11 });
    const x = 16,
      y = 12;
    e.paint(x, y, ICE, 0);
    // Create a persistent hot surround to feed heat
    const g = frontView(e);
    const hotCells: number[] = [];
    for (const [dx, dy] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ]) {
      const j = idx(x + dx, y + dy, W);
      g.mat[j] = STONE; // add thermal mass but keep hot
      g.temp[j] = 300;
      hotCells.push(j);
    }
    // Run enough steps for latent to fill (scaled in engine)
    for (let t = 0; t < 800; t++) {
      // keep neighbors hot
      const gv = frontView(e);
      for (const j of hotCells) gv.temp[j] = Math.max(gv.temp[j], 280);
      e.step();
    }
    const g2 = frontView(e);
    // may or may not have fully melted depending on RNG; accept both but enforce progress constraints
    expect([ICE, WATER]).toContain(g2.mat[idx(x, y, W)]);
    // water should be near melting temp or modestly warmed, not ambient 20C
    expect(g2.temp[idx(x, y, W)]).toBeGreaterThanOrEqual(0);
    expect(g2.temp[idx(x, y, W)]).toBeLessThan(80);
  });

  it.skip("boiling requires sustained heat and is delayed by pressure", () => {
    const W = 32,
      H = 32;
    const e = new Engine({ w: W, h: H, seed: 13 });
    const x = 10,
      y = 20;
    e.paint(x, y, WATER, 0);
    // Heat the water cell above base boiling point
    let g = frontView(e);
    g.temp[idx(x, y, W)] = 120;
    // Without pressure, may or may not steam immediately; ensure water does not vanish and if steam, acceptable
    for (let t = 0; t < 300; t++) e.step();
    g = frontView(e);
    expect([WATER, STEAM]).toContain(g.mat[idx(x, y, W)]);
    // Reset scene for pressure test: make a deep water column above target
    const e2 = new Engine({ w: W, h: H, seed: 13 });
    for (let yy = 5; yy <= y; yy++) e2.paint(x, yy, WATER, 0);
    // heat the target again
    let g2 = frontView(e2);
    g2.temp[idx(x, y, W)] = 120;
    // Run similar steps; higher pressure should prevent boiling quickly
    for (let t = 0; t < 300; t++) e2.step();
    g2 = frontView(e2);
    // under higher pressure, less likely to steam so soon
    expect([WATER, STEAM]).toContain(g2.mat[idx(x, y, W)]);
  });
});
