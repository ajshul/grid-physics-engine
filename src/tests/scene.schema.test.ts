import { describe, expect, it } from "vitest";
import { SDLSceneSchema } from "../scene/sdl.schema";

describe("SDL schema", () => {
  it("validates a minimal scene", () => {
    const ok = SDLSceneSchema.safeParse({
      metadata: { name: "Test" },
      canvas: { worldWidth: 10, worldHeight: 10 },
      layers: [
        {
          ops: [{ type: "fill", x: 0, y: 0, w: 10, h: 10, material: "STONE" }],
        },
      ],
    });
    expect(ok.success).toBe(true);
  });
});
