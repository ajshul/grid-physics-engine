import { describe, it, expect } from "vitest";
import { Engine } from "../engine/engine";
import { idx } from "../engine/grid";
import { FOAM, STEAM } from "../engine/materials/presets";

function F(e: Engine) {
  return e.grid.frontIsA ? e.grid.a : e.grid.b;
}

describe("gas under liquid bubble swap", () => {
  it("hot gas under a sticky liquid can swap upward, releasing trapped bubble", () => {
    const W = 26,
      H = 26;
    const e = new Engine({ w: W, h: H, seed: 42 });
    const x = 13,
      y = 13;
    // Put a FOAM cell above (sticky: liquid pass won't move it) and hot steam below
    e.paint(x, y - 1, FOAM, 0);
    e.paint(x, y, STEAM, 0);
    // make steam hot to favor swap
    const g0 = F(e);
    g0.temp[idx(x, y, W)] = 140;
    // Run several steps to allow probabilistic swap in the gas pass
    let swapped = false;
    for (let t = 0; t < 60; t++) {
      e.step();
      const g = F(e);
      if (g.mat[idx(x, y - 1, W)] === STEAM) {
        swapped = true;
        break;
      }
    }
    expect(swapped).toBe(true);
  });
});
