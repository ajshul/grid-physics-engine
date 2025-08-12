import { describe, it, expect } from "vitest";
import { Engine } from "../engine/engine";
import { idx } from "../engine/grid";
import { WATER, STEAM } from "../engine/materials/presets";

function F(e: Engine) {
  return e.grid.frontIsA ? e.grid.a : e.grid.b;
}

// This test validates that the fields used by overlays (temp/pressure)
// change even when materials don't move, ensuring overlays have fresh data
// to render. It does not exercise the canvas code directly.
describe("overlay field consistency", () => {
  it("temperature and pressure fields evolve near activity even if the target cell doesn't move", () => {
    const W = 24,
      H = 24;
    const e = new Engine({ w: W, h: H, seed: 123 });
    const x = 12,
      y = 12;
    // Put a small water column with hot steam nearby to induce both fields
    e.paint(x, y, WATER, 0);
    e.paint(x + 1, y + 1, STEAM, 0);
    const i = idx(x, y, W);
    let changedP = false;
    let changedT = false;
    let pPrev = F(e).pressure[i] | 0;
    let tPrev = F(e).temp[i];
    for (let t = 0; t < 30; t++) {
      e.step();
      const g = F(e);
      const pNow = g.pressure[i] | 0;
      const tNow = g.temp[i];
      if (pNow !== pPrev) changedP = true;
      if (tNow !== tPrev) changedT = true;
      pPrev = pNow;
      tPrev = tNow;
    }
    expect(changedP || changedT).toBe(true);
  });
});
