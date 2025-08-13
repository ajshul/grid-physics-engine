import type { Engine } from "../engine/engine";
import { back, front } from "../engine/grid";
import type { CompileOutput } from "./sdl.types";

export function applyCompiledToEngine(
  engine: Engine,
  compiled: CompileOutput
): void {
  const w = compiled.tiles.width;
  const h = compiled.tiles.height;
  // Assume dimensions match current engine world; scenes are 640x200 by convention
  const gA = front(engine.grid);
  const gB = back(engine.grid);
  // Reset both buffers to baseline then copy tiles
  gA.mat.fill(0);
  gA.temp.fill(20);
  gA.velX.fill(0);
  gA.velY.fill(0);
  gA.flags.fill(0);
  gA.pressure.fill(0);
  gA.impulse.fill(0);
  gA.aux.fill(0);
  gA.humidity.fill(0);
  gA.phase.fill(0);
  gB.mat.set(gA.mat);
  gB.temp.set(gA.temp);
  gB.velX.set(gA.velX);
  gB.velY.set(gA.velY);
  gB.flags.set(gA.flags);
  gB.pressure.set(gA.pressure);
  gB.impulse.set(gA.impulse);
  gB.aux.set(gA.aux);
  gB.humidity.set(gA.humidity);
  gB.phase.set(gA.phase);
  // Apply compiled tiles to front and back
  if (gA.mat.length !== w * h || gA.temp.length !== w * h) {
    // Dimension mismatch: ignore silently for now (scenes should match engine size)
  } else {
    gA.mat.set(compiled.tiles.mat);
    gA.temp.set(compiled.tiles.temp);
    gB.mat.set(compiled.tiles.mat);
    gB.temp.set(compiled.tiles.temp);
  }
  // Reinstate bedrock bottom row safety
  engine.ensureBedrockBottom();
  // Mark all chunks dirty for redraw
  engine.dirty.clear();
  const chunksX = Math.ceil(engine.grid.w / engine.chunkSize);
  const chunksY = Math.ceil(engine.grid.h / engine.chunkSize);
  for (let cy = 0; cy < chunksY; cy++) {
    for (let cx = 0; cx < chunksX; cx++) {
      engine.dirty.add((cy << 16) | cx);
    }
  }
  // Reset camera and drop a fresh player (try SDL-provided spawn first)
  engine.cameraX = 0;
  engine.cameraY = 0;
  const spawn = compiled.metadata?.spawn;
  if (spawn && spawn.x >= 0 && spawn.y >= 0) {
    engine.spawnPlayer(spawn.x, spawn.y);
  } else {
    engine.spawnPlayer(8, 10);
  }
}
