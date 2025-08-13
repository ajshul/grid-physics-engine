import { z } from "zod";

export const MaterialName = z.string().min(1);

const OpBase = z.object({
  type: z.enum([
    "fill",
    "overlay",
    "scatter",
    "basin",
    "ring",
    "spot",
    "slope",
    "stream",
    "structure",
    "emitter",
    "noiseFill",
  ]),
  seed: z.number().int().optional(),
  z: z.number().optional(),
});

export const OpFill = OpBase.extend({
  type: z.literal("fill"),
  x: z.number().int(),
  y: z.number().int(),
  w: z.number().int().positive(),
  h: z.number().int().positive(),
  material: MaterialName,
});

export const OpOverlay = OpBase.extend({
  type: z.literal("overlay"),
  x: z.number().int(),
  y: z.number().int(),
  w: z.number().int().positive(),
  h: z.number().int().positive(),
  material: MaterialName,
  mask: MaterialName.or(z.literal("any")).optional(),
});

export const OpScatter = OpBase.extend({
  type: z.literal("scatter"),
  region: z.object({
    x: z.number().int(),
    y: z.number().int(),
    w: z.number().int().positive(),
    h: z.number().int().positive(),
  }),
  material: MaterialName,
  density: z.number().min(0).max(1),
  radius: z.number().int().min(1).max(16).optional(),
});

export const OpBasin = OpBase.extend({
  type: z.literal("basin"),
  x: z.number().int(),
  y: z.number().int(),
  w: z.number().int().positive(),
  depth: z.number().int().positive(),
  wall: MaterialName,
  fill: z
    .object({ material: MaterialName, level: z.number().int().min(0) })
    .optional(),
});

export const OpRing = OpBase.extend({
  type: z.literal("ring"),
  cx: z.number().int(),
  cy: z.number().int(),
  r: z.number().int().positive(),
  thickness: z.number().int().min(1).max(12).optional(),
  material: MaterialName,
});

export const OpSpot = OpBase.extend({
  type: z.literal("spot"),
  cx: z.number().int(),
  cy: z.number().int(),
  r: z.number().int().positive(),
  material: MaterialName,
});

export const OpSlope = OpBase.extend({
  type: z.literal("slope"),
  x: z.number().int(),
  y: z.number().int(),
  w: z.number().int().positive(),
  h: z.number().int().positive(),
  direction: z.enum(["up", "down"]),
  material: MaterialName,
});

export const OpStream = OpBase.extend({
  type: z.literal("stream"),
  from: z.object({ x: z.number().int(), y: z.number().int() }),
  to: z.object({ x: z.number().int(), y: z.number().int() }),
  thickness: z.number().int().min(1).max(8).optional(),
  material: MaterialName,
});

export const OpStructure = OpBase.extend({
  type: z.literal("structure"),
  name: z.string().optional(),
  x: z.number().int(),
  y: z.number().int(),
  w: z.number().int().positive(),
  h: z.number().int().positive(),
  material: MaterialName,
  hollow: z.boolean().optional(),
  roof: z
    .object({
      material: MaterialName,
      thickness: z.number().int().min(1).max(6).optional(),
    })
    .optional(),
});

export const OpEmitter = OpBase.extend({
  type: z.literal("emitter"),
  name: z.string().optional(),
  x: z.number().int(),
  y: z.number().int(),
  material: MaterialName,
  ratePerSec: z.number().nonnegative(),
  radius: z.number().int().min(1).max(12).optional(),
  jitter: z.number().min(0).max(64).optional(),
});

export const OpNoiseFill = OpBase.extend({
  type: z.literal("noiseFill"),
  x: z.number().int(),
  y: z.number().int(),
  w: z.number().int().positive(),
  h: z.number().int().positive(),
  material: MaterialName,
  threshold: z.number().min(0).max(1),
  scale: z.number().min(1).max(64).optional(),
});

export const SDLOp = z.union([
  OpFill,
  OpOverlay,
  OpScatter,
  OpBasin,
  OpRing,
  OpSpot,
  OpSlope,
  OpStream,
  OpStructure,
  OpEmitter,
  OpNoiseFill,
]);

export const SDLLayer = z.object({
  name: z.string().optional(),
  z: z.number().optional(),
  ops: z.array(SDLOp),
});

export const SDLSceneSchema = z.object({
  metadata: z.object({
    name: z.string(),
    author: z.string().optional(),
    seed: z.number().int().optional(),
    description: z.string().optional(),
  }),
  canvas: z.object({
    worldWidth: z.number().int().positive(),
    worldHeight: z.number().int().positive(),
    gravity: z.number().optional(),
    camera: z
      .object({
        width: z.number().int().positive(),
        height: z.number().int().positive(),
      })
      .partial()
      .optional(),
  }),
  layers: z.array(SDLLayer).min(1),
  entities: z
    .array(
      z.object({
        type: z.string(),
        x: z.number().int(),
        y: z.number().int(),
        w: z.number().int().optional(),
        h: z.number().int().optional(),
        material: MaterialName.optional(),
      })
    )
    .optional(),
});

export type SDLSceneInput = z.infer<typeof SDLSceneSchema>;
