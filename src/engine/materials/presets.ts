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
