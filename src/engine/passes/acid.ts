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
  // find acid id by name once
  const acidId = findByName("Acid");
  const rubbleId = findByName("Rubble");
  const smokeId = findByName("Smoke");
  if (!acidId || !rubbleId) return;

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (R[i] !== acidId) continue;
      const n = [i - 1, i + 1, i - w, i + w];
      for (const j of n) {
        const mid = R[j];
        if (mid === 0) continue;
        const m = registry[mid];
        if (!m) continue;
        // dissolve selected solids (stone, wood, glass) slowly
        if (
          m.category === "solid" &&
          (m.name === "Stone" || m.name === "Wood" || m.name === "Glass")
        ) {
          // heat-coupled etch rate: hotter acid etches faster
          const localTemp = T[i];
          const heatFactor = 1 + Math.max(0, (localTemp - 20) / 200);
          const rate = 0.02 * heatFactor;
          if (engine.rand() < rate) {
            W[j] = rubbleId;
            T[j] += 5; // exothermic heat
            if (smokeId && engine.rand() < 0.2) W[i] = smokeId;
            engine.markDirty(j % w | 0, (j / w) | 0);
            // increase local humidity from acid exposure
            HUM[j] = Math.min(255, HUM[j] + 30);
          }
        }
      }
    }
  }
}

function findByName(name: string): number | undefined {
  const id = Object.keys(registry).find((k) => registry[+k]?.name === name);
  return id ? +id : undefined;
}
