import { describe, it, expect } from "vitest";
import { Engine } from "../engine/engine";
import { WATER, LAVA, SAND, FIRE } from "../engine/materials/presets";

function hashArray(a: Uint16Array): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < a.length; i++) {
    h ^= a[i];
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

describe("determinism", () => {
  it("same seed, same steps => same state hash", () => {
    const A = new Engine({ w: 64, h: 64, seed: 42 });
    const B = new Engine({ w: 64, h: 64, seed: 42 });
    for (let i = 0; i < 60; i++) {
      A.step();
      B.step();
    }
    const matA = A.grid.frontIsA ? A.grid.a.mat : A.grid.b.mat;
    const matB = B.grid.frontIsA ? B.grid.a.mat : B.grid.b.mat;
    expect(hashArray(matA)).toBe(hashArray(matB));
  });

  it("deterministic with seeded random for 1000 steps", () => {
    const W = 48, H = 48;
    const A = new Engine({ w: W, h: H, seed: 123 });
    const B = new Engine({ w: W, h: H, seed: 123 });
    // Paint a small scene
    A.paint(10, 10, WATER, 3);
    A.paint(20, 10, LAVA, 2);
    A.paint(15, 5, SAND, 2);
    B.paint(10, 10, WATER, 3);
    B.paint(20, 10, LAVA, 2);
    B.paint(15, 5, SAND, 2);
    for (let i = 0; i < 1000; i++) {
      A.step();
      B.step();
    }
    const matA = A.grid.frontIsA ? A.grid.a.mat : A.grid.b.mat;
    const matB = B.grid.frontIsA ? B.grid.a.mat : B.grid.b.mat;
    expect(hashArray(matA)).toBe(hashArray(matB));
  });
});


