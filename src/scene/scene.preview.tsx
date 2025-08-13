import { useEffect, useMemo, useRef } from "react";
import { Engine } from "../engine/engine";
import { blit, makePalette } from "../render/painter";
import { COLORS } from "../render/palette";
import { compileScene, parseSDL } from "./sdl.compiler";

type Props = {
  sdlText: string;
  ext: ".yaml" | ".yml" | ".json5";
};

export default function ScenePreview({ sdlText, ext }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const compiled = useMemo(
    () => compileScene(parseSDL(sdlText, ext)),
    [sdlText, ext]
  );

  useEffect(() => {
    const VIEW_W = 320;
    const VIEW_H = 200;
    const engine = new Engine({
      w: compiled.tiles.width,
      h: compiled.tiles.height,
    });
    engine.viewW = VIEW_W;
    engine.viewH = VIEW_H;
    // seed player
    engine.spawnPlayer(8, 10);
    // write compiled tiles into front buffer
    const g = engine.grid.frontIsA ? engine.grid.a : engine.grid.b;
    g.mat.set(compiled.tiles.mat);
    g.temp.set(compiled.tiles.temp);
    const cvs = canvasRef.current!;
    const ctx = cvs.getContext("2d")!;
    cvs.width = VIEW_W;
    cvs.height = VIEW_H;
    const id = ctx.createImageData(VIEW_W, VIEW_H);
    const pal = makePalette(COLORS);
    let acc = 0;
    let last = performance.now();
    let raf = 0;
    const loop = (t: number) => {
      const dt = (t - last) / 1000;
      last = t;
      acc += dt;
      while (acc > 1 / 60) {
        engine.step();
        acc -= 1 / 60;
      }
      const front = engine.grid.frontIsA ? engine.grid.a : engine.grid.b;
      blit(
        ctx,
        id,
        { mat: front.mat, temp: front.temp, pressure: front.pressure },
        pal,
        VIEW_W,
        VIEW_H,
        engine.grid.w,
        engine.grid.h,
        engine.cameraX,
        engine.cameraY,
        engine.dirty,
        engine.chunkSize,
        "none"
      );
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [compiled]);

  return (
    <canvas
      ref={canvasRef}
      className="image-render-pixel game-canvas"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    />
  );
}
