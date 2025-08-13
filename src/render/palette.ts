import * as P from "../engine/materials/presets";
import { registry } from "../engine/materials";

export const MATERIALS = [
  registry[P.STONE]!,
  registry[P.WOOD]!,
  registry[P.ICE]!,
  registry[P.RUBBER]!,
  registry[P.SAND]!,
  registry[P.DUST]!,
  registry[P.WATER]!,
  registry[P.ACID]!,
  registry[P.FOAM]!,
  registry[P.SMOKE]!,
  registry[P.STEAM]!,
  registry[P.FIRE]!,
  registry[P.OIL]!,
  registry[P.LAVA]!,
  registry[P.BOMB]!,
  registry[P.METEOR]!,
  registry[P.BALL]!,
  registry[P.RUBBLE]!,
  registry[P.ASH]!,
  registry[P.GLASS]!,
  registry[P.MUD]!,
  registry[P.EMBER]!,
  registry[P.BEDROCK]!,
];

export const COLORS = [0, ...MATERIALS.map((m) => m.color)];
