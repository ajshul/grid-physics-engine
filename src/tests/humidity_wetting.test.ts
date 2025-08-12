import { describe, it, expect } from "vitest";
import { Engine } from "../engine/engine";
import { idx } from "../engine/grid";
import { WATER, FOAM, ACID, DUST, MUD } from "../engine/materials/presets";

function F(e: Engine) {
  return e.grid.frontIsA ? e.grid.a : e.grid.b;
}

describe("humidity and wetting behaviors", () => {
  it("water/foam/acid increase local humidity over time (in their neighborhood)", () => {
    const W = 28,
      H = 22;
    const e = new Engine({ w: W, h: H, seed: 12 });
    const x = 14,
      y = 11;
    // place a small cluster so humidity has adjacent targets
    e.paint(x, y, WATER, 0);
    e.paint(x + 1, y, WATER, 0);
    e.paint(x + 2, y, FOAM, 0);
    e.paint(x - 1, y, ACID, 0);
    // Run long enough for multiple liquid ticks to apply humidity halos
    for (let t = 0; t < 200; t++) e.step();
    const g = F(e);
    // At least one cell in the scene should exhibit humidity > 0
    const anyWet = Array.from(g.humidity).some((v) => (v | 0) > 0);
    expect(anyWet).toBe(true);
  });

  it("mud transfers humidity to dust below and converts after sufficient wetting", () => {
    const W = 26,
      H = 24;
    const e = new Engine({ w: W, h: H, seed: 13 });
    const x = 10,
      y = 10;
    // Place mud atop dust
    e.paint(x, y, MUD, 0);
    e.paint(x, y + 1, DUST, 0);
    // Seed humidity in mud to transfer
    const g0 = F(e);
    g0.humidity[idx(x, y, W)] = 220 as any;
    // Run for a while to allow transfer and conversion
    let converted = false;
    for (let t = 0; t < 600; t++) {
      e.step();
      const g = F(e);
      if (g.mat[idx(x, y + 1, W)] === MUD) {
        converted = true;
        break;
      }
    }
    expect(converted).toBe(true);
  });
});
