import type { GridView } from "../grid";

export type Category =
  | "solid"
  | "powder"
  | "liquid"
  | "gas"
  | "energy"
  | "object";

export interface Reaction {
  with: number;
  chance?: number;
  result?: number;
  otherResult?: number;
  heatDelta?: number;
  spawn?: Array<{ id: number; count: number; spread?: number }>; // byproducts
}

export interface TickCtx {
  width: number;
  height: number;
  read: GridView;
  write: GridView;
  rand: () => number;
  markDirty(x: number, y: number): void;
}

export interface Material {
  id: number;
  name: string;
  color: number; // 0xRRGGBB packed for blitting
  category: Category;
  density: number;
  viscosity?: number;
  flammable?: boolean;
  combustionTemp?: number;
  heatCapacity?: number;
  conductivity?: number;
  meltingPoint?: number;
  boilingPoint?: number;
  evaporationRate?: number;
  freezingPoint?: number;
  slip?: number;
  bounciness?: number;
  reactions?: Reaction[];
  tick?: (ctx: TickCtx, i: number) => void;
  immiscibleWith?: string[]; // names of liquids considered immiscible for mixing heuristics
}


