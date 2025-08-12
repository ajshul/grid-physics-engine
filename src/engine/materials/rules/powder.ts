import type { Engine } from "../../engine";
import type { GridView } from "../../grid";
import { registry } from "../index";
import { CAT } from "../categories";

export function stepPowder(
  engine: Engine,
  read: GridView,
  write: GridView,
  rand: () => number
): void {
  const { w, h } = engine.grid;
  const matR = read.mat;
  const matW = write.mat;
  const humidity = write.humidity;
  const VX = write.velX;
  const VY = write.velY;
  for (let y = h - 2; y >= 0; y--) {
    const dir = (y & 1) === 0 ? -1 : 1; // alternate to reduce bias per row
    for (let x = dir < 0 ? w - 2 : 1; dir < 0 ? x >= 1 : x <= w - 2; x += dir) {
      const i = (y * w + x) | 0;
      const id = matR[i];
      const m = registry[id];
      if (!m || m.category !== "powder") continue;

      const below = i + w;
      const belowId = matR[below];
      // empty or gas treated as empty
      const belowMat = registry[belowId];
      if (belowId === 0 || (belowMat && belowMat.category === CAT.GAS)) {
        matW[i] = 0;
        matW[below] = id;
        VY[below] = 1;
        engine.markDirty(x, y);
        engine.markDirty(x, y + 1);
        continue;
      }

      // displace liquids of lower density (powder sinks)
      if (
        belowMat &&
        belowMat.category === CAT.LIQUID &&
        (belowMat.density ?? 0) < (m.density ?? 0)
      ) {
        matW[i] = belowId;
        matW[below] = id;
        VY[below] = 1;
        engine.markDirty(x, y);
        engine.markDirty(x, y + 1);
        continue;
      }

      // diagonal slip (reduced when wet)
      const localWet = humidity[i] / 255;
      const slipBase = m.slip ?? 0.7;
      // wind coupling: gas velocity near powder nudges lateral move chance
      let windBoost = 0;
      const leftGas = registry[matR[i - 1]]?.category === CAT.GAS;
      const rightGas = registry[matR[i + 1]]?.category === CAT.GAS;
      if (leftGas && VX[i - 1] < 0) windBoost += 0.1;
      if (rightGas && VX[i + 1] > 0) windBoost += 0.1;
      const slip = Math.max(
        0,
        Math.min(1, slipBase - 0.4 * localWet + windBoost)
      );
      const tryL = below - 1;
      const tryR = below + 1;
      // randomized side preference
      if (rand() < 0.5) {
        const leftId = matR[i - 1];
        if (
          (matR[tryL] === 0 || registry[matR[tryL]]?.category === CAT.GAS) &&
          (leftId === 0 || registry[leftId]?.category === CAT.GAS) &&
          rand() < slip
        ) {
          matW[i] = 0;
          matW[tryL] = id;
          VX[tryL] = -1;
          engine.markDirty(x, y);
          engine.markDirty(x - 1, y + 1);
          continue;
        }
        const rightId = matR[i + 1];
        if (
          (matR[tryR] === 0 || registry[matR[tryR]]?.category === CAT.GAS) &&
          (rightId === 0 || registry[rightId]?.category === CAT.GAS) &&
          rand() < slip
        ) {
          matW[i] = 0;
          matW[tryR] = id;
          VX[tryR] = 1;
          engine.markDirty(x, y);
          engine.markDirty(x + 1, y + 1);
          continue;
        }
      } else {
        const rightId = matR[i + 1];
        if (
          (matR[tryR] === 0 || registry[matR[tryR]]?.category === CAT.GAS) &&
          (rightId === 0 || registry[rightId]?.category === CAT.GAS) &&
          rand() < slip
        ) {
          matW[i] = 0;
          matW[tryR] = id;
          VX[tryR] = 1;
          engine.markDirty(x, y);
          engine.markDirty(x + 1, y + 1);
          continue;
        }
        const leftId = matR[i - 1];
        if (
          (matR[tryL] === 0 || registry[matR[tryL]]?.category === CAT.GAS) &&
          (leftId === 0 || registry[leftId]?.category === CAT.GAS) &&
          rand() < slip
        ) {
          matW[i] = 0;
          matW[tryL] = id;
          VX[tryL] = -1;
          engine.markDirty(x, y);
          engine.markDirty(x - 1, y + 1);
          continue;
        }
      }
    }
  }
}
