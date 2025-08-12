import { describe, it, expect } from "vitest";
import { Engine } from "../engine/engine";

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
});


