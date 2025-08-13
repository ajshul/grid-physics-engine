import type { Engine } from "./engine";
import type { GridView } from "./grid";
import { computePressure } from "./passes/pressure";
import { stepPowder } from "./materials/rules/powder";
import { stepLiquid } from "./materials/rules/liquid";
import { stepGas } from "./materials/rules/gas";
import { stepSolid } from "./materials/rules/solid";
import { stepEnergy } from "./materials/rules/energy";
import { stepObjects } from "./materials/rules/object";
import { applyAcidEtching } from "./passes/acid";
import { applyThermal } from "./materials/reactions";
import { ensureMaterialCaches } from "./materials/cache";

export interface EnginePass {
  name: string;
  execute(
    engine: Engine,
    read: GridView,
    write: GridView,
    rand: () => number
  ): void;
}

class PressurePass implements EnginePass {
  name = "pressure";
  execute(engine: Engine, read: GridView, write: GridView): void {
    computePressure(engine, read, write);
  }
}

class PowderPass implements EnginePass {
  name = "powder";
  execute(
    engine: Engine,
    read: GridView,
    write: GridView,
    rand: () => number
  ): void {
    stepPowder(engine, read, write, rand);
  }
}

class LiquidPass implements EnginePass {
  name = "liquid";
  execute(
    engine: Engine,
    read: GridView,
    write: GridView,
    rand: () => number
  ): void {
    stepLiquid(engine, read, write, rand);
  }
}

class GasPass implements EnginePass {
  name = "gas";
  execute(
    engine: Engine,
    read: GridView,
    write: GridView,
    rand: () => number
  ): void {
    stepGas(engine, read, write, rand);
  }
}

class SolidPass implements EnginePass {
  name = "solid";
  execute(
    engine: Engine,
    read: GridView,
    write: GridView,
    rand: () => number
  ): void {
    stepSolid(engine, read, write, rand);
  }
}

class EnergyPass implements EnginePass {
  name = "energy";
  execute(
    engine: Engine,
    read: GridView,
    write: GridView,
    rand: () => number
  ): void {
    stepEnergy(engine, read, write, rand);
  }
}

class ObjectsPass implements EnginePass {
  name = "objects";
  execute(
    engine: Engine,
    read: GridView,
    write: GridView,
    rand: () => number
  ): void {
    stepObjects(engine, read, write, rand);
  }
}

class AcidPass implements EnginePass {
  name = "acid";
  execute(engine: Engine, read: GridView, write: GridView): void {
    applyAcidEtching(engine, read, write);
  }
}

class ThermalPass implements EnginePass {
  name = "thermal";
  execute(engine: Engine, _read: GridView, write: GridView): void {
    applyThermal(engine, write);
  }
}

export class PassPipeline {
  private passes: EnginePass[];
  constructor(passes: EnginePass[]) {
    this.passes = passes;
  }
  run(
    engine: Engine,
    read: GridView,
    write: GridView,
    rand: () => number
  ): void {
    // Ensure material property caches are up-to-date before executing passes
    ensureMaterialCaches();
    for (const pass of this.passes) {
      pass.execute(engine, read, write, rand);
    }
  }
}

export function createDefaultPipeline(): PassPipeline {
  return new PassPipeline([
    new PressurePass(),
    new PowderPass(),
    new LiquidPass(),
    new GasPass(),
    new SolidPass(),
    new EnergyPass(),
    new ObjectsPass(),
    new AcidPass(),
    new ThermalPass(),
  ]);
}
