// Scene Design Language (SDL) — TypeScript types

export type SDLNumber = number;

export type SDLRng = {
  seed?: number;
};

export type SDLMetadata = {
  name: string;
  author?: string;
  seed?: number;
  description?: string;
};

export type SDLCamera = {
  width: number; // viewport width in cells
  height: number; // viewport height in cells
};

export type SDLEngineCanvas = {
  worldWidth: number;
  worldHeight: number;
  gravity?: SDLNumber; // reserved for future use; engine constants otherwise
};

export type SDLCanvas = SDLEngineCanvas & {
  camera?: Partial<SDLCamera>;
};

export type SDLMaterialName = string; // maps via sdl.materials.ts

export type SDLOpBase = {
  type:
    | "fill"
    | "overlay"
    | "scatter"
    | "basin"
    | "ring"
    | "spot"
    | "slope"
    | "stream"
    | "structure"
    | "emitter"
    | "noiseFill";
  seed?: number;
  z?: number;
};

export type OpFill = SDLOpBase & {
  type: "fill";
  x: number;
  y: number;
  w: number;
  h: number;
  material: SDLMaterialName;
};

export type OpOverlay = SDLOpBase & {
  type: "overlay";
  x: number;
  y: number;
  w: number;
  h: number;
  material: SDLMaterialName;
  mask?: SDLMaterialName | "any"; // only overwrite matching target material
};

export type OpScatter = SDLOpBase & {
  type: "scatter";
  region: { x: number; y: number; w: number; h: number };
  material: SDLMaterialName;
  density: number; // 0..1 fraction of cells
  radius?: number; // brush radius per placement
};

export type OpBasin = SDLOpBase & {
  type: "basin";
  x: number;
  y: number;
  w: number;
  depth: number;
  wall: SDLMaterialName;
  fill?: { material: SDLMaterialName; level: number };
};

export type OpRing = SDLOpBase & {
  type: "ring";
  cx: number;
  cy: number;
  r: number;
  thickness?: number;
  material: SDLMaterialName;
};

export type OpSpot = SDLOpBase & {
  type: "spot";
  cx: number;
  cy: number;
  r: number;
  material: SDLMaterialName;
};

export type OpSlope = SDLOpBase & {
  type: "slope";
  x: number;
  y: number;
  w: number;
  h: number;
  direction: "up" | "down"; // left->right rising or falling
  material: SDLMaterialName;
};

export type OpStream = SDLOpBase & {
  type: "stream";
  from: { x: number; y: number };
  to: { x: number; y: number };
  thickness?: number;
  material: SDLMaterialName;
};

export type OpStructure = SDLOpBase & {
  type: "structure";
  name?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  material: SDLMaterialName;
  hollow?: boolean;
  roof?: { material: SDLMaterialName; thickness?: number };
};

export type OpEmitter = SDLOpBase & {
  type: "emitter";
  name?: string;
  x: number;
  y: number;
  material: SDLMaterialName;
  ratePerSec: number; // particles per second
  radius?: number; // brush radius
  jitter?: number; // positional jitter (cells)
};

export type OpNoiseFill = SDLOpBase & {
  type: "noiseFill";
  x: number;
  y: number;
  w: number;
  h: number;
  material: SDLMaterialName;
  threshold: number; // 0..1
  scale?: number; // noise scale
};

export type SDLOp =
  | OpFill
  | OpOverlay
  | OpScatter
  | OpBasin
  | OpRing
  | OpSpot
  | OpSlope
  | OpStream
  | OpStructure
  | OpEmitter
  | OpNoiseFill;

export type SDLLayer = {
  name?: string;
  z?: number;
  ops: SDLOp[];
};

export type SDLEntity = {
  type: string; // future extension
  x: number;
  y: number;
  w?: number;
  h?: number;
  material?: SDLMaterialName; // convenient shim for static props
};

export type SDLScene = {
  metadata: SDLMetadata;
  canvas: SDLCanvas;
  layers: SDLLayer[];
  entities?: SDLEntity[];
};

export type CompiledTiles = {
  width: number;
  height: number;
  mat: Uint16Array;
  temp: Float32Array;
};

export type CompiledEmitter = {
  name?: string;
  x: number;
  y: number;
  material: number; // engine material id
  ratePerSec: number;
  radius: number;
  jitter: number;
  seed: number;
};

export type CompileOutput = {
  tiles: CompiledTiles;
  entities: SDLEntity[];
  emitters: CompiledEmitter[];
  metadata: SDLMetadata;
};
