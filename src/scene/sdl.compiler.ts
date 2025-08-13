import { parse as parseYaml } from "yaml";
import JSON5 from "json5";
import { SDLSceneSchema, type SDLSceneInput } from "./sdl.schema";
import type { CompileOutput, SDLScene } from "./sdl.types";
import { applyOps } from "./sdl.ops";
import { resolveMaterialIdOrThrow } from "./sdl.materials";

export function parseSDL(
  text: string,
  ext: ".yaml" | ".yml" | ".json5"
): SDLSceneInput {
  try {
    const obj = ext === ".json5" ? JSON5.parse(text) : parseYaml(text);
    return SDLSceneSchema.parse(obj);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`SDL parse/validate failed: ${msg}`);
  }
}

export function compileScene(input: SDLSceneInput): CompileOutput {
  const width = input.canvas.worldWidth | 0;
  const height = input.canvas.worldHeight | 0;
  const mat = new Uint16Array(width * height);
  const temp = new Float32Array(width * height);
  // initialize to ambient temp; UI sets this later when loading into engine
  for (let i = 0; i < temp.length; i++) temp[i] = 20;

  const scene: SDLScene = {
    metadata: input.metadata,
    canvas: input.canvas,
    layers: input.layers,
    entities: input.entities ?? [],
  };

  applyOps(scene, { w: width, h: height, mat, temp });

  const emitters = input.layers
    .flatMap((l) => l.ops)
    .filter((op) => op.type === "emitter")
    .map((op) => {
      const e = op as unknown as {
        name?: string;
        x: number;
        y: number;
        material: string;
        ratePerSec: number;
        radius?: number;
        jitter?: number;
        seed?: number;
      };
      const id = resolveMaterialIdOrThrow(e.material);
      return {
        name: e.name,
        x: e.x,
        y: e.y,
        material: id,
        ratePerSec: e.ratePerSec,
        radius: e.radius ?? 1,
        jitter: e.jitter ?? 0,
        seed: (e.seed ?? input.metadata.seed ?? 0) | 0,
      };
    });

  return {
    tiles: { width, height, mat, temp },
    entities: scene.entities ?? [],
    emitters,
    metadata: scene.metadata,
  };
}
