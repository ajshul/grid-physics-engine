import { readdirSync, readFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve, basename, extname } from "node:path";
import { compileScene, parseSDL } from "../src/scene/sdl.compiler";

function main() {
  const scenesDir = resolve(process.cwd(), "public/scenes");
  const outDir = resolve(process.cwd(), "public/scenes-compiled");
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }
  const files = readdirSync(scenesDir).filter((f) =>
    /\.(ya?ml|json5)$/.test(f)
  );
  const outputs: string[] = [];
  for (const f of files) {
    const p = resolve(scenesDir, f);
    const ext = extname(f).toLowerCase() as ".yaml" | ".yml" | ".json5";
    const txt = readFileSync(p, "utf8");
    const parsed = parseSDL(txt, ext === ".yml" ? ".yaml" : (ext as ".yaml" | ".json5"));
    const compiled = compileScene(parsed);
    const base = basename(f).replace(/\.(ya?ml|json5)$/i, "");
    const outPath = resolve(outDir, `${base}.json`);
    const json = serialize(compiled);
    writeFileSync(outPath, json);
    outputs.push(`${base} -> ${outPath}`);
  }
  console.log(`Compiled ${outputs.length} scene(s):`);
  for (const o of outputs) console.log(` - ${o}`);
}

function serialize(compiled: ReturnType<typeof compileScene>): string {
  // Strip typed arrays into plain arrays for static hosting
  const tiles = {
    width: compiled.tiles.width,
    height: compiled.tiles.height,
    mat: Array.from(compiled.tiles.mat),
    temp: Array.from(compiled.tiles.temp),
  };
  return JSON.stringify({ ...compiled, tiles });
}

main();
