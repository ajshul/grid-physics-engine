import { describe, it, expect } from "vitest";
import { Engine } from "../engine/engine";
import * as P from "../engine/materials/presets";

function fillRect(
  engine: Engine,
  y0: number,
  y1: number,
  x0: number,
  x1: number,
  matId: number
) {
  const g = engine.grid.frontIsA ? engine.grid.a : engine.grid.b;
  const { w } = engine.grid;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = y * w + x;
      g.mat[i] = matId;
    }
  }
}

describe("player + powders", () => {
  it.skip("rises out of a moderate sand pile when holding up (known limitation on deep/compact piles)", () => {
    const W = 30,
      H = 30;
    const e = new Engine({ w: W, h: H });
    // Stone floor at y=24
    fillRect(e, 24, 24, 0, W - 1, P.STONE);
    // Sand pile from y=18..23 (6 cells) centered at x=15
    fillRect(e, 18, 23, 12, 18, P.SAND);
    // Spawn player buried at y=23 under the pile
    const p = e.spawnPlayer(15, 23);
    const yStart = p.y;
    // Hold jump/up for 60 frames (~1s) to allow displacement
    p.setInput({ jump: true });
    for (let i = 0; i < 60; i++) e.step();
    // TODO: Expect the player to move upward out of the pile once powder displacement is handled in a pass.
    expect(p.y).toBeLessThan(yStart - 3);
  });

  it.skip("drops down through sand when holding down (diagonal spill WIP)", () => {
    const W = 30,
      H = 30;
    const e = new Engine({ w: W, h: H });
    // Stone floor at y=24
    fillRect(e, 24, 24, 0, W - 1, P.STONE);
    // Sand platform thickness 4 at y=20..23, centered
    fillRect(e, 20, 23, 10, 20, P.SAND);
    // Spawn player standing on top at y=19
    const p = e.spawnPlayer(15, 19);
    const yStart = p.y;
    // Hold down long enough to trigger drop, then continue stepping
    p.setInput({ down: true });
    for (let i = 0; i < 50; i++) e.step();
    // TODO: Expect the player to move downward when diagonal spill is implemented in the powder pass.
    expect(p.y).toBeGreaterThan(yStart + 3);
  });
});
