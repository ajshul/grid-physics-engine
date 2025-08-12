import { useEffect, useRef } from "react";
import { Engine } from "../engine/engine";
import { blit, makePalette } from "../render/painter";
import { COLORS } from "../render/palette";
import { useStore } from "../state/useStore";

export default function CanvasView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);

  useEffect(() => {
    const W = 320;
    const H = 200; // tune
    const engine = new Engine({ w: W, h: H });
    engineRef.current = engine;
    const cvs = canvasRef.current!;
    const ctx = cvs.getContext("2d")!;
    cvs.width = W;
    cvs.height = H;
    const id = ctx.createImageData(W, H);
    const pal = makePalette(COLORS);

    let acc = 0;
    let last = performance.now();
    let raf = 0;
    const loop = (t: number) => {
      const dt = (t - last) / 1000;
      last = t;
      const { paused, speed } = useStore.getState();
      acc += dt * speed;
      while (acc > 1 / 60) {
        if (!paused) engine.step();
        acc -= 1 / 60;
      }
      const front = engine.grid.frontIsA ? engine.grid.a : engine.grid.b;
      const { overlay } = useStore.getState();
      blit(ctx, id, { mat: front.mat, temp: front.temp, pressure: front.pressure }, pal, W, H, engine.dirty, engine.chunkSize, overlay);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const onDrag = (e: PointerEvent) => {
      const rect = cvs.getBoundingClientRect();
      const x = Math.floor(((e.clientX - rect.left) / rect.width) * W);
      const y = Math.floor(((e.clientY - rect.top) / rect.height) * H);
      const { selected, brush } = useStore.getState();
      engine.paint(x, y, selected, brush);
    };
    const down = (e: PointerEvent) => {
      onDrag(e);
      cvs.setPointerCapture(e.pointerId);
      cvs.addEventListener("pointermove", onDrag);
    };
    const up = () => cvs.removeEventListener("pointermove", onDrag);

    cvs.addEventListener("pointerdown", down);
    window.addEventListener("pointerup", up);

    return () => {
      window.removeEventListener("pointerup", up);
      cvs.removeEventListener("pointerdown", down);
      cvs.removeEventListener("pointermove", onDrag);
      cancelAnimationFrame(raf);
    };
    // only set up once; reactive values are read from the store inside loop/handlers
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="image-render-pixel"
      style={{ width: "100%", height: "100%", display: "block" }}
    />
  );
}
