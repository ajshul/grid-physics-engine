import type { Engine } from "../engine";
import type { GridView } from "../grid";
import { registry } from "../materials";

export function applyAcidEtching(
  engine: Engine,
  read: GridView,
  write: GridView
): void {
  const { w, h } = engine.grid;
  const R = read.mat;
  const W = write.mat;
  const T = write.temp;
  const HUM = write.humidity;
  const AUX = write.aux; // reuse per-cell counter for etch budgets
  const canWrite = (idx: number): boolean => W[idx] === R[idx];
  // find acid id by name once
  const acidId = findByName("Acid");
  const rubbleId = findByName("Rubble");
  const smokeId = findByName("Smoke");
  if (!acidId || !rubbleId) return;

  const dt = engine.dt;
  const BUDGET_THRESHOLD = 100; // etch budget required
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (R[i] !== acidId) continue;
      const n = [i - 1, i + 1, i - w, i + w];
      let conversionsThisCell = 0;
      for (const j of n) {
        const mid = R[j];
        if (mid === 0) continue;
        const m = registry[mid];
        if (!m) continue;
        // dissolve selected solids (stone, wood, glass) deterministically via budget
        if (
          m.category === "solid" &&
          (m.name === "Stone" || m.name === "Wood" || m.name === "Glass")
        ) {
          const localTemp = T[i];
          const heatFactor = 1 + Math.max(0, (localTemp - 20) / 200);
          // per-step budget gain; dt-scaled and clamped
          const gain = Math.max(1, (8 * heatFactor * dt * 60) | 0);
          const b = Math.min(65535, (AUX[j] | 0) + gain);
          AUX[j] = b as any;
          if (b >= BUDGET_THRESHOLD && canWrite(j)) {
            W[j] = rubbleId;
            AUX[j] = 0 as any;
            T[j] += 5; // exothermic heat
            conversionsThisCell++;
            engine.markDirty(j % w | 0, (j / w) | 0);
            // increase local humidity from acid exposure
            HUM[j] = Math.min(255, HUM[j] + 30);
          }
        }
      }
      // deterministic smoke emission: one smoke per N conversions
      if (conversionsThisCell > 0 && smokeId && canWrite(i)) {
        const count = (AUX[i] | 0) + conversionsThisCell;
        AUX[i] = count as any;
        if (count >= 3) {
          W[i] = smokeId;
          AUX[i] = 0 as any;
        }
      }
    }
  }
}

function findByName(name: string): number | undefined {
  const id = Object.keys(registry).find((k) => registry[+k]?.name === name);
  return id ? +id : undefined;
}
