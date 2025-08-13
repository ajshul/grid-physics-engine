import { define } from "./index";
import { CAT } from "./categories";

export const EMPTY = 0;

export const STONE = define({
  name: "Stone",
  color: 0x6e6e6e,
  category: CAT.SOLID,
  density: 9.0,
  conductivity: 0.7,
  heatCapacity: 0.8,
  meltingPoint: 1200,
});

export const WOOD = define({
  name: "Wood",
  color: 0x8b5a2b,
  category: CAT.SOLID,
  density: 5.0,
  flammable: true,
  combustionTemp: 300,
  conductivity: 0.1,
  heatCapacity: 1.5,
});

export const ICE = define({
  name: "Ice",
  color: 0xaee4ff,
  category: CAT.SOLID,
  density: 9.2,
  meltingPoint: 0,
  conductivity: 0.5,
  // specific heat capacity relative scale (water ~4.2, ice ~2.1)
  heatCapacity: 2.1,
});

export const RUBBER = define({
  name: "Rubber",
  color: 0x222222,
  category: CAT.SOLID,
  density: 6.0,
  conductivity: 0.05,
  bounciness: 0.8,
});

export const SAND = define({
  name: "Sand",
  color: 0xd7c58b,
  category: CAT.POWDER,
  density: 7.0,
  slip: 0.75,
  conductivity: 0.2,
});

export const DUST = define({
  name: "Dust",
  color: 0xcabfb0,
  category: CAT.POWDER,
  density: 3.0,
  slip: 0.9,
  flammable: true,
  combustionTemp: 380,
});

export const WATER = define({
  name: "Water",
  color: 0x3a9ad9,
  category: CAT.LIQUID,
  density: 5.5,
  viscosity: 2,
  heatCapacity: 4.2,
  freezingPoint: 0,
  boilingPoint: 100,
  evaporationRate: 0.001,
  immiscibleWith: ["Oil", "Lava"],
});

export const ACID = define({
  name: "Acid",
  color: 0x92ff5a,
  category: CAT.LIQUID,
  density: 5.4,
  viscosity: 1,
  reactions: [],
  immiscibleWith: ["Oil"],
});

export const FOAM = define({
  name: "Foam",
  color: 0xf2fff2,
  category: CAT.LIQUID,
  density: 2.0,
  viscosity: 3,
  // foam should suppress fire; handled in reactions/energy
  immiscibleWith: ["Oil"],
});

export const SMOKE = define({
  name: "Smoke",
  color: 0x444444,
  category: CAT.GAS,
  density: -2.0,
});

export const STEAM = define({
  name: "Steam",
  color: 0xbad7ff,
  category: CAT.GAS,
  density: -1.5,
});

export const FIRE = define({
  name: "Fire",
  color: 0xff6b00,
  category: CAT.ENERGY,
  density: -0.5,
  combustionTemp: 300,
});

export const OIL = define({
  name: "Oil",
  color: 0x3f2d20,
  category: CAT.LIQUID,
  density: 5.0,
  viscosity: 3,
  flammable: true,
  combustionTemp: 250,
  immiscibleWith: ["Water", "Foam", "Acid"],
});

export const LAVA = define({
  name: "Lava",
  color: 0xff3300,
  category: CAT.LIQUID,
  density: 8.0,
  viscosity: 5,
  immiscibleWith: ["Water", "Oil", "Foam", "Acid"],
});

export const MUD = define({
  name: "Mud",
  color: 0x8b7652,
  category: CAT.POWDER,
  density: 6.2,
  slip: 0.4,
});

export const EMBER = define({
  name: "Ember",
  color: 0xffa500,
  category: CAT.ENERGY,
  density: -0.2,
});

export const BOMB = define({
  name: "Bomb",
  color: 0x222244,
  category: CAT.OBJECT,
  density: 9.0,
});

export const METEOR = define({
  name: "Meteor",
  color: 0x884422,
  category: CAT.OBJECT,
  density: 9.5,
});

export const BALL = define({
  name: "Ball",
  color: 0xffffff,
  category: CAT.OBJECT,
  density: 7.0,
  bounciness: 0.7,
});

export const RUBBLE = define({
  name: "Rubble",
  color: 0x7a6f63,
  category: CAT.POWDER,
  density: 7.5,
  slip: 0.5,
});

export const ASH = define({
  name: "Ash",
  color: 0x6b6b6b,
  category: CAT.POWDER,
  density: 2.0,
  slip: 0.9,
});

export const GLASS = define({
  name: "Glass",
  color: 0x99ddff,
  category: CAT.SOLID,
  density: 7.2,
  meltingPoint: 700,
  conductivity: 0.3,
});

export const BEDROCK = define({
  name: "Bedrock",
  color: 0x111111,
  category: CAT.SOLID,
  density: 10.0,
  conductivity: 0.05,
});

// --- SDL extension materials/props ---

export const DIRT = define({
  name: "Dirt",
  color: 0x7b5e3b,
  category: CAT.POWDER,
  density: 6.0,
  slip: 0.6,
  conductivity: 0.12,
});

export const GRASS = define({
  name: "Grass",
  color: 0x3c8f2f,
  category: CAT.SOLID,
  density: 2.2,
  flammable: true,
  combustionTemp: 260,
  conductivity: 0.08,
});

export const BUSH = define({
  name: "Bush",
  color: 0x2f7a28,
  category: CAT.SOLID,
  density: 1.8,
  flammable: true,
  combustionTemp: 240,
});

export const REED = define({
  name: "Reed",
  color: 0x86c064,
  category: CAT.SOLID,
  density: 1.5,
  flammable: true,
  combustionTemp: 230,
});

export const LEAF = define({
  name: "Leaf",
  color: 0x58b14c,
  category: CAT.SOLID,
  density: 1.4,
  flammable: true,
  combustionTemp: 240,
});

export const WOODEN_PLANK = define({
  name: "WoodenPlank",
  color: 0xa0703a,
  category: CAT.SOLID,
  density: 5.0,
  flammable: true,
  combustionTemp: 300,
});

export const THATCH = define({
  name: "Thatch",
  color: 0xc8a55a,
  category: CAT.SOLID,
  density: 1.6,
  flammable: true,
  combustionTemp: 240,
});

export const TILE_FLOOR = define({
  name: "TileFloor",
  color: 0xbcbcbc,
  category: CAT.SOLID,
  density: 8.2,
  conductivity: 0.4,
});

export const STEEL_WALL = define({
  name: "SteelWall",
  color: 0x888c94,
  category: CAT.SOLID,
  density: 9.0,
  conductivity: 0.9,
});

export const STEEL_GIRDER = define({
  name: "SteelGirder",
  color: 0x6f737a,
  category: CAT.SOLID,
  density: 8.8,
  conductivity: 0.85,
});

export const LADDER = define({
  name: "Ladder",
  color: 0x9b6f3a,
  category: CAT.SOLID,
  density: 4.2,
  flammable: true,
  combustionTemp: 300,
});

export const STONE_BRICK = define({
  name: "StoneBrick",
  color: 0x777777,
  category: CAT.SOLID,
  density: 9.0,
  conductivity: 0.6,
});

export const STEEL_GRATING = define({
  name: "SteelGrating",
  color: 0x9aa0a8,
  category: CAT.SOLID,
  density: 8.0,
  conductivity: 0.8,
});

export const LOG = define({
  name: "Log",
  color: 0x7a4e2a,
  category: CAT.SOLID,
  density: 5.5,
  flammable: true,
  combustionTemp: 300,
});

export const CRATE = define({
  name: "Crate",
  color: 0x5f3a1e,
  category: CAT.OBJECT,
  density: 7.2,
});

export const STEEL_BARREL = define({
  name: "SteelBarrel",
  color: 0x4c5460,
  category: CAT.OBJECT,
  density: 8.6,
});

export const PURPLE_CHEM = define({
  name: "PurpleChem",
  color: 0x9b4dff,
  category: CAT.LIQUID,
  density: 5.3,
  viscosity: 1,
  immiscibleWith: ["Oil"],
});
